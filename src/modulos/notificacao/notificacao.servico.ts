import { definirAcao } from '@/lib/acao-segura';
import { env } from '@/lib/env';
import {
  CodigoErro,
  ErroDeConflito,
  ErroDeIntegracao,
  ErroNaoEncontrado,
  ehErroDaAplicacao,
} from '@/lib/erros';
import { logger } from '@/lib/logger';
import { CHAVES, obterValor } from '@/modulos/configuracao/configuracao.repositorio';
import { buscarJornadaCompleta } from '@/modulos/jornada/jornada.repositorio';
import {
  administradoresParaNotificar,
  buscarNotificacaoPorId,
  marcarComoEnviada,
  notificacoesDaJornada,
  registrarNotificacao,
} from '@/modulos/notificacao/notificacao.repositorio';
import {
  escolherDestinatarios,
  montarLinkDaJornada,
  montarMensagemDoResumo,
} from '@/modulos/notificacao/notificacao.regras';
import {
  esquemaConfirmarEnvio,
  esquemaResumoDoDia,
  type EntradaConfirmarEnvio,
  type EntradaResumoDoDia,
} from '@/modulos/notificacao/notificacao.schema';
import { notificadorWhatsApp } from '@/modulos/notificacao/whatsapp';

/**
 * Envio do resumo do dia ao administrador (US036 · RF025 · RN017, RN028).
 *
 * O ponto delicado desta história é o **RN028**: falha de notificação não
 * invalida o encerramento da jornada. Por isso o envio é uma ação separada, e
 * não um efeito colateral dentro de `jornada.encerrar` — se estivesse lá, um
 * WhatsApp fora do ar desfaria a transação e o motorista perderia o
 * encerramento do dia por causa de um serviço externo.
 *
 * A separação também é o que permite reenviar (US037, Sprint 9) sem reabrir a
 * jornada.
 */

export interface ResumoPreparado {
  notificacaoId: string;
  /** Preenchida apenas no canal de link (V-05a): é o que o motorista abre. */
  url: string | null;
  situacao: 'PREPARADA' | 'ENVIADA' | 'FALHA';
  destinatario: string;
  /** Mensagem montada, exibida como prévia antes de o motorista tocar. */
  mensagem: string;
  /** Já houve um envio confirmado antes para esta jornada. */
  jaEnviado: boolean;
}

export const prepararResumoDoDia = definirAcao<EntradaResumoDoDia, ResumoPreparado>({
  nome: 'notificacao.resumo-do-dia',
  esquema: esquemaResumoDoDia,
  executar: async ({ jornadaId }, contexto) => {
    const jornada = await buscarJornadaCompleta(contexto.tx, jornadaId);
    if (!jornada) throw new ErroNaoEncontrado('Jornada não encontrada.');

    // RN009 — jornada de outro motorista responde 404, não 403.
    if (contexto.usuario.perfil !== 'ADMIN' && jornada.motoristaId !== contexto.usuario.id) {
      throw new ErroNaoEncontrado('Jornada não encontrada.');
    }

    // RN017 — só jornada encerrada tem totais confiáveis para consolidar. Enviar
    // o resumo de um dia ainda em curso produziria números que mudam depois.
    if (jornada.status !== 'ENCERRADA') {
      throw new ErroDeConflito(
        CodigoErro.JORNADA_NAO_ENCERRADA,
        'Encerre o dia antes de enviar o resumo ao administrador.',
      );
    }

    const [configurados, administradores, jaRegistradas] = await Promise.all([
      obterValor<string[]>(contexto.tx, CHAVES.destinatariosResumo, []),
      administradoresParaNotificar(contexto.tx),
      notificacoesDaJornada(contexto.tx, jornadaId),
    ]);

    const destinatarios = escolherDestinatarios(configurados, administradores);
    const destino = destinatarios[0];

    if (!destino) {
      throw new ErroDeConflito(
        CodigoErro.CONFLITO,
        'Nenhum administrador com telefone válido cadastrado. Avise a administração.',
      );
    }

    const mensagem = montarMensagemDoResumo(jornada, montarLinkDaJornada(env.APP_URL, jornada.id));

    const jaEnviado = jaRegistradas.some((registro) => registro.status === 'ENVIADA');

    // RN028 — a falha do canal externo vira registro, não exceção que sobe até
    // a tela. O motorista precisa saber que não saiu, mas nada do que ele fez
    // até aqui pode ser desfeito por causa disso.
    let situacao: ResumoPreparado['situacao'];
    let url: string | null = null;
    let erroDoEnvio: string | null = null;

    try {
      const resultado = await notificadorWhatsApp.enviar({
        telefoneE164: destino.telefone,
        texto: mensagem,
      });

      if (resultado.situacao === 'PREPARADA') {
        situacao = 'PREPARADA';
        url = resultado.url;
      } else {
        situacao = 'ENVIADA';
      }
    } catch (erro) {
      situacao = 'FALHA';
      erroDoEnvio =
        erro instanceof ErroDeIntegracao || ehErroDaAplicacao(erro)
          ? erro.message
          : 'Falha inesperada no envio.';
      logger.warn('notificacao.resumo.falhou', { jornadaId, canal: notificadorWhatsApp.canal });
    }

    const notificacao = await registrarNotificacao(contexto.tx, {
      canal: 'WHATSAPP',
      tipo: 'RESUMO_DIA',
      destinatarioUsuarioId: destino.usuarioId,
      destinatarioTelefone: destino.telefone,
      conteudo: mensagem,
      arquivoId: null,
      referenciaTipo: 'jornada',
      referenciaId: jornada.id,
      referenciaChave: null,
      // No canal de link a mensagem ainda não saiu: quem envia é o aplicativo
      // do motorista, e a confirmação vem depois.
      status: situacao === 'ENVIADA' ? 'ENVIADA' : situacao === 'FALHA' ? 'FALHA' : 'PENDENTE',
      enviadaEm: situacao === 'ENVIADA' ? new Date() : null,
      ultimoErro: erroDoEnvio,
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'notificacao',
      entidadeId: notificacao.id,
      valorNovo: {
        tipo: 'RESUMO_DIA',
        canal: notificadorWhatsApp.canal,
        jornadaId: jornada.id,
        situacao,
      },
    });

    return {
      notificacaoId: notificacao.id,
      url,
      situacao,
      destinatario: destino.nome,
      mensagem,
      jaEnviado,
    };
  },
});

/**
 * Confirmação de que o motorista realmente enviou (V-05a).
 *
 * Critério de aceitação da US036: "ao retornar, o motorista confirma o envio e
 * o sistema registra a data/hora". É deliberadamente uma afirmação do usuário,
 * não uma dedução do sistema — no canal de link não há como o servidor observar
 * o envio, e inventar um "enviado" que ninguém verificou seria pior do que
 * assumir a limitação.
 */
export const confirmarEnvioDoResumo = definirAcao<EntradaConfirmarEnvio, { ok: true }>({
  nome: 'notificacao.confirmar-envio',
  esquema: esquemaConfirmarEnvio,
  executar: async ({ notificacaoId }, contexto) => {
    const notificacao = await buscarNotificacaoPorId(contexto.tx, notificacaoId);
    if (!notificacao) throw new ErroNaoEncontrado('Notificação não encontrada.');

    if (
      notificacao.tipo !== 'RESUMO_DIA' ||
      notificacao.referenciaTipo !== 'jornada' ||
      !notificacao.referenciaId
    ) {
      throw new ErroNaoEncontrado('Notificação não encontrada.');
    }

    // A notificação aponta para a jornada; o escopo do motorista é verificado
    // sobre ela, não sobre a notificação — é a jornada que tem dono (RN009).
    const jornada = await buscarJornadaCompleta(contexto.tx, notificacao.referenciaId);
    if (
      !jornada ||
      (contexto.usuario.perfil !== 'ADMIN' && jornada.motoristaId !== contexto.usuario.id)
    ) {
      throw new ErroNaoEncontrado('Notificação não encontrada.');
    }

    if (notificacao.status === 'CANCELADA') {
      throw new ErroDeConflito(
        CodigoErro.CONFLITO,
        'Este resumo foi cancelado. Encerre o dia novamente e envie o novo resumo.',
      );
    }

    if (jornada.status !== 'ENCERRADA') {
      throw new ErroDeConflito(
        CodigoErro.JORNADA_NAO_ENCERRADA,
        'Encerre o dia antes de confirmar o envio do resumo ao administrador.',
      );
    }

    if (notificacao.status === 'ENVIADA') return { ok: true };

    const agora = new Date();
    const confirmada = await marcarComoEnviada(contexto.tx, notificacao.id, agora);
    if (!confirmada) {
      throw new ErroDeConflito(
        CodigoErro.CONFLITO,
        'A situação deste resumo mudou. Atualize a página antes de confirmar o envio.',
      );
    }

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'notificacao',
      entidadeId: notificacao.id,
      valorAnterior: { status: notificacao.status },
      valorNovo: { status: 'ENVIADA', enviadaEm: agora },
    });

    return { ok: true };
  },
});
