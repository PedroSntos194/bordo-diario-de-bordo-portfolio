import { comoResposta } from '@/lib/acao-segura';
import { painel } from '@/modulos/relatorio/relatorio.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/dashboard` (doc 16 · RF028). */
export async function GET(requisicao: Request): Promise<Response> {
  const data = new URL(requisicao.url).searchParams.get('data');
  return comoResposta(await painel(data ? { data } : {}));
}
