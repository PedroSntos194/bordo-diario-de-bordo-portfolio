import { comoResposta } from '@/lib/acao-segura';
import { meuDia } from '@/modulos/jornada/jornada.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/jornadas/hoje` (doc 16 · RF014). Base da tela "Meu dia". */
export async function GET(): Promise<Response> {
  return comoResposta(await meuDia());
}
