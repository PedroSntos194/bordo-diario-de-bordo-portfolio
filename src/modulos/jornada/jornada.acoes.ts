'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import {
  abrir as abrirServico,
  meuDia as meuDiaServico,
  reabrir as reabrirServico,
  type EstadoDoDia,
} from '@/modulos/jornada/jornada.servico';

/** Server Actions da jornada (US016). */

export async function estadoDoMeuDia(): Promise<Resultado<EstadoDoDia>> {
  return meuDiaServico();
}

export async function abrirJornada(
  dados: unknown,
): Promise<Resultado<{ id: string; jaExistia: boolean }>> {
  const resultado = await abrirServico(dados);
  if (resultado.sucesso) revalidatePath('/app');
  return resultado;
}

/** "Reabrir o dia" na tela da jornada, pela administração. */
export async function reabrirJornada(dados: unknown): Promise<Resultado<{ id: string }>> {
  const resultado = await reabrirServico(dados);
  if (resultado.sucesso) {
    revalidatePath(`/admin/jornadas/${resultado.dados.id}`);
    revalidatePath('/admin');
    revalidatePath('/app');
  }
  return resultado;
}
