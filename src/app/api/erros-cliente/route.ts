import { comoResposta } from '@/lib/acao-segura';
import { registrarErroDoCliente } from '@/modulos/suporte/suporte.servico';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/erros-cliente` — erro relatado pelo próprio aparelho.
 *
 * Só com sessão: o middleware barra quem não tem cookie e `definirAcao`
 * confere a sessão no banco. Um erro na tela de login não chega aqui, e está
 * certo — sem sessão não há de quem é o aparelho.
 */
export async function POST(requisicao: Request): Promise<Response> {
  const corpo = await requisicao.json().catch(() => null);
  return comoResposta(await registrarErroDoCliente(corpo), 201);
}
