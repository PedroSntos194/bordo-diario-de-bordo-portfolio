import { comoResposta } from '@/lib/acao-segura';
import { editar, obter } from '@/modulos/rota/rota.servico';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** `GET` e `PUT /api/rotas/{id}` (doc 16 · RF011). */
export async function GET(_requisicao: Request, contexto: Contexto): Promise<Response> {
  const { id } = await contexto.params;
  return comoResposta(await obter({ id }));
}

export async function PUT(requisicao: Request, contexto: Contexto): Promise<Response> {
  const { id } = await contexto.params;
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await editar({ ...corpo, id }));
}
