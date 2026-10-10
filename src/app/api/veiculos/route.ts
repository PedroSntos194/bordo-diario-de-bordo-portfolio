import { comoResposta } from '@/lib/acao-segura';
import { criar, listar } from '@/modulos/veiculo/veiculo.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/veiculos` · `POST /api/veiculos` (doc 16 · RF010). */
export async function GET(requisicao: Request): Promise<Response> {
  const parametros = Object.fromEntries(new URL(requisicao.url).searchParams);
  return comoResposta(await listar(parametros));
}

export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await criar(corpo), 201);
}
