import { comoResposta } from '@/lib/acao-segura';
import { abrir } from '@/modulos/jornada/jornada.servico';
import { listarJornadasDoPainel } from '@/modulos/relatorio/relatorio.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/jornadas` (doc 16 · RF029). */
export async function GET(requisicao: Request): Promise<Response> {
  const parametros = Object.fromEntries(new URL(requisicao.url).searchParams);
  return comoResposta(await listarJornadasDoPainel(parametros));
}

/**
 * `POST /api/jornadas` (doc 16 · RF014).
 *
 * Responde 200 quando a jornada do dia já existia e 201 quando foi criada
 * agora — o cliente offline precisa distinguir os dois para não duplicar.
 */
export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => ({}));
  const resultado = await abrir(corpo);

  if (!resultado.sucesso) return comoResposta(resultado);
  return Response.json(resultado.dados, { status: resultado.dados.jaExistia ? 200 : 201 });
}
