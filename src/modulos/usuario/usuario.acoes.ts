'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import type { DadosPaginados } from '@/lib/paginacao';
import {
  criar as criarServico,
  editar as editarServico,
  listar as listarServico,
  meuPerfil as meuPerfilServico,
  mudarStatus as mudarStatusServico,
  obter as obterServico,
  redefinirSenha as redefinirSenhaServico,
  type UsuarioCriado,
} from '@/modulos/usuario/usuario.servico';
import type { UsuarioDaListagem } from '@/modulos/usuario/usuario.repositorio';

/**
 * Server Actions de usuários (US004 a US009).
 *
 * As ações de escrita invalidam o cache da listagem: sem isso, o administrador
 * cadastra alguém, volta para a lista e não vê a pessoa que acabou de criar —
 * e cadastra de novo.
 */

export async function listarUsuarios(
  filtros: unknown,
): Promise<Resultado<DadosPaginados<UsuarioDaListagem> & { totalCadastrado: number }>> {
  return listarServico(filtros);
}

export async function obterUsuario(dados: unknown) {
  return obterServico(dados);
}

export async function criarUsuario(dados: unknown): Promise<Resultado<UsuarioCriado>> {
  const resultado = await criarServico(dados);
  if (resultado.sucesso) revalidatePath('/admin/usuarios');
  return resultado;
}

export async function editarUsuario(dados: unknown): Promise<Resultado<UsuarioDaListagem>> {
  const resultado = await editarServico(dados);
  if (resultado.sucesso) revalidatePath('/admin/usuarios');
  return resultado;
}

export async function mudarStatusUsuario(dados: unknown): Promise<Resultado<{ status: string }>> {
  const resultado = await mudarStatusServico(dados);
  if (resultado.sucesso) revalidatePath('/admin/usuarios');
  return resultado;
}

export async function redefinirSenhaUsuario(
  dados: unknown,
): Promise<Resultado<{ senhaTemporaria: string }>> {
  return redefinirSenhaServico(dados);
}

export async function obterMeuPerfil() {
  return meuPerfilServico();
}
