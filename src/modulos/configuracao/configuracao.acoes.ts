'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import { salvar } from '@/modulos/configuracao/configuracao.servico';

/** Server Action da tela de configurações (US042). */
export async function salvarConfiguracoes(
  dados: unknown,
): Promise<Resultado<{ alterados: string[] }>> {
  const resultado = await salvar(dados);
  if (resultado.sucesso) revalidatePath('/admin/configuracoes');
  return resultado;
}
