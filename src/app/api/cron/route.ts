import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { despacharRotinas } from '@/servidor/despacho';

export const dynamic = 'force-dynamic';
// Uma passagem pode concluir várias exportações além das demais rotinas.
export const maxDuration = 300;

/**
 * `GET /api/cron` — passagem das rotinas agendadas (US033 · AD-9).
 *
 * Substitui o processo residente quando a hospedagem não tem processo: o cron
 * chama esta URL de hora em hora e `despacharRotinas` decide o que venceu.
 *
 * ## Esta rota apaga dados
 *
 * Entre as rotinas está o **expurgo por retenção**, que remove pontos de GPS e
 * conteúdo de planilhas em definitivo. Uma URL que faz isso não pode depender
 * de ninguém descobrir o caminho: sem `CRON_SECRET` configurado ela recusa
 * tudo, e com ele exige o cabeçalho `Authorization: Bearer`.
 *
 * A comparação é feita em **tempo constante**. Comparar segredo com `===`
 * devolve mais cedo no primeiro byte diferente, e essa diferença de tempo é
 * medível pela rede — é assim que se descobre um segredo byte a byte.
 *
 * ## Por que o segredo, e não só o cabeçalho da Vercel
 *
 * A Vercel envia `Authorization: Bearer ${CRON_SECRET}` nas chamadas de cron.
 * Verificar o valor — em vez de confiar num cabeçalho como `x-vercel-cron`, que
 * qualquer cliente pode enviar — é o que torna a proteção real e mantém a rota
 * segura em qualquer hospedagem.
 */

function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // `timingSafeEqual` exige o mesmo tamanho; comparar antes vazaria só o
  // comprimento, que não é o segredo.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function autorizado(requisicao: Request): boolean {
  const esperado = env.CRON_SECRET;

  // Sem segredo configurado a rota fica fechada, inclusive em desenvolvimento.
  // Abrir "só no local" é como a rotina destrutiva acaba aberta em produção no
  // dia em que alguém copia a configuração errada.
  if (!esperado) return false;

  const cabecalho = requisicao.headers.get('authorization') ?? '';
  const prefixo = 'Bearer ';
  if (!cabecalho.startsWith(prefixo)) return false;

  return segredoConfere(cabecalho.slice(prefixo.length), esperado);
}

export async function GET(requisicao: Request): Promise<Response> {
  if (!autorizado(requisicao)) {
    logger.warn('cron.nao-autorizado', {
      configurado: Boolean(env.CRON_SECRET),
      ip: requisicao.headers.get('x-forwarded-for'),
    });

    // 404 e não 401: para quem não tem o segredo, a rota não existe. Confirmar
    // que existe um endpoint de rotinas é informação que não precisa ser dada.
    return Response.json({ erro: { mensagem: 'Não encontrado.' } }, { status: 404 });
  }

  const resumo = await despacharRotinas();

  // 200 mesmo com rotina falhada: o corpo diz o que deu errado, e devolver erro
  // faria o cron da hospedagem repetir a passagem inteira — inclusive as
  // rotinas que deram certo. A repetição é decisão de cada caso de uso, que já
  // conta as próprias tentativas.
  return Response.json(resumo, { status: 200 });
}
