'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import type { DadosPaginados } from '@/lib/paginacao';
import {
  ativas as ativasServico,
  criar as criarServico,
  editar as editarServico,
  listar as listarServico,
  mudarStatus as mudarStatusServico,
  obter as obterServico,
  salvarPontos as salvarPontosServico,
} from '@/modulos/rota/rota.servico';
import type { Rota, RotaDaListagem } from '@/modulos/rota/rota.repositorio';

/** Server Actions de rotas (US012, US013). */

export async function listarRotas(
  filtros: unknown,
): Promise<Resultado<DadosPaginados<RotaDaListagem> & { totalCadastrado: number }>> {
  return listarServico(filtros);
}

export async function obterRota(dados: unknown) {
  return obterServico(dados);
}

export async function rotasAtivas() {
  return ativasServico();
}

export async function criarRota(dados: unknown): Promise<Resultado<Rota>> {
  const resultado = await criarServico(dados);
  if (resultado.sucesso) revalidatePath('/admin/rotas');
  return resultado;
}

export async function editarRota(dados: unknown): Promise<Resultado<Rota>> {
  const resultado = await editarServico(dados);
  if (resultado.sucesso) revalidatePath('/admin/rotas');
  return resultado;
}

export async function mudarStatusRota(dados: unknown): Promise<Resultado<{ status: string }>> {
  const resultado = await mudarStatusServico(dados);
  if (resultado.sucesso) revalidatePath('/admin/rotas');
  return resultado;
}

export async function salvarPontosDaRota(
  dados: unknown,
): Promise<Resultado<{ quantidade: number }>> {
  const resultado = await salvarPontosServico(dados);
  if (resultado.sucesso) revalidatePath('/admin/rotas');
  return resultado;
}
