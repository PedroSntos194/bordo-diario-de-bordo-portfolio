import { z } from 'zod';
import { TURNOS_DA_ESCALA } from '@/modulos/escala/escala.regras';

/** Contratos de entrada da escala (US014 · RF013). */

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const esquemaDiaDaEscala = z.object({
  data: z.string().regex(DATA, 'Data inválida.').date('Data inválida.').optional(),
});

export type EntradaDiaDaEscala = z.infer<typeof esquemaDiaDaEscala>;

export const esquemaCriarEscala = z.object({
  data: z.string().regex(DATA, 'Escolha o dia.').date('Data inválida.'),
  motoristaId: z.string().uuid('Escolha o motorista.'),
  veiculoId: z.string().uuid('Escolha a van.'),
  turno: z.enum(TURNOS_DA_ESCALA, {
    errorMap: () => ({ message: 'Escolha o turno.' }),
  }),
  /**
   * Uma ou mais rotas (RF013). Pode vir vazio: escalar motorista e van sem
   * definir a rota é um caso real — o roteiro do dia às vezes só se sabe na
   * hora, e a escala continua útil pelo veículo.
   */
  rotaIds: z.array(z.string().uuid()).max(20, 'Máximo de 20 rotas por escala.').default([]),
});

export type EntradaCriarEscala = z.infer<typeof esquemaCriarEscala>;

export const esquemaRemoverEscala = z.object({ id: z.string().uuid() });

export type EntradaRemoverEscala = z.infer<typeof esquemaRemoverEscala>;

export const esquemaRegistrarFolga = z.object({
  data: z.string().date('Escolha uma data válida.'),
  motoristaId: z.string().uuid('Escolha o motorista.'),
  observacoes: z.string().trim().max(240).optional(),
});
export type EntradaRegistrarFolga = z.infer<typeof esquemaRegistrarFolga>;

export const esquemaRepetirEscala = z.object({
  dataOrigem: z.string().regex(DATA, 'Data inválida.').date('Data inválida.'),
  ate: z.string().regex(DATA, 'Escolha até quando repetir.').date('Data inválida.'),
  diasDaSemana: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Marque pelo menos um dia da semana.')
    .max(7),
});
export type EntradaRepetirEscala = z.infer<typeof esquemaRepetirEscala>;
