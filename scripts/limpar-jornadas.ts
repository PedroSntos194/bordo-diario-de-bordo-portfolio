import { PrismaClient } from '@prisma/client';

/**
 * Remove as jornadas de teste — apenas para desenvolvimento.
 *
 * Existe porque encerrar jornada é da Sprint 4: sem isso, a jornada aberta no
 * teste automatizado bloquearia a van e impediria alguém de experimentar o
 * fluxo de abertura na mão. NÃO deve ser executado em produção.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();

  // Corridas primeiro: a relação com jornada é obrigatória, então o banco
  // recusaria apagar a jornada antes. Os pontos de localização vão junto por
  // cascade a partir da corrida.
  const corridas = await prisma.corrida.deleteMany({});
  const { count } = await prisma.jornada.deleteMany({});
  console.log(`corridas removidas: ${corridas.count} · jornadas removidas: ${count}`);

  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
