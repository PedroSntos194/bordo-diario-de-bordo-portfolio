import { comoResposta } from '@/lib/acao-segura';
import { cancelar } from '@/modulos/corrida/corrida.servico';

export const dynamic = 'force-dynamic';

/** `POST /api/corridas/{id}/cancelar` (doc 16 · RN024). */
export async function POST(
  requisicao: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexto.params;
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await cancelar({ ...corpo, id }));
}
