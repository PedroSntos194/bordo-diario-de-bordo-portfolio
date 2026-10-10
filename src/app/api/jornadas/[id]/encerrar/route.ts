import { comoResposta } from '@/lib/acao-segura';
import { encerrar } from '@/modulos/jornada/jornada.servico';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/jornadas/{id}/encerrar` (doc 16 · RF019).
 *
 * O identificador vem da rota por consistência com o contrato documentado, mas
 * o serviço encerra a jornada **aberta do próprio motorista** — não é possível
 * encerrar o dia de outra pessoa informando outro id.
 */
export async function POST(
  requisicao: Request,
  _contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await encerrar(corpo));
}
