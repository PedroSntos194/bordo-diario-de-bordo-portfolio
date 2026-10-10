import { definirAcao } from '@/lib/acao-segura';
import { logger } from '@/lib/logger';
import { CHAVES, obterValor } from '@/modulos/configuracao/configuracao.repositorio';
import { escolherDestinatarios } from '@/modulos/notificacao/notificacao.regras';
import {
  administradoresParaNotificar,
  registrarNotificacao,
} from '@/modulos/notificacao/notificacao.repositorio';
import { avisoDeErroJaRegistrado } from '@/modulos/suporte/suporte.repositorio';
import { chaveDoErro, descreverTela, encurtar } from '@/modulos/suporte/suporte.regras';
import { esquemaErroDoCliente, type EntradaErroDoCliente } from '@/modulos/suporte/suporte.schema';
import { dataOperacional } from '@/utilitarios/data';

/**
 * Suporte ao uso real: para quem o motorista pede ajuda e o que acontece quando
 * o aparelho dele relata um erro.
 */

export interface ContatoDoSuporte {
  nome: string;
  telefone: string;
}

/**
 * Quem atende o "Algo deu errado?".
 *
 * O mesmo destinatário do resumo do dia: o primeiro telefone de
 * `destinatarios_resumo` e, sem ele, o primeiro administrador ativo com número
 * válido. O motorista já manda o resumo para esse número todo dia — não é um
 * dado novo saindo para ele.
 */
export const contatoDoSuporte = definirAcao<void, ContatoDoSuporte | null>({
  nome: 'suporte.contato',
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const [configurados, administradores] = await Promise.all([
      obterValor<string[]>(contexto.tx, CHAVES.destinatariosResumo, []),
      administradoresParaNotificar(contexto.tx),
    ]);
    const primeiro = escolherDestinatarios(configurados, administradores)[0];
    return primeiro ? { nome: primeiro.nome, telefone: primeiro.telefone } : null;
  },
});

/**
 * Erro relatado pelo aparelho.
 *
 * Todo relato vai para o log da hospedagem. O administrador recebe **um** aviso
 * interno por defeito por dia (`chaveDoErro`), no mesmo lugar das outras falhas
 * do sistema — o suficiente para saber que algo quebrou antes de o motorista
 * reclamar, sem uma notificação por toque.
 *
 * Aceita usuário com pendência de primeiro acesso: é justamente quem está nas
 * telas de troca de senha e de aceite, e um erro ali também precisa chegar.
 */
export const registrarErroDoCliente = definirAcao<EntradaErroDoCliente, { avisado: boolean }>({
  nome: 'suporte.erro-do-cliente',
  esquema: esquemaErroDoCliente,
  permitePendencias: true,
  executar: async (dados, contexto) => {
    const tela = descreverTela(dados.caminho);

    logger.error('cliente.erro', {
      usuarioId: contexto.usuario.id,
      perfil: contexto.usuario.perfil,
      tela,
      caminho: dados.caminho,
      mensagem: dados.mensagem,
      pilha: dados.pilha ? encurtar(dados.pilha, 2000) : undefined,
      navegador: dados.navegador,
      versao: dados.versao,
      online: dados.online,
    });

    const chave = chaveDoErro(dataOperacional(), dados.mensagem);
    if (await avisoDeErroJaRegistrado(contexto.tx, chave)) return { avisado: false };

    const [configurados, administradores] = await Promise.all([
      obterValor<string[]>(contexto.tx, CHAVES.destinatariosResumo, []),
      administradoresParaNotificar(contexto.tx),
    ]);
    const destinatario = escolherDestinatarios(configurados, administradores).find(
      (item) => item.usuarioId !== null,
    );

    const resumo =
      `Erro no aparelho de ${contexto.usuario.nome}, na tela ${tela}: ` +
      encurtar(dados.mensagem, 300);

    await registrarNotificacao(contexto.tx, {
      canal: 'INTERNA',
      tipo: 'FALHA_SISTEMA',
      destinatarioUsuarioId: destinatario?.usuarioId ?? administradores[0]?.id ?? null,
      destinatarioTelefone: null,
      conteudo: resumo,
      arquivoId: null,
      referenciaTipo: 'erro-cliente',
      referenciaId: null,
      referenciaChave: chave,
      status: 'PENDENTE',
      enviadaEm: null,
      // A tela de notificações mostra este campo, não o conteúdo — como no
      // aviso de falha do consolidado. A pilha técnica fica só no log.
      ultimoErro: resumo,
    });

    return { avisado: true };
  },
});
