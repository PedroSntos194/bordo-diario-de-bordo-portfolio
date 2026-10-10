import { comoResposta } from '@/lib/acao-segura';
import { editar, obter } from '@/modulos/usuario/usuario.servico';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** `GET /api/usuarios/{id}` (doc 16 · RF005). */
export async function GET(_requisicao: Request, contexto: Contexto): Promise<Response> {
  const { id } = await contexto.params;
  return comoResposta(await obter({ id }));
}

/** `PUT /api/usuarios/{id}` (doc 16 · RF005). */
export async function PUT(requisicao: Request, contexto: Contexto): Promise<Response> {
  const { id } = await contexto.params;
  const corpo = await requisicao.json().catch(() => ({}));
  // O identificador vem da rota, nunca do corpo: aceitar os dois abriria a
  // porta para editar um usuário e informar outro no payload.
  return comoResposta(await editar({ ...corpo, id }));
}
