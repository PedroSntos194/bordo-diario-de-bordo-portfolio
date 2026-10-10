import { definirAcao } from '@/lib/acao-segura';
import { CodigoErro, ErroDeConflito, ErroNaoEncontrado } from '@/lib/erros';
import { gerarHashDeSenha, gerarSenhaTemporaria } from '@/lib/senha';
import { encerrarSessoesDoUsuario } from '@/lib/sessao';
import { montarPagina, paraIntervalo, type DadosPaginados } from '@/lib/paginacao';
import {
  expiracaoDaSenhaTemporaria,
  validarAcaoAdministrativa,
} from '@/modulos/usuario/usuario.regras';
import {
  alterarStatus,
  atualizarUsuario,
  buscarPerfil,
  buscarPorId,
  contarAdministradoresAtivos,
  contarUsuarios,
  criarUsuario,
  definirSenhaTemporaria,
  existeOutroComCpf,
  listarUsuarios,
  possuiRegistrosOperacionais,
  type UsuarioDaListagem,
  type UsuarioDetalhado,
} from '@/modulos/usuario/usuario.repositorio';
import {
  esquemaAlterarStatus,
  esquemaCriarUsuario,
  esquemaEditarUsuario,
  esquemaListarUsuarios,
  esquemaRedefinirSenha,
  type EntradaAlterarStatus,
  type EntradaCriarUsuario,
  type EntradaEditarUsuario,
  type EntradaListarUsuarios,
} from '@/modulos/usuario/usuario.schema';

/**
 * Casos de uso de usuários (US004 a US009).
 *
 * Todas as ações administrativas exigem perfil ADMIN — declarado em `perfis`,
 * verificado no servidor por `acao-segura.ts`, e não por esconder o menu.
 */

/** Campo vazio no formulário vira `null` no banco, nunca string vazia. */
function ouNulo(valor: string | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

function dataOuNulo(valor: string | undefined): Date | null {
  const limpo = valor?.trim();
  if (!limpo) return null;
  const data = new Date(`${limpo}T00:00:00Z`);
  return Number.isNaN(data.getTime()) ? null : data;
}

// ---------------------------------------------------------------- listagem

export const listar = definirAcao<
  EntradaListarUsuarios,
  DadosPaginados<UsuarioDaListagem> & {
    totalCadastrado: number;
  }
>({
  nome: 'usuario.listar',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaListarUsuarios,
  executar: async (filtros, contexto) => {
    const { skip, take } = paraIntervalo(filtros);

    const { usuarios, total } = await listarUsuarios(contexto.tx, {
      busca: filtros.busca,
      perfil: filtros.perfil,
      status: filtros.status,
      ordenar: filtros.ordenar,
      direcao: filtros.direcao,
      skip,
      take,
    });

    // O total geral distingue "nenhum usuário cadastrado" de "nenhum resultado
    // para este filtro" — estados vazios diferentes, ações diferentes (doc 11).
    const totalCadastrado = await contarUsuarios(contexto.tx);

    return { ...montarPagina(usuarios, total, filtros), totalCadastrado };
  },
});

export const obter = definirAcao<{ id: string }, UsuarioDetalhado & { podeEditarCpf: boolean }>({
  nome: 'usuario.obter',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaRedefinirSenha,
  executar: async ({ id }, contexto) => {
    const usuario = await buscarPorId(contexto.tx, id);
    if (!usuario) throw new ErroNaoEncontrado('Usuário não encontrado.');

    const temHistorico = await possuiRegistrosOperacionais(contexto.tx, id);
    return { ...usuario, podeEditarCpf: !temHistorico };
  },
});

// -------------------------------------------------------------------- CRUD

export interface UsuarioCriado {
  usuario: UsuarioDaListagem;
  /** Exibida uma única vez ao administrador; não é recuperável depois (US004). */
  senhaTemporaria: string;
}

export const criar = definirAcao<EntradaCriarUsuario, UsuarioCriado>({
  nome: 'usuario.criar',
  perfis: ['ADMIN'],
  esquema: esquemaCriarUsuario,
  executar: async (dados, contexto) => {
    if (await existeOutroComCpf(contexto.tx, dados.cpf)) {
      throw new ErroDeConflito(
        CodigoErro.CPF_DUPLICADO,
        'Já existe um usuário ativo com este CPF.',
        { cpf: 'CPF já cadastrado.' },
      );
    }

    const senhaTemporaria = gerarSenhaTemporaria(10);
    const agora = new Date();

    const usuario = await criarUsuario(contexto.tx, {
      nome: dados.nome,
      cpf: dados.cpf,
      telefone: dados.telefone,
      perfil: dados.perfil,
      matricula: ouNulo(dados.matricula),
      email: ouNulo(dados.email),
      // Dados de CNH só fazem sentido para quem dirige.
      cnhNumero: dados.perfil === 'MOTORISTA' ? ouNulo(dados.cnhNumero) : null,
      cnhCategoria: dados.perfil === 'MOTORISTA' ? ouNulo(dados.cnhCategoria) : null,
      cnhValidade: dados.perfil === 'MOTORISTA' ? dataOuNulo(dados.cnhValidade) : null,
      senhaHash: await gerarHashDeSenha(senhaTemporaria),
      senhaTemporariaExpiraEm: expiracaoDaSenhaTemporaria(agora),
      criadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'usuario',
      entidadeId: usuario.id,
      valorNovo: {
        nome: usuario.nome,
        cpf: usuario.cpf,
        perfil: usuario.perfil,
        matricula: usuario.matricula,
      },
    });

    return { usuario, senhaTemporaria };
  },
});

export const editar = definirAcao<EntradaEditarUsuario, UsuarioDaListagem>({
  nome: 'usuario.editar',
  perfis: ['ADMIN'],
  esquema: esquemaEditarUsuario,
  executar: async (dados, contexto) => {
    const atual = await buscarPorId(contexto.tx, dados.id);
    if (!atual) throw new ErroNaoEncontrado('Usuário não encontrado.');

    // RN011 — ninguém altera o próprio perfil de acesso. Sem isto, o único
    // administrador poderia se rebaixar e trancar todo mundo para fora.
    if (dados.id === contexto.usuario.id && dados.perfil !== atual.perfil) {
      throw new ErroDeConflito(
        CodigoErro.ACAO_SOBRE_PROPRIA_CONTA,
        'Você não pode alterar o seu próprio perfil de acesso.',
        { perfil: 'Alteração não permitida.' },
      );
    }

    // RN010 — rebaixar o último administrador tem o mesmo efeito de removê-lo.
    if (atual.perfil === 'ADMIN' && dados.perfil !== 'ADMIN') {
      const administradores = await contarAdministradoresAtivos(contexto.tx);
      if (administradores <= 1) {
        throw new ErroDeConflito(
          CodigoErro.ULTIMO_ADMINISTRADOR,
          'Não é possível remover o último administrador do sistema.',
          { perfil: 'Alteração não permitida.' },
        );
      }
    }

    const temHistorico = await possuiRegistrosOperacionais(contexto.tx, dados.id);

    if (dados.cpf && dados.cpf !== atual.cpf) {
      if (temHistorico) {
        throw new ErroDeConflito(
          CodigoErro.CONFLITO,
          'O CPF não pode ser alterado: este usuário já possui registros de jornada.',
          { cpf: 'Alteração bloqueada por haver histórico.' },
        );
      }
      if (await existeOutroComCpf(contexto.tx, dados.cpf, dados.id)) {
        throw new ErroDeConflito(
          CodigoErro.CPF_DUPLICADO,
          'Já existe um usuário ativo com este CPF.',
          { cpf: 'CPF já cadastrado.' },
        );
      }
    }

    const atualizado = await atualizarUsuario(contexto.tx, dados.id, {
      nome: dados.nome,
      ...(dados.cpf && !temHistorico ? { cpf: dados.cpf } : {}),
      telefone: dados.telefone,
      perfil: dados.perfil,
      matricula: ouNulo(dados.matricula),
      email: ouNulo(dados.email),
      cnhNumero: dados.perfil === 'MOTORISTA' ? ouNulo(dados.cnhNumero) : null,
      cnhCategoria: dados.perfil === 'MOTORISTA' ? ouNulo(dados.cnhCategoria) : null,
      cnhValidade: dados.perfil === 'MOTORISTA' ? dataOuNulo(dados.cnhValidade) : null,
      atualizadoPor: contexto.usuario.id,
    });

    // O delta é calculado na auditoria: só os campos que mudaram entram (RN026).
    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'usuario',
      entidadeId: dados.id,
      valorAnterior: {
        nome: atual.nome,
        cpf: atual.cpf,
        telefone: atual.telefone,
        perfil: atual.perfil,
        matricula: atual.matricula,
        email: atual.email,
      },
      valorNovo: {
        nome: atualizado.nome,
        cpf: atualizado.cpf,
        telefone: atualizado.telefone,
        perfil: atualizado.perfil,
        matricula: atualizado.matricula,
        email: ouNulo(dados.email),
      },
    });

    if (atual.perfil !== atualizado.perfil) {
      // Mudança de perfil altera o que a pessoa pode fazer; a sessão aberta
      // ainda carregaria as permissões antigas até expirar.
      await encerrarSessoesDoUsuario(dados.id);
    }

    return atualizado;
  },
});

// ----------------------------------------------------------------- status

export const mudarStatus = definirAcao<EntradaAlterarStatus, { status: string }>({
  nome: 'usuario.mudar-status',
  perfis: ['ADMIN'],
  esquema: esquemaAlterarStatus,
  executar: async (dados, contexto) => {
    const atual = await buscarPorId(contexto.tx, dados.id);
    if (!atual) throw new ErroNaoEncontrado('Usuário não encontrado.');

    if (atual.status === dados.status) {
      throw new ErroDeConflito(
        CodigoErro.CONFLITO,
        `Este usuário já está com o status ${dados.status.toLowerCase()}.`,
      );
    }

    // Reativar não tira ninguém do ar: as proteções de RN010/RN011 valem apenas
    // para as transições que retiram acesso.
    if (dados.status !== 'ATIVO') {
      validarAcaoAdministrativa({
        idAlvo: dados.id,
        perfilAlvo: atual.perfil,
        idExecutor: contexto.usuario.id,
        administradoresAtivos: await contarAdministradoresAtivos(contexto.tx),
      });
    }

    await alterarStatus(contexto.tx, dados.id, dados.status, contexto.usuario.id);

    contexto.auditar({
      acao: dados.status === 'EXCLUIDO' ? 'EXCLUIR' : 'ATUALIZAR',
      entidade: 'usuario',
      entidadeId: dados.id,
      valorAnterior: { status: atual.status },
      valorNovo: { status: dados.status },
      justificativa: ouNulo(dados.motivo),
    });

    // RN006 — a perda de acesso precisa valer agora, não quando a sessão expirar.
    if (dados.status !== 'ATIVO') {
      await encerrarSessoesDoUsuario(dados.id);
    }

    return { status: dados.status };
  },
});

export const redefinirSenha = definirAcao<{ id: string }, { senhaTemporaria: string }>({
  nome: 'usuario.redefinir-senha',
  perfis: ['ADMIN'],
  esquema: esquemaRedefinirSenha,
  executar: async ({ id }, contexto) => {
    const usuario = await buscarPorId(contexto.tx, id);
    if (!usuario) throw new ErroNaoEncontrado('Usuário não encontrado.');

    if (usuario.status === 'EXCLUIDO') {
      throw new ErroDeConflito(
        CodigoErro.CONFLITO,
        'Não é possível redefinir a senha de um usuário excluído.',
      );
    }

    const senhaTemporaria = gerarSenhaTemporaria(10);

    await definirSenhaTemporaria(
      contexto.tx,
      id,
      await gerarHashDeSenha(senhaTemporaria),
      expiracaoDaSenhaTemporaria(new Date()),
      contexto.usuario.id,
    );

    // O valor da senha nunca entra na trilha — só o fato de ter sido redefinida.
    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'usuario',
      entidadeId: id,
      valorAnterior: { senhaRedefinidaPeloAdministrador: false },
      valorNovo: { senhaRedefinidaPeloAdministrador: true },
    });

    await encerrarSessoesDoUsuario(id);

    return { senhaTemporaria };
  },
});

// ----------------------------------------------------------------- perfil

export const meuPerfil = definirAcao<void, NonNullable<Awaited<ReturnType<typeof buscarPerfil>>>>({
  nome: 'usuario.meu-perfil',
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const perfil = await buscarPerfil(contexto.tx, contexto.usuario.id);
    if (!perfil) throw new ErroNaoEncontrado();
    return perfil;
  },
});
