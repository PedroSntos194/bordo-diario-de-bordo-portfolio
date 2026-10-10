'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import {
  alertarPendenciasAgora,
  type ResultadoDoAlerta,
} from '@/modulos/pendencia/pendencia.servico';

/** Server Action da tela de pendências (US038). */
export async function cobrarPendenciasAgora(dados: unknown): Promise<Resultado<ResultadoDoAlerta>> {
  const resultado = await alertarPendenciasAgora(dados);

  if (resultado.sucesso) {
    revalidatePath('/admin/pendencias');
    revalidatePath('/admin/notificacoes');
  }

  return resultado;
}
