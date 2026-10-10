import { comoResposta } from '@/lib/acao-segura';
import { prepararResumoDoDia } from '@/modulos/notificacao/notificacao.servico';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/notificacoes/resumo-dia` (doc 16 · RF025 · US036).
 *
 * Na abordagem V-05a devolve `{ url }` para o cliente abrir; na V-05b o envio
 * já aconteceu no servidor e `url` vem nulo. O contrato é o mesmo nos dois
 * casos — é o que permite trocar de abordagem sem mexer em quem consome.
 */
export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => null);
  return comoResposta(await prepararResumoDoDia(corpo));
}
