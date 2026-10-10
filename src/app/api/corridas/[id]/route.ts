import { comoResposta } from '@/lib/acao-segura';
import { obter } from '@/modulos/corrida/corrida.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/corridas/{id}` (doc 16 · RF029). */
export async function GET(
  _requisicao: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexto.params;
  return comoResposta(await obter({ id }));
}
