import { comoResposta } from '@/lib/acao-segura';
import { mudarStatus } from '@/modulos/veiculo/veiculo.servico';

export const dynamic = 'force-dynamic';

/** `PATCH /api/veiculos/{id}/status` (doc 16 · RF010 · RN013). */
export async function PATCH(
  requisicao: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexto.params;
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await mudarStatus({ ...corpo, id }));
}
