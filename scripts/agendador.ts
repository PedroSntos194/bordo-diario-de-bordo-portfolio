import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import {
  executarAlertaDePendenciasUmaVez,
  executarConsolidadoUmaVez,
  executarExportacoesUmaVez,
  executarExpurgoUmaVez,
  iniciarAgendador,
} from '@/servidor/agendador';

/**
 * Ponto de entrada do agendador (US033).
 *
 *   npm run agendador                    processo residente, com o cron ativo
 *   npm run agendador -- --agora         gera o consolidado de hoje e sai
 *   npm run agendador -- --agora=2026-08-23   reprocessa um dia específico
 *   npm run agendador -- --pendencias    cobra as pendências de hoje e sai
 *   npm run agendador -- --pendencias=2026-08-23   cobra um dia específico
 *   npm run agendador -- --expurgo       aplica a retenção agora e sai
 *   npm run agendador -- --exportacoes   processa a fila de exportações e sai
 *
 * Os modos de execução única existem para conferir as rotinas sem esperar as
 * 20h e as 23h — é como elas foram verificadas nas Sprints 6 e 10.
 */

const argumentos = process.argv.slice(2);
const agora = argumentos.find((valor) => valor.startsWith('--agora'));
const pendencias = argumentos.find((valor) => valor.startsWith('--pendencias'));

if (agora) {
  const [, data] = agora.split('=');
  await executarConsolidadoUmaVez(data);
  await prisma.$disconnect();
  process.exit(0);
}

if (pendencias) {
  const [, data] = pendencias.split('=');
  await executarAlertaDePendenciasUmaVez(data);
  await prisma.$disconnect();
  process.exit(0);
}

if (argumentos.includes('--expurgo')) {
  await executarExpurgoUmaVez();
  await prisma.$disconnect();
  process.exit(0);
}

if (argumentos.includes('--exportacoes')) {
  await executarExportacoesUmaVez();
  await prisma.$disconnect();
  process.exit(0);
}

const boss = await iniciarAgendador();

async function encerrar(sinal: string): Promise<void> {
  logger.info('agendador.encerrando', { sinal });
  await boss.stop({ graceful: true });
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void encerrar('SIGINT'));
process.on('SIGTERM', () => void encerrar('SIGTERM'));
