import { comoResposta } from '@/lib/acao-segura';
import { ativas, criar, listar } from '@/modulos/rota/rota.servico';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/rotas` · `POST /api/rotas` (doc 16 · RF011).
 *
 * `?escopo=ativas` devolve a lista enxuta que o motorista usa para escolher a
 * rota da corrida — ele não tem permissão para a listagem administrativa.
 */
export async function GET(requisicao: Request): Promise<Response> {
  const parametros = new URL(requisicao.url).searchParams;

  if (parametros.get('escopo') === 'ativas') {
    return comoResposta(await ativas());
  }

  return comoResposta(await listar(Object.fromEntries(parametros)));
}

export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await criar(corpo), 201);
}
