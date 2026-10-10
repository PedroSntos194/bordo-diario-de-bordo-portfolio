import { z } from 'zod';

/** Erro relatado pelo próprio aparelho (suporte ao piloto). */
export const esquemaErroDoCliente = z.object({
  mensagem: z.string().trim().min(1).max(500),
  pilha: z.string().max(4000).optional(),
  caminho: z.string().max(200),
  navegador: z.string().max(300).optional(),
  versao: z.string().max(40).optional(),
  online: z.boolean().optional(),
});

export type EntradaErroDoCliente = z.infer<typeof esquemaErroDoCliente>;
