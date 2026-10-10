'use server';

import type { Resultado } from '@/lib/acao-segura';
import {
  aceitarPrivacidade as aceitarPrivacidadeServico,
  entrar as entrarServico,
  sair as sairServico,
  trocarSenha as trocarSenhaServico,
  type ResultadoDoLogin,
} from './autenticacao.servico';

/**
 * Server Actions da autenticação — a fronteira que os formulários chamam.
 *
 * São invólucros finos sobre os casos de uso: o arquivo existe para marcar
 * explicitamente o que está exposto ao navegador. Toda a lógica está em
 * `autenticacao.servico.ts`, e a proteção, em `acao-segura.ts`.
 *
 * As ações nunca lançam: devolvem `{ sucesso: true, dados }` ou
 * `{ sucesso: false, erro }`. Exceção atravessando a fronteira do servidor
 * chegaria ao cliente como mensagem genérica, sem o campo que falhou.
 */

export async function entrar(dados: unknown): Promise<Resultado<ResultadoDoLogin>> {
  return entrarServico(dados);
}

export async function sair(): Promise<Resultado<{ ok: true }>> {
  return sairServico();
}

export async function trocarSenha(dados: unknown): Promise<Resultado<{ ok: true }>> {
  return trocarSenhaServico(dados);
}

export async function aceitarPrivacidade(dados: unknown): Promise<Resultado<{ ok: true }>> {
  return aceitarPrivacidadeServico(dados);
}
