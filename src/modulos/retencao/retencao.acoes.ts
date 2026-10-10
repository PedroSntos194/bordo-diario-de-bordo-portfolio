'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import type { ResultadoDoExpurgo } from '@/modulos/retencao/retencao.regras';
import { expurgarAgora, salvarPrazos } from '@/modulos/retencao/retencao.servico';

/** Server Actions da tela de retenção (US044). */

export async function salvarPrazosDeRetencao(
  dados: unknown,
): Promise<Resultado<{ alterados: string[] }>> {
  const resultado = await salvarPrazos(dados);
  if (resultado.sucesso) revalidatePath('/admin/retencao');
  return resultado;
}

export async function aplicarRetencaoAgora(): Promise<Resultado<ResultadoDoExpurgo>> {
  const resultado = await expurgarAgora();

  if (resultado.sucesso) {
    revalidatePath('/admin/retencao');
    // O expurgo tira o conteúdo de planilhas vencidas: a listagem de arquivos
    // passa a mostrar "expirado" e precisa refletir isso na próxima visita.
    revalidatePath('/admin/arquivos');
  }

  return resultado;
}
