import { comoResposta } from '@/lib/acao-segura';
import { trocarSenha } from '@/modulos/autenticacao/autenticacao.servico';

export const dynamic = 'force-dynamic';

/** `POST /api/auth/trocar-senha` (doc 16 · RF003, RF009). */
export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => ({}));
  const resultado = await trocarSenha(corpo);
  if (!resultado.sucesso) return comoResposta(resultado);
  return new Response(null, { status: 204 });
}
