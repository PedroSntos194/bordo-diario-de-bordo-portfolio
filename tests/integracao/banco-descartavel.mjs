import { PrismaClient } from '@prisma/client';
import { validarAmbienteDaSuite, validarBancoDescartavel } from './ambiente-seguro.mjs';

validarAmbienteDaSuite(process.env);
const url = validarBancoDescartavel(process.env.DATABASE_URL);
const schema = url.searchParams.get('schema');
const modo = process.argv[2];
if (modo !== 'criar' && modo !== 'remover')
  throw new Error('Operação de banco de testes inválida.');
const prisma = new PrismaClient({ datasources: { db: { url: url.href } } });
try {
  await prisma.$connect();
  // Nome restrito a ci_fluxos_<12 hex>, gerado pelo executor. Nunca toca public.
  await prisma.$executeRawUnsafe(
    modo === 'criar' ? `CREATE SCHEMA "${schema}"` : `DROP SCHEMA "${schema}" CASCADE`,
  );
} catch {
  process.stderr.write(
    'Não foi possível preparar/limpar o PostgreSQL descartável. ' +
      'Execute docker compose -f compose.teste.yml up -d --wait.\n',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
