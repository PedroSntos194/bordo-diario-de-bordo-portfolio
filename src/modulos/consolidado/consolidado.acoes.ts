'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import {
  gerarConsolidadoAgora,
  type ConsolidadoGerado,
} from '@/modulos/consolidado/consolidado.servico';

/** Server Action da geração manual do consolidado (US033). */
export async function gerarConsolidado(dados: unknown): Promise<Resultado<ConsolidadoGerado>> {
  const resultado = await gerarConsolidadoAgora(dados);
  if (resultado.sucesso) revalidatePath('/admin/arquivos');
  return resultado;
}
