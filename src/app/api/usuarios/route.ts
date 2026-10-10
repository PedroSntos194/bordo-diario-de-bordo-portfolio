import { comoResposta } from '@/lib/acao-segura';
import { criar, listar } from '@/modulos/usuario/usuario.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/usuarios` (doc 16 · RF007). */
export async function GET(requisicao: Request): Promise<Response> {
  const parametros = Object.fromEntries(new URL(requisicao.url).searchParams);
  return comoResposta(await listar(parametros));
}

/** `POST /api/usuarios` (doc 16 · RF004). */
export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await criar(corpo), 201);
}
