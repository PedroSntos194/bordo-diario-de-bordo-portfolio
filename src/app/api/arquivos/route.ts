import { comoResposta } from '@/lib/acao-segura';
import { listar } from '@/modulos/arquivo/arquivo.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/arquivos` (doc 16 · RF036). */
export async function GET(requisicao: Request): Promise<Response> {
  const parametros = Object.fromEntries(new URL(requisicao.url).searchParams);
  return comoResposta(await listar(parametros));
}
