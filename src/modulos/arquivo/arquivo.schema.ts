import { z } from 'zod';
import { esquemaPaginacao } from '@/lib/paginacao';

/** Contratos de consulta e download de arquivos (RF036 · US033, US034). */

export const TIPOS_DE_ARQUIVO = [
  'RELATORIO_DIARIO',
  'EXPORTACAO',
  'IMPORTACAO',
  'RELATORIO_ERROS',
  'FECHAMENTO_MENSAL',
] as const;

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const esquemaListarArquivos = esquemaPaginacao.extend({
  tipo: z.enum(TIPOS_DE_ARQUIVO).optional(),
  /** Período de **geração** do arquivo, não do conteúdo (US034). */
  dataInicio: z.string().regex(DATA, 'Data inválida.').optional(),
  dataFim: z.string().regex(DATA, 'Data inválida.').optional(),
});

export type EntradaListarArquivos = z.infer<typeof esquemaListarArquivos>;

export const esquemaBaixarArquivo = z.object({ id: z.string().uuid() });

export type EntradaBaixarArquivo = z.infer<typeof esquemaBaixarArquivo>;
