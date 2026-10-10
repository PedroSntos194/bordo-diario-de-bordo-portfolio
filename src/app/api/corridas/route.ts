import { comoResposta } from '@/lib/acao-segura';
import { iniciar } from '@/modulos/corrida/corrida.servico';
import { listarCorridasDoPainel } from '@/modulos/relatorio/relatorio.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/corridas` (doc 16 · RF029). */
export async function GET(requisicao: Request): Promise<Response> {
  const parametros = Object.fromEntries(new URL(requisicao.url).searchParams);
  return comoResposta(await listarCorridasDoPainel(parametros));
}

/**
 * `POST /api/corridas` (doc 16 · RF015, RF016).
 *
 * 201 quando a corrida foi criada agora; 200 quando o `clientUuid` já havia
 * sido processado — o cliente offline usa a distinção para não duplicar.
 */
export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => ({}));
  const resultado = await iniciar(corpo);

  if (!resultado.sucesso) return comoResposta(resultado);
  return Response.json(resultado.dados, { status: resultado.dados.jaExistia ? 200 : 201 });
}
