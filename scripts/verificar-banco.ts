import { PrismaClient } from '@prisma/client';

/**
 * Conferência do estado do banco após as migrações.
 *
 * Verifica o que o schema do Prisma não expressa: os índices únicos parciais
 * que sustentam RN002, RN012, RN013 e RN014. São eles que impedem, de fato,
 * dois registros conflitantes criados ao mesmo tempo.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();

  const indices = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND indexdef ILIKE '%WHERE%'
    ORDER BY indexname`;

  console.log('=== índices parciais (garantias de concorrência) ===');
  for (const indice of indices) console.log(`  ${indice.indexname}`);

  const tabelas = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'public'`;

  console.log(`\ntabelas: ${tabelas[0]?.n}`);
  console.log(`configurações: ${await prisma.configuracao.count()}`);
  console.log(`administradores: ${await prisma.usuario.count({ where: { perfil: 'ADMIN' } })}`);

  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
