import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/health` (doc 16) — consumido pelo monitoramento externo.
 *
 * Verifica o banco de verdade: responder "ok" sem tocar no PostgreSQL faria o
 * monitoramento acusar saúde enquanto o sistema já não registra nada.
 */
export async function GET(): Promise<Response> {
  const versao = process.env.npm_package_version ?? '0.1.0';

  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: 'ok',
      banco: 'ok',
      versao,
      horario: new Date().toISOString(),
    });
  } catch (erro) {
    logger.error('health.banco_indisponivel', {
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });

    return Response.json(
      { status: 'degradado', banco: 'indisponivel', versao, horario: new Date().toISOString() },
      { status: 503 },
    );
  }
}
