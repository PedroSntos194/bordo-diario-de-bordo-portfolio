import { comoResposta } from '@/lib/acao-segura';
import { meuPerfil } from '@/modulos/usuario/usuario.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/perfil` (doc 16 · RF009). */
export async function GET(): Promise<Response> {
  return comoResposta(await meuPerfil());
}
