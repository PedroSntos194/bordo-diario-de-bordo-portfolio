import { comoResposta } from '@/lib/acao-segura';
import { editar, obter } from '@/modulos/veiculo/veiculo.servico';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** `GET` e `PUT /api/veiculos/{id}` (doc 16 · RF010). */
export async function GET(_requisicao: Request, contexto: Contexto): Promise<Response> {
  const { id } = await contexto.params;
  return comoResposta(await obter({ id }));
}

export async function PUT(requisicao: Request, contexto: Contexto): Promise<Response> {
  const { id } = await contexto.params;
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await editar({ ...corpo, id }));
}
