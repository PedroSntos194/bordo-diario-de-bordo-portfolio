import { PrismaClient } from '@prisma/client';

/** Conferência da trilha de auditoria (RF037 · RN026) após o teste de ponta a ponta. */
async function main(): Promise<void> {
  const prisma = new PrismaClient();

  const registros = await prisma.logAuditoria.findMany({
    orderBy: { ocorridoEm: 'asc' },
    select: {
      acao: true,
      entidade: true,
      valorAnterior: true,
      valorNovo: true,
      usuario: { select: { nome: true } },
    },
  });

  console.log(`=== ${registros.length} registros de auditoria ===`);
  for (const r of registros) {
    const autor = r.usuario?.nome ?? 'sistema';
    const delta = r.valorNovo ? ` ${JSON.stringify(r.valorNovo).slice(0, 90)}` : '';
    console.log(`  ${r.acao.padEnd(12)} ${r.entidade.padEnd(20)} ${autor.padEnd(14)}${delta}`);
  }

  const comSenha = registros.filter((r) =>
    JSON.stringify([r.valorAnterior, r.valorNovo]).match(/\$argon2|senhaHash|senhaTemporaria"/),
  );
  console.log(`\nregistros contendo hash ou senha: ${comSenha.length} (esperado: 0)`);

  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
