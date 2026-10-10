'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import {
  adicionarNacionais,
  cadastrarFeriado,
  excluirFeriado,
} from '@/modulos/feriado/feriado.servico';

/** Server Actions dos feriados. Feriado muda o fechamento: revalida as duas telas. */

function revalidar(): void {
  revalidatePath('/admin/feriados');
  revalidatePath('/admin/fechamento');
}

export async function cadastrarFeriadoNaTela(dados: unknown): Promise<Resultado<{ id: string }>> {
  const resultado = await cadastrarFeriado(dados);
  if (resultado.sucesso) revalidar();
  return resultado;
}

export async function adicionarNacionaisNaTela(
  dados: unknown,
): Promise<Resultado<{ adicionados: number }>> {
  const resultado = await adicionarNacionais(dados);
  if (resultado.sucesso) revalidar();
  return resultado;
}

export async function excluirFeriadoNaTela(dados: unknown): Promise<Resultado<{ ok: true }>> {
  const resultado = await excluirFeriado(dados);
  if (resultado.sucesso) revalidar();
  return resultado;
}
