import { comoResposta } from '@/lib/acao-segura';
import { redefinirSenha } from '@/modulos/usuario/usuario.servico';

export const dynamic = 'force-dynamic';

/** `POST /api/usuarios/{id}/redefinir-senha` (doc 16 · RF002). */
export async function POST(
  _requisicao: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexto.params;
  return comoResposta(await redefinirSenha({ id }));
}
