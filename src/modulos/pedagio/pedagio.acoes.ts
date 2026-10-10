'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import { registrar } from '@/modulos/pedagio/pedagio.servico';

/** Server Action do pedágio. */
export async function registrarPedagio(dados: unknown): Promise<Resultado<{ id: string }>> {
  const resultado = await registrar(dados);
  if (resultado.sucesso) {
    revalidatePath('/app/pedagio');
    revalidatePath('/admin');
    revalidatePath('/admin/fechamento');
  }
  return resultado;
}
