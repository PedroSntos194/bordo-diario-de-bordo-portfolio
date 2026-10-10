import { exigirSessao } from '@/lib/autorizacao';
import { consumirLimite, LIMITES } from '@/lib/limite-requisicao';
import { buscarEndereco } from '@/lib/geocodificacao';
import { ehErroDaAplicacao, paraRespostaDeErro } from '@/lib/erros';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/geocodificacao?endereco=...`
 *
 * Intermedia a consulta ao Nominatim: só usuários autenticados chegam aqui, com
 * limite por sessão, e o cache do servidor evita repetir a mesma busca — a
 * política de uso do provedor não toleraria 60 navegadores consultando direto.
 */
export async function GET(requisicao: Request): Promise<Response> {
  try {
    const usuario = await exigirSessao();
    consumirLimite(`geocodificacao:${usuario.id}`, LIMITES.mutacao);

    const endereco = new URL(requisicao.url).searchParams.get('endereco') ?? '';
    return Response.json({ locais: await buscarEndereco(endereco) });
  } catch (erro) {
    if (ehErroDaAplicacao(erro)) {
      return Response.json(paraRespostaDeErro(erro), { status: erro.status });
    }
    // Falha na busca nunca deve travar o cadastro do ponto (RNF015).
    return Response.json({ locais: [] });
  }
}
