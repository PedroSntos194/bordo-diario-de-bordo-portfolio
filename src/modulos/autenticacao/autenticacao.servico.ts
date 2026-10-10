import { definirAcao } from '@/lib/acao-segura';
import { prisma } from '@/lib/prisma';
import {
  CodigoErro,
  ErroDeAutenticacao,
  ErroDeNegocio,
  ErroDePermissao,
  ErroNaoEncontrado,
} from '@/lib/erros';
import { consumirLimite, LIMITES } from '@/lib/limite-requisicao';
import { gerarHashDeSenha, gastarTempoDeVerificacao, senhaConfere } from '@/lib/senha';
import {
  criarSessao,
  encerrarOutrasSessoes,
  encerrarSessaoAtual,
  gravarCookieDeSessao,
} from '@/lib/sessao';
import { registrarAuditoriaIsolada } from '@/modulos/auditoria/auditoria.servico';
import { validarSenha } from '@/modulos/usuario/usuario.regras';
import {
  atualizarSenha,
  buscarParaTrocaDeSenha,
  buscarPorCpfParaLogin,
  registrarFalhaDeLogin,
  registrarLoginBemSucedido,
} from '@/modulos/usuario/usuario.repositorio';
import {
  aceitouAvisoVigente,
  avaliarTentativaDeLogin,
  destinoAposLogin,
  retornoEhSeguro,
} from './autenticacao.regras';
import {
  esquemaAceitePrivacidade,
  esquemaLogin,
  esquemaTrocaDeSenha,
  type EntradaAceitePrivacidade,
  type EntradaLogin,
  type EntradaTrocaDeSenha,
} from './autenticacao.schema';

/**
 * Casos de uso da autenticação (US001, US002, US003, US043).
 *
 * Tudo passa por `definirAcao`, que cuida de sessão, permissão, validação,
 * transação e auditoria (doc 00 · §3).
 */

export interface ResultadoDoLogin {
  perfil: 'ADMIN' | 'MOTORISTA';
  nome: string;
  deveTrocarSenha: boolean;
  aceitouPrivacidade: boolean;
  destino: string;
}

/**
 * RF001 — autenticação por CPF e senha.
 *
 * Roda **sem transação** (`semTransacao`) por um motivo específico: uma tentativa
 * malsucedida precisa incrementar o contador de falhas (RN003) e, em seguida,
 * lançar erro. Dentro de uma transação, o erro desfaria o incremento e o
 * bloqueio por tentativas nunca aconteceria.
 */
export const entrar = definirAcao<EntradaLogin, ResultadoDoLogin>({
  nome: 'autenticacao.entrar',
  publica: true,
  semTransacao: true,
  esquema: esquemaLogin,
  executar: async (dados, contexto) => {
    consumirLimite(contexto.ip ? `login:${contexto.ip}` : null, LIMITES.login);

    const agora = new Date();
    const usuario = await buscarPorCpfParaLogin(contexto.tx, dados.cpf);

    // Sempre gasta o tempo de uma verificação de hash, exista o usuário ou não:
    // a diferença de tempo de resposta revelaria quais CPFs estão cadastrados.
    const senhaCorreta = usuario
      ? await senhaConfere(usuario.senhaHash, dados.senha)
      : (await gastarTempoDeVerificacao(), false);

    const decisao = avaliarTentativaDeLogin({
      usuario: usuario
        ? {
            status: usuario.status,
            tentativasLogin: usuario.tentativasLogin,
            bloqueadoAte: usuario.bloqueadoAte,
            senhaTemporariaExpiraEm: usuario.senhaTemporariaExpiraEm,
          }
        : null,
      senhaCorreta,
      agora,
    });

    // A auditoria de falha é gravada de forma isolada: o caminho de erro termina
    // em exceção, e o que estivesse enfileirado no contexto se perderia.
    const auditarFalha = async (motivo: string): Promise<void> => {
      await registrarAuditoriaIsolada(prisma, {
        usuarioId: usuario?.id ?? null,
        acao: 'LOGIN_FALHA',
        entidade: 'usuario',
        entidadeId: usuario?.id ?? null,
        valorNovo: { motivo },
        ip: contexto.ip,
        userAgent: contexto.userAgent,
      });
    };

    switch (decisao.tipo) {
      case 'USUARIO_INEXISTENTE': {
        await auditarFalha('CPF não cadastrado');
        throw new ErroDeAutenticacao(CodigoErro.CREDENCIAIS_INVALIDAS, 'CPF ou senha inválidos.');
      }

      case 'CONTA_BLOQUEADA': {
        await auditarFalha('Conta bloqueada por tentativas');
        throw new ErroDePermissao(
          CodigoErro.CONTA_BLOQUEADA,
          `Muitas tentativas. Tente novamente em ${decisao.minutosRestantes} ${
            decisao.minutosRestantes === 1 ? 'minuto' : 'minutos'
          }.`,
        );
      }

      case 'CREDENCIAIS_INVALIDAS': {
        await registrarFalhaDeLogin(contexto.tx, usuario!.id, decisao.novoEstado);
        await auditarFalha('Senha incorreta');

        if (decisao.bloqueouAgora) {
          throw new ErroDePermissao(
            CodigoErro.CONTA_BLOQUEADA,
            'Muitas tentativas. Sua conta ficou bloqueada por 15 minutos.',
          );
        }
        throw new ErroDeAutenticacao(CodigoErro.CREDENCIAIS_INVALIDAS, 'CPF ou senha inválidos.');
      }

      case 'CONTA_INATIVA': {
        await auditarFalha('Conta inativa ou bloqueada pelo administrador');
        throw new ErroDePermissao(
          CodigoErro.CONTA_INATIVA,
          'Seu acesso está indisponível. Procure o administrador.',
        );
      }

      case 'SENHA_TEMPORARIA_EXPIRADA': {
        await auditarFalha('Senha temporária expirada');
        throw new ErroDePermissao(
          CodigoErro.SENHA_TEMPORARIA_EXPIRADA,
          'Sua senha temporária expirou. Solicite uma nova ao administrador.',
        );
      }

      case 'SUCESSO': {
        const autenticado = usuario!;

        await registrarLoginBemSucedido(contexto.tx, autenticado.id, agora);

        const { token, expiraEm } = await criarSessao(autenticado.id, autenticado.perfil, {
          ip: contexto.ip,
          userAgent: contexto.userAgent,
        });
        await gravarCookieDeSessao(token, expiraEm);

        await registrarAuditoriaIsolada(prisma, {
          usuarioId: autenticado.id,
          acao: 'LOGIN',
          entidade: 'usuario',
          entidadeId: autenticado.id,
          ip: contexto.ip,
          userAgent: contexto.userAgent,
        });

        const aceitouPrivacidade = aceitouAvisoVigente(autenticado.aceites);
        const destinoPadrao = destinoAposLogin({
          perfil: autenticado.perfil,
          deveTrocarSenha: autenticado.deveTrocarSenha,
          aceitouPrivacidade,
        });

        // O retorno pedido na URL só é respeitado quando não há pendência de
        // troca de senha nem de aceite — e depois de validado (doc 17).
        const destino =
          destinoPadrao === '/trocar-senha' || destinoPadrao === '/privacidade/aceite'
            ? destinoPadrao
            : retornoEhSeguro(dados.retorno)
              ? dados.retorno
              : destinoPadrao;

        return {
          perfil: autenticado.perfil,
          nome: autenticado.nome,
          deveTrocarSenha: autenticado.deveTrocarSenha,
          aceitouPrivacidade,
          destino,
        };
      }
    }
  },
});

/** RF008 — logout. */
export const sair = definirAcao<void, { ok: true }>({
  nome: 'autenticacao.sair',
  permitePendencias: true,
  semTransacao: true,
  executar: async (_dados, contexto) => {
    await registrarAuditoriaIsolada(prisma, {
      usuarioId: contexto.usuario.id,
      acao: 'LOGOUT',
      entidade: 'usuario',
      entidadeId: contexto.usuario.id,
      ip: contexto.ip,
      userAgent: contexto.userAgent,
    });

    await encerrarSessaoAtual();
    return { ok: true };
  },
});

/** RF003 e RF009 — troca de senha, no primeiro acesso ou por iniciativa do usuário. */
export const trocarSenha = definirAcao<EntradaTrocaDeSenha, { ok: true }>({
  nome: 'autenticacao.trocar-senha',
  permitePendencias: true,
  esquema: esquemaTrocaDeSenha,
  executar: async (dados, contexto) => {
    const usuario = await buscarParaTrocaDeSenha(contexto.tx, contexto.usuario.id);
    if (!usuario) throw new ErroNaoEncontrado();

    // Quem já tem senha definitiva precisa provar que sabe a atual. No primeiro
    // acesso isso é dispensado: o login com a senha temporária já foi a prova.
    if (!usuario.deveTrocarSenha) {
      if (!dados.senhaAtual) {
        throw new ErroDeNegocio(CodigoErro.DADOS_INVALIDOS, 'Informe sua senha atual.', {
          senhaAtual: 'Campo obrigatório.',
        });
      }
      const atualConfere = await senhaConfere(usuario.senhaHash, dados.senhaAtual);
      if (!atualConfere) {
        throw new ErroDeAutenticacao(
          CodigoErro.CREDENCIAIS_INVALIDAS,
          'A senha atual está incorreta.',
        );
      }
    }

    const igualASenhaAnterior = await senhaConfere(usuario.senhaHash, dados.novaSenha);

    validarSenha(dados.novaSenha, {
      cpf: usuario.cpf,
      matricula: usuario.matricula,
      igualASenhaAnterior,
    });

    await atualizarSenha(contexto.tx, usuario.id, await gerarHashDeSenha(dados.novaSenha));

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'usuario',
      entidadeId: usuario.id,
      // O valor da senha nunca entra na trilha — só o fato de ter mudado.
      valorAnterior: { senhaAlterada: false, deveTrocarSenha: usuario.deveTrocarSenha },
      valorNovo: { senhaAlterada: true, deveTrocarSenha: false },
    });

    await encerrarOutrasSessoes(usuario.id);

    return { ok: true };
  },
});

/** RF042 — registra o aceite do aviso de privacidade. */
export const aceitarPrivacidade = definirAcao<EntradaAceitePrivacidade, { ok: true }>({
  nome: 'privacidade.aceitar',
  // Aceitar exige senha definitiva — é a pendência de trocar a senha que
  // vem antes —, mas não pode exigir o próprio aceite que registra.
  permitePendencias: true,
  esquema: esquemaAceitePrivacidade,
  executar: async (dados, contexto) => {
    await contexto.tx.aceitePrivacidade.upsert({
      where: {
        usuarioId_versaoTexto: {
          usuarioId: contexto.usuario.id,
          versaoTexto: dados.versaoTexto,
        },
      },
      update: {},
      create: {
        usuarioId: contexto.usuario.id,
        versaoTexto: dados.versaoTexto,
        ip: contexto.ip,
      },
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'aceite_privacidade',
      entidadeId: contexto.usuario.id,
      valorNovo: { versaoTexto: dados.versaoTexto },
    });

    return { ok: true };
  },
});
