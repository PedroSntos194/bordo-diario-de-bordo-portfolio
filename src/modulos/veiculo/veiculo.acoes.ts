'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import type { DadosPaginados } from '@/lib/paginacao';
import {
  criar as criarServico,
  disponiveis as disponiveisServico,
  editar as editarServico,
  listar as listarServico,
  mudarStatus as mudarStatusServico,
  obter as obterServico,
  salvarContrato as salvarContratoServico,
} from '@/modulos/veiculo/veiculo.servico';
import type { Veiculo, VeiculoDisponivel } from '@/modulos/veiculo/veiculo.repositorio';

/** Server Actions de veículos (US011). */

export async function listarVeiculos(
  filtros: unknown,
): Promise<Resultado<DadosPaginados<Veiculo> & { totalCadastrado: number }>> {
  return listarServico(filtros);
}

export async function obterVeiculo(dados: unknown): Promise<Resultado<Veiculo>> {
  return obterServico(dados);
}

export async function veiculosDisponiveis(): Promise<Resultado<VeiculoDisponivel[]>> {
  return disponiveisServico();
}

export async function criarVeiculo(dados: unknown): Promise<Resultado<Veiculo>> {
  const resultado = await criarServico(dados);
  if (resultado.sucesso) revalidatePath('/admin/veiculos');
  return resultado;
}

export async function editarVeiculo(dados: unknown): Promise<Resultado<Veiculo>> {
  const resultado = await editarServico(dados);
  if (resultado.sucesso) revalidatePath('/admin/veiculos');
  return resultado;
}

export async function mudarStatusVeiculo(dados: unknown): Promise<Resultado<{ status: string }>> {
  const resultado = await mudarStatusServico(dados);
  if (resultado.sucesso) revalidatePath('/admin/veiculos');
  return resultado;
}

/** Contrato da van para o boletim de medição. Muda o fechamento: revalida a tela dele. */
export async function salvarContratoDaVan(dados: unknown): Promise<Resultado<{ ok: true }>> {
  const resultado = await salvarContratoServico(dados);
  if (resultado.sucesso) {
    revalidatePath('/admin/veiculos');
    revalidatePath('/admin/fechamento');
  }
  return resultado;
}
