import { comoResposta } from '@/lib/acao-segura';
import { resumoDoDia } from '@/modulos/relatorio/relatorio.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/resumo/{data}` (doc 16 · RF030). */
export async function GET(
  _requisicao: Request,
  contexto: { params: Promise<{ data: string }> },
): Promise<Response> {
  const { data } = await contexto.params;
  return comoResposta(await resumoDoDia({ data }));
}
