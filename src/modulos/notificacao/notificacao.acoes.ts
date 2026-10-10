'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import {
  confirmarEnvioDoResumo,
  prepararResumoDoDia,
  type ResumoPreparado,
} from '@/modulos/notificacao/notificacao.servico';
import { reenviar, type ResultadoDoReenvio } from '@/modulos/notificacao/reenvio.servico';

/** Server Actions do envio do resumo do dia (US036). */

export async function prepararResumo(dados: unknown): Promise<Resultado<ResumoPreparado>> {
  return prepararResumoDoDia(dados);
}

export async function confirmarEnvio(dados: unknown): Promise<Resultado<{ ok: true }>> {
  const resultado = await confirmarEnvioDoResumo(dados);
  if (resultado.sucesso) revalidatePath('/app');
  return resultado;
}

export async function reenviarNotificacao(dados: unknown): Promise<Resultado<ResultadoDoReenvio>> {
  const resultado = await reenviar(dados);
  if (resultado.sucesso) revalidatePath('/admin/notificacoes');
  return resultado;
}
