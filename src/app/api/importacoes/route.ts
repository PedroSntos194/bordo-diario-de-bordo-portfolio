import { comoResposta } from '@/lib/acao-segura';
import { CodigoErro } from '@/lib/erros';
import { analisar } from '@/modulos/importacao/importacao.servico';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/importacoes` (doc 16 · RF035 · US015).
 *
 * `multipart/form-data` com `arquivo` e `tipoDestino`. É a única entrada do
 * sistema que recebe binário do usuário, e por isso continua sendo Route
 * Handler em vez de Server Action: o contrato é HTTP de verdade, com 413 e 415
 * próprios (doc 16), e a leitura do `FormData` é natural aqui.
 *
 * A resposta é a **pré-visualização** — nada foi gravado no cadastro ainda.
 * Quem grava é `POST /api/importacoes/{id}/confirmar`.
 */
export async function POST(requisicao: Request): Promise<Response> {
  let formulario: FormData;

  try {
    formulario = await requisicao.formData();
  } catch {
    return comoResposta({
      sucesso: false,
      erro: {
        codigo: CodigoErro.DADOS_INVALIDOS,
        mensagem: 'Envie o arquivo em multipart/form-data.',
      },
    });
  }

  const arquivo = formulario.get('arquivo');
  const tipoDestino = formulario.get('tipoDestino');

  // O `File` chega como `Blob` no runtime do Next; o que interessa é ter bytes
  // e um nome — a extensão decide se o conteúdo é lido como planilha ou CSV.
  const nomeArquivo =
    arquivo instanceof File ? arquivo.name : typeof arquivo === 'string' ? arquivo : '';

  const conteudo =
    arquivo instanceof Blob ? Buffer.from(await arquivo.arrayBuffer()) : Buffer.alloc(0);

  return comoResposta(
    await analisar({
      tipoDestino: typeof tipoDestino === 'string' ? tipoDestino : undefined,
      nomeArquivo,
      conteudo,
    }),
  );
}
