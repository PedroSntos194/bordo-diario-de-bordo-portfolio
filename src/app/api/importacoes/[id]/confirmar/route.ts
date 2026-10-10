import { comoResposta } from '@/lib/acao-segura';
import { confirmar } from '@/modulos/importacao/importacao.servico';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/importacoes/{id}/confirmar` (doc 16 · RF035 · US015).
 *
 * A etapa que grava. Fica ao lado da análise, como rota, para o contrato do
 * doc 16 continuar valendo por inteiro — a tela usa a Server Action equivalente
 * em `importacao.acoes.ts`, que chama o mesmo caso de uso.
 */
export async function POST(
  _requisicao: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexto.params;
  return comoResposta(await confirmar({ id }));
}
