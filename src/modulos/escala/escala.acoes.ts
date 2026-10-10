'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import {
  desfazerEscala,
  escalar,
  registrarFolga,
  removerFolga,
  repetirEscala,
  type ResultadoDaRepeticao,
} from '@/modulos/escala/escala.servico';

/** Server Actions da escala (US014). */

export async function criarEscalaDoDia(dados: unknown): Promise<Resultado<{ id: string }>> {
  const resultado = await escalar(dados);
  if (resultado.sucesso) revalidatePath('/admin/escala');
  return resultado;
}

export async function removerEscalaDoDia(dados: unknown): Promise<Resultado<{ ok: true }>> {
  const resultado = await desfazerEscala(dados);
  if (resultado.sucesso) revalidatePath('/admin/escala');
  return resultado;
}

export async function registrarFolgaDoDia(dados: unknown): Promise<Resultado<{ id: string }>> {
  const resultado = await registrarFolga(dados);
  if (resultado.sucesso) {
    revalidatePath('/admin/escala');
    revalidatePath('/admin');
    revalidatePath('/admin/pendencias');
    revalidatePath('/admin/preparacao');
  }
  return resultado;
}

export async function removerFolgaDoDia(dados: unknown): Promise<Resultado<{ ok: true }>> {
  const resultado = await removerFolga(dados);
  if (resultado.sucesso) {
    revalidatePath('/admin/escala');
    revalidatePath('/admin');
    revalidatePath('/admin/pendencias');
    revalidatePath('/admin/preparacao');
  }
  return resultado;
}

export async function repetirEscalaDoDia(dados: unknown): Promise<Resultado<ResultadoDaRepeticao>> {
  const resultado = await repetirEscala(dados);
  if (resultado.sucesso) {
    revalidatePath('/admin/escala');
    revalidatePath('/admin');
    revalidatePath('/admin/pendencias');
    revalidatePath('/admin/preparacao');
  }
  return resultado;
}
