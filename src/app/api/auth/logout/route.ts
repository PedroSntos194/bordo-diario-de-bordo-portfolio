import { comoResposta } from '@/lib/acao-segura';
import { sair } from '@/modulos/autenticacao/autenticacao.servico';

export const dynamic = 'force-dynamic';

/** `POST /api/auth/logout` (doc 16 · RF008). */
export async function POST(): Promise<Response> {
  const resultado = await sair();
  if (!resultado.sucesso) return comoResposta(resultado);
  return new Response(null, { status: 204 });
}
