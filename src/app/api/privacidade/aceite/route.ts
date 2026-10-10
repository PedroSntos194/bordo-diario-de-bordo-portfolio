import { comoResposta } from '@/lib/acao-segura';
import { aceitarPrivacidade } from '@/modulos/autenticacao/autenticacao.servico';

export const dynamic = 'force-dynamic';

/** `POST /api/privacidade/aceite` (doc 16 · RF042). */
export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => ({}));
  const resultado = await aceitarPrivacidade(corpo);
  if (!resultado.sucesso) return comoResposta(resultado);
  return new Response(null, { status: 204 });
}
