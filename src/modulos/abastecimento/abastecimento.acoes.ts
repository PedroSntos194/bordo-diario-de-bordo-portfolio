'use server';

import { revalidatePath } from 'next/cache';
import type { Resultado } from '@/lib/acao-segura';
import {
  registrar,
  type AbastecimentoRegistrado,
} from '@/modulos/abastecimento/abastecimento.servico';

/** Server Action do abastecimento (US024). */
export async function registrarAbastecimento(
  dados: unknown,
): Promise<Resultado<AbastecimentoRegistrado>> {
  const resultado = await registrar(dados);

  if (resultado.sucesso) {
    revalidatePath('/app/abastecimento');
    // O odômetro da van mudou: a listagem de veículos e o detalhe precisam
    // refletir isso na próxima visita.
    revalidatePath('/admin/veiculos');
  }

  return resultado;
}
