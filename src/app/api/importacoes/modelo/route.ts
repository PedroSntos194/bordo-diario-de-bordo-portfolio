import { comoResposta } from '@/lib/acao-segura';
import { MIME_XLSX } from '@/modulos/importacao/importacao.regras';
import { baixarModelo } from '@/modulos/importacao/importacao.servico';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/importacoes/modelo?tipoDestino=USUARIO` (RF035 · US015).
 *
 * Rota, e não Server Action, porque a resposta é um binário para download — o
 * mesmo motivo de `/api/arquivos/{id}/download`. A diferença é que o modelo não
 * é guardado no storage: ele é montado a partir de `MODELOS` a cada pedido, e é
 * bom que seja assim — um modelo gravado ficaria desatualizado no dia em que
 * uma coluna mudasse, e a planilha antiga passaria a ser recusada pelo próprio
 * sistema que a distribuiu.
 */
export async function GET(requisicao: Request): Promise<Response> {
  const { searchParams } = new URL(requisicao.url);
  const resultado = await baixarModelo({ tipoDestino: searchParams.get('tipoDestino') });

  if (!resultado.sucesso) return comoResposta(resultado);

  const { nome, conteudo } = resultado.dados;

  return new Response(new Uint8Array(conteudo), {
    status: 200,
    headers: {
      'content-type': MIME_XLSX,
      'content-disposition': `attachment; filename="${nome.replace(/["\\]/g, '')}"`,
      'content-length': String(conteudo.byteLength),
      'cache-control': 'private, no-store',
    },
  });
}
