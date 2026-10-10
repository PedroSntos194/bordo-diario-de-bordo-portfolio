'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import {
  cancelar as cancelarServico,
  corrigir as corrigirServico,
  encerrar as encerrarServico,
  iniciar as iniciarServico,
  type ResultadoDaCorrecao,
  type ResultadoDoEncerramento,
} from '@/modulos/corrida/corrida.servico';
import {
  encerrar as encerrarJornadaServico,
  type ResumoDoEncerramento,
} from '@/modulos/jornada/jornada.servico';

/** Server Actions da operação em campo (US017, US018, US019, US020). */

export async function iniciarCorrida(
  dados: unknown,
): Promise<Resultado<{ id: string; jaExistia: boolean }>> {
  const resultado = await iniciarServico(dados);
  if (resultado.sucesso) revalidatePath('/app');
  return resultado;
}

export async function encerrarCorrida(dados: unknown): Promise<Resultado<ResultadoDoEncerramento>> {
  const resultado = await encerrarServico(dados);
  if (resultado.sucesso) revalidatePath('/app');
  return resultado;
}

export async function cancelarCorrida(dados: unknown): Promise<Resultado<{ ok: true }>> {
  const resultado = await cancelarServico(dados);
  if (resultado.sucesso) revalidatePath('/app');
  return resultado;
}

export async function encerrarJornada(dados: unknown): Promise<Resultado<ResumoDoEncerramento>> {
  const resultado = await encerrarJornadaServico(dados);
  if (resultado.sucesso) revalidatePath('/app');
  return resultado;
}

export async function corrigirCorrida(dados: unknown): Promise<Resultado<ResultadoDaCorrecao>> {
  const resultado = await corrigirServico(dados);
  if (resultado.sucesso) {
    revalidatePath('/app');
    revalidatePath('/admin/corridas');
  }
  return resultado;
}
