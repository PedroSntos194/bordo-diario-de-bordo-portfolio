'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import { desfazer, registrar } from '@/modulos/evento/evento.servico';

/** Server Actions dos eventos da corrida (US021). */

export async function registrarEvento(
  dados: unknown,
): Promise<Resultado<{ id: string; jaExistia: boolean }>> {
  const resultado = await registrar(dados);
  if (resultado.sucesso) revalidatePath('/app');
  return resultado;
}

export async function desfazerEvento(dados: unknown): Promise<Resultado<{ ok: true }>> {
  const resultado = await desfazer(dados);
  if (resultado.sucesso) revalidatePath('/app');
  return resultado;
}
