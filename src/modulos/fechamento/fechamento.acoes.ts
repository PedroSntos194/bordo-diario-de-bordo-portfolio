'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import { gerarAgora, type FechamentoGerado } from '@/modulos/fechamento/fechamento.servico';

/** Server Action do botão "Gerar planilhas". */
export async function gerarFechamento(dados: unknown): Promise<Resultado<FechamentoGerado>> {
  const resultado = await gerarAgora(dados);
  if (resultado.sucesso) {
    revalidatePath('/admin/fechamento');
    revalidatePath('/admin/arquivos');
  }
  return resultado;
}
