import { z } from 'zod';

/** Contratos das notificações (doc 16 · RF025, RF027). */

export const esquemaResumoDoDia = z.object({
  jornadaId: z.string().uuid('Jornada inválida.'),
});

export type EntradaResumoDoDia = z.infer<typeof esquemaResumoDoDia>;

/**
 * Confirmação do envio pelo motorista (V-05a).
 *
 * Existe porque no canal de link quem dispara a mensagem é o aplicativo do
 * WhatsApp, fora do alcance do servidor. Sem esta confirmação a notificação
 * ficaria eternamente pendente, e o administrador não teria como distinguir
 * "o motorista não enviou" de "o sistema não sabe".
 */
export const esquemaConfirmarEnvio = z.object({
  notificacaoId: z.string().uuid('Notificação inválida.'),
});

export type EntradaConfirmarEnvio = z.infer<typeof esquemaConfirmarEnvio>;
