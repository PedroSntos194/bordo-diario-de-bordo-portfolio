import { comoResposta } from '@/lib/acao-segura';
import { entrar } from '@/modulos/autenticacao/autenticacao.servico';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/auth/login` (doc 16 · RF001).
 *
 * A interface web usa a Server Action; esta rota existe para o contrato HTTP —
 * a sincronização offline, o aplicativo instalado e qualquer consumidor futuro
 * precisam de um endpoint estável. As duas entradas chamam **o mesmo** caso de
 * uso, então não há como as regras divergirem entre elas.
 */
export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => ({}));
  return comoResposta(await entrar(corpo));
}
