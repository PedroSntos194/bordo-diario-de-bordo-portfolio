'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import { registrar } from '@/modulos/ocorrencia/ocorrencia.servico';

/** Server Action do registro de ocorrência (US023). */
export async function registrarOcorrencia(dados: unknown): Promise<Resultado<{ id: string }>> {
  const resultado = await registrar(dados);
  if (resultado.sucesso) revalidatePath('/app');
  return resultado;
}
