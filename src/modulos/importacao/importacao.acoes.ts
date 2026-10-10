'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import { confirmar, type ResultadoDaImportacao } from '@/modulos/importacao/importacao.servico';

/**
 * Server Action da confirmação da importação (US015).
 *
 * A **análise** não tem action equivalente de propósito: ela recebe binário, e
 * `multipart/form-data` é contrato de HTTP — a tela usa `POST /api/importacoes`
 * direto. A confirmação, por não carregar arquivo, volta ao caminho normal das
 * mutações da interface.
 */
export async function confirmarImportacao(
  dados: unknown,
): Promise<Resultado<ResultadoDaImportacao>> {
  const resultado = await confirmar(dados);

  if (resultado.sucesso) {
    revalidatePath('/admin/importar');
    revalidatePath('/admin/arquivos');
    revalidatePath('/admin/usuarios');
    revalidatePath('/admin/veiculos');
    revalidatePath('/admin/rotas');
  }

  return resultado;
}
