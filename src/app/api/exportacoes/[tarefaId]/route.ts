import { comoResposta } from '@/lib/acao-segura';
import { situacaoDaExportacao } from '@/modulos/exportacao/exportacao.servico';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/exportacoes/{tarefaId}` (doc 16 · US031).
 *
 * Situação de uma exportação admitida para segundo plano. É o que a tela
 * consulta enquanto espera, e responde 404 tanto para o identificador que não
 * existe quanto para o de outra pessoa — distinguir os dois confirmaria a
 * existência do pedido alheio.
 */
export async function GET(
  _requisicao: Request,
  contexto: { params: Promise<{ tarefaId: string }> },
): Promise<Response> {
  const { tarefaId } = await contexto.params;
  return comoResposta(await situacaoDaExportacao({ tarefaId }));
}
