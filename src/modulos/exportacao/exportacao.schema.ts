import { z } from 'zod';
import {
  esquemaResumoDoDia,
  esquemaFiltrarCorridas,
  esquemaFiltrarJornadas,
} from '@/modulos/relatorio/relatorio.schema';

/**
 * Entrada da exportação em Excel (US032 · doc 16 · `POST /api/exportacoes`).
 *
 * União discriminada por `tipo`: cada relatório carrega **o seu** conjunto de
 * filtros, validado a partir dos mesmos campos que a tela correspondente usa.
 * Um `filtros` genérico aceitaria `rotaId` numa exportação de jornadas e o
 * ignoraria em silêncio — e "a exportação respeita exatamente os filtros
 * aplicados" deixaria de ser verdade sem ninguém perceber.
 *
 * Os esquemas são `strict()`: filtro fora de lugar vira 400 com o campo
 * apontado, não descarte silencioso. Ver a nota em `relatorio.schema.ts`.
 */
export const esquemaExportar = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('JORNADAS'), filtros: esquemaFiltrarJornadas.default({}) }),
  z.object({ tipo: z.literal('CORRIDAS'), filtros: esquemaFiltrarCorridas.default({}) }),
  z.object({ tipo: z.literal('RESUMO_DIA'), filtros: esquemaResumoDoDia.strict().default({}) }),
]);

export type EntradaExportar = z.infer<typeof esquemaExportar>;
