import { env } from '@/lib/env';
import { ErroDeIntegracao } from '@/lib/erros';
import { logger } from '@/lib/logger';
import { montarLinkWaMe } from '@/modulos/notificacao/notificacao.regras';

/**
 * Canal de WhatsApp (V-05 · doc 13 — `NotificadorWhatsApp`).
 *
 * **Este é o único arquivo que muda quando o cliente responder o V-05.**
 *
 * As duas abordagens levantadas são funcionalmente diferentes na ponta, e a
 * interface é desenhada para conter essa diferença em um só lugar:
 *
 * - `link` (V-05a, padrão do MVP): o servidor **prepara** a mensagem e devolve
 *   um `wa.me`; quem dispara é o usuário, no aplicativo dele. Custo zero, sem
 *   aprovação da Meta, sem número dedicado.
 * - `cloud` (V-05b): o servidor **envia** pela Cloud API oficial. Exige Meta
 *   Business verificado, número dedicado, template aprovado e custo por
 *   conversa — e o processo de aprovação leva semanas.
 *
 * O que o caso de uso enxerga é o mesmo `enviar()` nos dois casos. A diferença
 * aparece só no `resultado`: `PREPARADA` (falta o toque do usuário) ou
 * `ENVIADA` (o servidor concluiu). A interface de encerramento da jornada não
 * distingue os dois — critério de aceitação explícito da US036.
 */

export interface MensagemParaEnvio {
  telefoneE164: string;
  texto: string;
}

export type ResultadoDoEnvio =
  /** O servidor montou o link; o envio depende de o usuário confirmar. */
  | { situacao: 'PREPARADA'; url: string }
  /** O servidor entregou a mensagem ao provedor. */
  | { situacao: 'ENVIADA'; idExterno: string | null };

export interface NotificadorWhatsApp {
  readonly canal: 'link' | 'cloud';
  enviar(mensagem: MensagemParaEnvio): Promise<ResultadoDoEnvio>;
}

/** V-05a — link `wa.me`. Não faz rede: só monta a URL. */
class NotificadorPorLink implements NotificadorWhatsApp {
  readonly canal = 'link' as const;

  async enviar(mensagem: MensagemParaEnvio): Promise<ResultadoDoEnvio> {
    return {
      situacao: 'PREPARADA',
      url: montarLinkWaMe(mensagem.telefoneE164, mensagem.texto),
    };
  }
}

/**
 * V-05b — Cloud API oficial da Meta.
 *
 * Implementado por antecipação e **não exercitado contra a Meta**: sem conta
 * verificada não há como validar de ponta a ponta. Está aqui para que a virada,
 * quando o cliente decidir, seja mudar `WHATSAPP_CANAL=cloud` e conferir este
 * arquivo — não desenhar a integração do zero no meio da homologação.
 *
 * Detalhe que costuma custar caro na estreia: fora da janela de 24 horas de
 * atendimento, a Meta só aceita **template aprovado**, nunca texto livre. Como
 * o resumo do dia chega sem o administrador ter escrito antes, ele cai sempre
 * fora da janela — por isso o envio usa `template` quando
 * `WHATSAPP_TEMPLATE_RESUMO` está definido.
 */
class NotificadorPorCloudApi implements NotificadorWhatsApp {
  readonly canal = 'cloud' as const;

  private static readonly TEMPO_LIMITE_MS = 10_000;

  async enviar(mensagem: MensagemParaEnvio): Promise<ResultadoDoEnvio> {
    const token = env.WHATSAPP_TOKEN;
    const numeroId = env.WHATSAPP_PHONE_NUMBER_ID;

    // `env.ts` já barra a subida sem estas variáveis quando o canal é `cloud`;
    // a checagem aqui é o que convence o TypeScript e cobre um `.env` alterado
    // em tempo de execução.
    if (!token || !numeroId) {
      throw new ErroDeIntegracao('whatsapp', 'Canal WhatsApp não configurado.');
    }

    const template = env.WHATSAPP_TEMPLATE_RESUMO;
    const destino = mensagem.telefoneE164.replace(/\D/g, '');

    const corpo = template
      ? {
          messaging_product: 'whatsapp',
          to: destino,
          type: 'template',
          template: {
            name: template,
            language: { code: 'pt_BR' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: mensagem.texto }] }],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: destino,
          type: 'text',
          text: { preview_url: false, body: mensagem.texto },
        };

    // Toda integração externa tem tempo limite (RNF015): sem ele, um provedor
    // lento seguraria a transação do encerramento da jornada.
    const cancelamento = AbortSignal.timeout(NotificadorPorCloudApi.TEMPO_LIMITE_MS);

    let resposta: Response;
    try {
      resposta = await fetch(`https://graph.facebook.com/v21.0/${numeroId}/messages`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(corpo),
        signal: cancelamento,
      });
    } catch (erro) {
      throw new ErroDeIntegracao(
        'whatsapp',
        erro instanceof Error && erro.name === 'TimeoutError'
          ? 'O WhatsApp não respondeu a tempo. O registro foi salvo e o envio pode ser refeito.'
          : 'Não foi possível falar com o WhatsApp. O registro foi salvo e o envio pode ser refeito.',
      );
    }

    if (!resposta.ok) {
      // O corpo do erro da Meta traz identificadores da conta; vai para o log,
      // nunca para a tela (doc 18).
      const detalhe = await resposta.text().catch(() => '');
      logger.error('whatsapp.cloud.falhou', {
        status: resposta.status,
        detalhe: detalhe.slice(0, 500),
      });
      throw new ErroDeIntegracao('whatsapp', 'O WhatsApp recusou o envio. Tente reenviar.');
    }

    const dados = (await resposta.json().catch(() => null)) as {
      messages?: { id?: string }[];
    } | null;

    return { situacao: 'ENVIADA', idExterno: dados?.messages?.[0]?.id ?? null };
  }
}

export const notificadorWhatsApp: NotificadorWhatsApp =
  env.WHATSAPP_CANAL === 'cloud' ? new NotificadorPorCloudApi() : new NotificadorPorLink();
