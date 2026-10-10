import { comoResposta } from '@/lib/acao-segura';
import { sincronizar } from '@/modulos/sincronizacao/sincronizacao.servico';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/sincronizacao` (doc 16 · RF022 · US025).
 *
 * Rota, e não Server Action, por duas razões práticas: quem chama é o
 * sincronizador em segundo plano — que não está numa árvore de React e às vezes
 * roda com a tela em outro lugar —, e a resposta precisa do resultado
 * **individual** de cada operação, que é um contrato de API de verdade.
 */
export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => null);
  return comoResposta(await sincronizar(corpo));
}
