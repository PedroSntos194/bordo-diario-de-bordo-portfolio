import { z } from 'zod';
import { esquemaPaginacao } from '@/lib/paginacao';
import { dataOperacional, diasNoPeriodo } from '@/utilitarios/data';

/** Contratos de consulta do painel e dos relatórios (US026, US027, US030). */

const DATA = /^\d{4}-\d{2}-\d{2}$/;

const campoData = z.string().regex(DATA, 'Data inválida.').date('Data inválida.');

export const esquemaDia = z.object({
  data: campoData.default(() => dataOperacional()),
});

export type EntradaDia = z.infer<typeof esquemaDia>;

/** O diário permite consultar a frota ou um motorista, mantendo a mesma data do painel. */
export const esquemaResumoDoDia = esquemaDia.extend({
  motoristaId: z.string().uuid().optional(),
});

export type EntradaResumoDoDia = z.infer<typeof esquemaResumoDoDia>;

export const STATUS_JORNADA = ['ABERTA', 'ENCERRADA', 'CANCELADA'] as const;
export const STATUS_CORRIDA = ['EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA'] as const;

/**
 * Período máximo de 12 meses (US027).
 *
 * Não é limitação técnica: é proteção contra a consulta acidental que varre
 * anos inteiros e derruba a tela do administrador enquanto ele espera. Quem
 * precisa de mais que um ano quer um relatório, não uma listagem.
 */
const limitarPeriodo = <T extends { dataInicio?: string; dataFim?: string }>(
  dados: T,
  ctx: z.RefinementCtx,
): void => {
  if (!dados.dataInicio || !dados.dataFim) return;

  if (dados.dataFim < dados.dataInicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dataFim'],
      message: 'A data final não pode ser anterior à inicial.',
    });
    return;
  }

  if (diasNoPeriodo(dados.dataInicio, dados.dataFim) > 366) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dataFim'],
      message: 'Selecione um período de no máximo 12 meses.',
    });
  }
};

/**
 * Campos de filtro da consulta de jornadas, **sem** paginação.
 *
 * Ficam separados porque duas entradas os consomem: a listagem da tela (que
 * pagina) e a exportação em Excel (que não). O critério de aceitação da US032 é
 * que a exportação respeite *exatamente* os filtros aplicados — e a única forma
 * de garantir isso é os dois caminhos partirem do mesmo objeto, não de duas
 * cópias que amanhã divergem.
 */
export const FILTROS_DE_JORNADA = {
  dataInicio: campoData.optional(),
  dataFim: campoData.optional(),
  motoristaId: z.string().uuid().optional(),
  veiculoId: z.string().uuid().optional(),
  status: z.enum(STATUS_JORNADA).optional(),
  ordenar: z.enum(['data', 'motorista', 'kmTotal']).default('data'),
  direcao: z.enum(['asc', 'desc']).default('desc'),
} as const;

/**
 * `.strict()` só do lado da exportação, e de propósito.
 *
 * A listagem lê os filtros da URL, onde sobra parâmetro alheio o tempo todo
 * (`pagina`, âncora, rastreamento) — ali descartar o desconhecido é o certo. Já
 * a exportação recebe um corpo JSON montado por quem chama: um `rotaId` numa
 * exportação de jornadas significa que o cliente **acredita** estar filtrando
 * por rota. Descartar em silêncio devolveria a frota inteira com cara de
 * recorte, que é o pior resultado possível para um relatório.
 */
export const esquemaFiltrarJornadas = z
  .object(FILTROS_DE_JORNADA)
  .strict()
  .superRefine(limitarPeriodo);

export type EntradaFiltrarJornadas = z.infer<typeof esquemaFiltrarJornadas>;

export const esquemaListarJornadas = esquemaPaginacao
  .extend(FILTROS_DE_JORNADA)
  .superRefine(limitarPeriodo);

export type EntradaListarJornadas = z.infer<typeof esquemaListarJornadas>;

/** Mesma divisão da jornada: filtros reaproveitados pela listagem e pela exportação. */
export const FILTROS_DE_CORRIDA = {
  dataInicio: campoData.optional(),
  dataFim: campoData.optional(),
  motoristaId: z.string().uuid().optional(),
  veiculoId: z.string().uuid().optional(),
  rotaId: z.string().uuid().optional(),
  status: z.enum(STATUS_CORRIDA).optional(),
  ordenar: z.enum(['iniciadaEm', 'kmPercorrido']).default('iniciadaEm'),
  direcao: z.enum(['asc', 'desc']).default('desc'),
} as const;

export const esquemaFiltrarCorridas = z
  .object(FILTROS_DE_CORRIDA)
  .strict()
  .superRefine(limitarPeriodo);

export type EntradaFiltrarCorridas = z.infer<typeof esquemaFiltrarCorridas>;

export const esquemaListarCorridas = esquemaPaginacao
  .extend(FILTROS_DE_CORRIDA)
  .superRefine(limitarPeriodo);

export type EntradaListarCorridas = z.infer<typeof esquemaListarCorridas>;
