import { comoResposta } from '@/lib/acao-segura';
import { retratoDoDia } from '@/modulos/sincronizacao/sincronizacao.servico';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/offline/retrato` (RF022 · US025).
 *
 * O que o aparelho guarda para conseguir trabalhar sem rede: vans, rotas e o
 * estado do dia. Buscado sempre que há conexão, e nunca servido pelo cache do
 * service worker — um retrato velho apresentado como atual seria pior do que
 * nenhum retrato.
 */
export async function GET(): Promise<Response> {
  const resultado = await retratoDoDia();

  if (!resultado.sucesso) return comoResposta(resultado);

  return Response.json(resultado.dados, {
    status: 200,
    headers: { 'cache-control': 'private, no-store' },
  });
}
