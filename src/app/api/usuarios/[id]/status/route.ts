import { comoResposta } from '@/lib/acao-segura';
import { mudarStatus } from '@/modulos/usuario/usuario.servico';

export const dynamic = 'force-dynamic';

/** `PATCH /api/usuarios/{id}/status` (doc 16 · RF006). */
export async function PATCH(
  requisicao: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexto.params;
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await mudarStatus({ ...corpo, id }));
}
