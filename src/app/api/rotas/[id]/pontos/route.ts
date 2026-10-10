import { comoResposta } from '@/lib/acao-segura';
import { salvarPontos } from '@/modulos/rota/rota.servico';

export const dynamic = 'force-dynamic';

/**
 * `PUT /api/rotas/{id}/pontos` (doc 16 · RF012).
 *
 * Substitui a lista inteira, preservando a ordem enviada.
 */
export async function PUT(
  requisicao: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexto.params;
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await salvarPontos({ ...corpo, rotaId: id }));
}
