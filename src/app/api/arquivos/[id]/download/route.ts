import { comoResposta } from '@/lib/acao-segura';
import { baixar } from '@/modulos/arquivo/arquivo.servico';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/arquivos/{id}/download` (doc 16 · RF036 · RN030).
 *
 * A única rota do sistema que devolve binário. O caminho no storage não aparece
 * em lugar nenhum: entra o identificador do registro, sai o conteúdo — e só
 * depois de o serviço verificar quem está pedindo.
 *
 * O erro continua saindo em JSON pelo formato padrão da API: quem chama isto é
 * uma navegação do administrador, e uma tela em branco por causa de um binário
 * inválido seria pior do que a mensagem.
 */
export async function GET(
  _requisicao: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await contexto.params;
  const resultado = await baixar({ id });

  if (!resultado.sucesso) return comoResposta(resultado);

  const { nome, mimeType, conteudo } = resultado.dados;

  // A resposta em fluxo permite entregar planilhas maiores que o limite de
  // corpo não streaming da Vercel. O conteúdo já veio do storage privado,
  // depois da autorização; enviamos blocos sem criar outra cópia completa.
  let posicao = 0;
  const fluxo = new ReadableStream<Uint8Array>({
    pull(controlador) {
      if (posicao >= conteudo.byteLength) {
        controlador.close();
        return;
      }
      const fim = Math.min(posicao + 64 * 1024, conteudo.byteLength);
      controlador.enqueue(conteudo.subarray(posicao, fim));
      posicao = fim;
    },
  });

  return new Response(fluxo, {
    status: 200,
    headers: {
      'content-type': mimeType,
      // `attachment` com nome entre aspas: sem isso o navegador tenta abrir o
      // `.xlsx` na própria aba. O nome vem do banco e é gerado pelo sistema,
      // mas as aspas são escapadas mesmo assim — cabeçalho HTTP não é lugar
      // para confiar em texto vindo de uma tabela.
      'content-disposition': `attachment; filename="${nome.replace(/["\\]/g, '')}"`,
      // Planilha gerada é imutável (RN030), mas é dado operacional: não deve
      // ficar em cache compartilhado de proxy.
      'cache-control': 'private, no-store',
    },
  });
}
