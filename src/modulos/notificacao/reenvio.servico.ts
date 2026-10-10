import { z } from 'zod';
import { definirAcao, type ContextoDaAcao } from '@/lib/acao-segura';
import { env } from '@/lib/env';
import { CodigoErro, ErroDeConflito, ErroNaoEncontrado, ehErroDaAplicacao } from '@/lib/erros';
import { logger } from '@/lib/logger';
import {
  montarPagina,
  paraIntervalo,
  esquemaPaginacao,
  type DadosPaginados,
} from '@/lib/paginacao';
import {
  buscarNotificacaoPorId,
  buscarParaEnvio,
  contarQueRequeremAtencao,
  falhasReenviaveis,
  listarNotificacoes,
  registrarTentativa,
} from '@/modulos/notificacao/notificacao.repositorio';
import {
  MAX_TENTATIVAS,
  elegivelParaReenvioAutomatico,
  podeReenviarManualmente,
} from '@/modulos/notificacao/reenvio.regras';
import { notificadorWhatsApp } from '@/modulos/notificacao/whatsapp';

/**
 * Fila de notificações: consulta, reenvio manual e reenvio automático
 * (US037 · RF027 · RN028).
 *
 * **O servidor só consegue reenviar sozinho no canal `cloud`.** No `link`
 * (V-05a, o padrão do MVP) quem dispara é o aplicativo do motorista, e o
 * "reenvio" que o administrador aciona aqui devolve o mesmo link `wa.me` para
 * ele mandar — o que resolve o caso real: o motorista foi embora sem enviar e a
 * administração quer o resumo assim mesmo.
 */

const servidorEnvia = env.WHATSAPP_CANAL === 'cloud';

export const esquemaListarFila = esquemaPaginacao.extend({
  status: z.enum(['PENDENTE', 'ENVIADA', 'FALHA', 'CANCELADA']).optional(),
});

type EntradaListarFila = z.infer<typeof esquemaListarFila>;

export interface FilaDeNotificacoes extends DadosPaginados<
  Awaited<ReturnType<typeof listarNotificacoes>>['notificacoes'][number]
> {
  requeremAtencao: number;
  /** A instalação envia sozinha, ou depende do toque do motorista? */
  envioAutomatico: boolean;
}

export const listarFila = definirAcao<EntradaListarFila, FilaDeNotificacoes>({
  nome: 'notificacao.listar-fila',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaListarFila,
  executar: async (filtros, contexto) => {
    const { skip, take } = paraIntervalo(filtros);

    const [{ notificacoes, total }, requeremAtencao] = await Promise.all([
      listarNotificacoes(contexto.tx, {
        ...(filtros.status ? { status: filtros.status } : {}),
        skip,
        take,
      }),
      contarQueRequeremAtencao(contexto.tx, MAX_TENTATIVAS),
    ]);

    return {
      ...montarPagina(notificacoes, total, filtros),
      requeremAtencao,
      envioAutomatico: servidorEnvia,
    };
  },
});

export interface ResultadoDoReenvio {
  situacao: 'ENVIADA' | 'PREPARADA' | 'FALHA';
  /** No canal de link, o endereço para o administrador abrir e mandar. */
  url: string | null;
  mensagem: string;
}

/** Uma tentativa de envio, compartilhada pelo manual e pelo automático. */
async function tentarEnviar(
  contexto: ContextoDaAcao,
  notificacao: { id: string; conteudo: string; destinatarioTelefone: string | null },
): Promise<ResultadoDoReenvio> {
  if (!notificacao.destinatarioTelefone) {
    await registrarTentativa(contexto.tx, notificacao.id, {
      sucesso: false,
      erro: 'Notificação sem telefone de destino.',
    });
    return {
      situacao: 'FALHA',
      url: null,
      mensagem: 'Esta notificação não tem telefone de destino. Corrija o cadastro do destinatário.',
    };
  }

  try {
    const resultado = await notificadorWhatsApp.enviar({
      telefoneE164: notificacao.destinatarioTelefone,
      texto: notificacao.conteudo,
    });

    if (resultado.situacao === 'ENVIADA') {
      await registrarTentativa(contexto.tx, notificacao.id, { sucesso: true });
      return { situacao: 'ENVIADA', url: null, mensagem: 'Reenviada com sucesso.' };
    }

    /**
     * Canal de link: o servidor preparou, mas **não enviou**.
     *
     * A tentativa não é contabilizada como falha nem como sucesso — não houve
     * envio, houve preparo. Marcar sucesso aqui seria mentir na trilha; marcar
     * falha faria a notificação esgotar tentativas sem ninguém ter tentado.
     */
    return {
      situacao: 'PREPARADA',
      url: resultado.url,
      mensagem: 'Mensagem pronta. Abra o WhatsApp para enviar.',
    };
  } catch (erro) {
    const detalhe = ehErroDaAplicacao(erro) ? erro.message : 'Falha inesperada no envio.';
    await registrarTentativa(contexto.tx, notificacao.id, { sucesso: false, erro: detalhe });
    return { situacao: 'FALHA', url: null, mensagem: detalhe };
  }
}

export const reenviar = definirAcao<{ id: string }, ResultadoDoReenvio>({
  nome: 'notificacao.reenviar',
  perfis: ['ADMIN'],
  esquema: z.object({ id: z.string().uuid() }),
  executar: async ({ id }, contexto) => {
    const notificacao = await buscarNotificacaoPorId(contexto.tx, id);
    if (!notificacao) throw new ErroNaoEncontrado('Notificação não encontrada.');

    if (!podeReenviarManualmente(notificacao.status)) {
      throw new ErroDeConflito(
        CodigoErro.CONFLITO,
        notificacao.status === 'ENVIADA'
          ? 'Esta notificação já foi enviada.'
          : 'Esta notificação foi cancelada.',
      );
    }

    const completa = await buscarParaEnvio(contexto.tx, id);
    if (!completa) throw new ErroNaoEncontrado('Notificação não encontrada.');

    const resultado = await tentarEnviar(contexto, completa);

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'notificacao',
      entidadeId: id,
      valorAnterior: { status: notificacao.status },
      valorNovo: { reenvioManual: true, situacao: resultado.situacao },
    });

    return resultado;
  },
});

/**
 * Passagem automática da fila, chamada pelo agendador a cada 5 minutos
 * (doc 13).
 *
 * Em instalação com canal `link` ela **não faz nada**, e isso é correto: não há
 * o que o servidor possa tentar sozinho. O log diz isso explicitamente para que
 * ninguém procure defeito onde há decisão.
 */
export const processarFila = definirAcao<void, { tentadas: number; enviadas: number }>({
  nome: 'notificacao.processar-fila',
  sistema: true,
  executar: async (_dados, contexto) => {
    if (!servidorEnvia) {
      logger.info('notificacao.fila.ignorada', {
        motivo: 'canal de link — quem envia é o aplicativo do motorista (V-05a)',
      });
      return { tentadas: 0, enviadas: 0 };
    }

    const candidatas = await falhasReenviaveis(contexto.tx, MAX_TENTATIVAS);
    const agora = new Date();
    let tentadas = 0;
    let enviadas = 0;

    for (const candidata of candidatas) {
      const elegivel = elegivelParaReenvioAutomatico({
        status: candidata.status,
        tentativas: candidata.tentativas,
        ultimaTentativaEm: candidata.atualizadoEm,
        agora,
        servidorEnvia,
      });

      if (!elegivel) continue;

      tentadas += 1;
      const resultado = await tentarEnviar(contexto, candidata);
      if (resultado.situacao === 'ENVIADA') enviadas += 1;
    }

    logger.info('notificacao.fila.processada', { tentadas, enviadas });

    return { tentadas, enviadas };
  },
});
