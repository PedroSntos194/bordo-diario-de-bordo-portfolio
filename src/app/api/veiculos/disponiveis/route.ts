import { comoResposta } from '@/lib/acao-segura';
import { disponiveis } from '@/modulos/veiculo/veiculo.servico';

export const dynamic = 'force-dynamic';

/** `GET /api/veiculos/disponiveis` (doc 16 · RF014 · RN013). */
export async function GET(): Promise<Response> {
  return comoResposta(await disponiveis());
}
