import { comoResposta } from '@/lib/acao-segura';
import { encerrar } from '@/modulos/corrida/corrida.servico';

export const dynamic = 'force-dynamic';

/** `POST /api/corridas/{id}/encerrar` (doc 16 · RF018). */
export async function POST(
  requisicao: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexto.params;
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await encerrar({ ...corpo, id }));
}
