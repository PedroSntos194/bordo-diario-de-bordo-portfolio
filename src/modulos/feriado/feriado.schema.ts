import { z } from 'zod';

/** Contratos de entrada dos feriados. */

export const esquemaAnoDosFeriados = z.object({
  ano: z.coerce.number().int().min(2020).max(2100).optional(),
});
export type EntradaAnoDosFeriados = z.infer<typeof esquemaAnoDosFeriados>;

export const esquemaCriarFeriado = z.object({
  data: z.string().date('Escolha uma data válida.'),
  nome: z.string().trim().min(2, 'Informe o nome do feriado.').max(80, 'Use até 80 caracteres.'),
});
export type EntradaCriarFeriado = z.infer<typeof esquemaCriarFeriado>;

export const esquemaRemoverFeriado = z.object({ id: z.string().uuid() });
export type EntradaRemoverFeriado = z.infer<typeof esquemaRemoverFeriado>;

export const esquemaNacionaisDoAno = z.object({
  ano: z.coerce.number().int().min(2020).max(2100),
});
export type EntradaNacionaisDoAno = z.infer<typeof esquemaNacionaisDoAno>;
