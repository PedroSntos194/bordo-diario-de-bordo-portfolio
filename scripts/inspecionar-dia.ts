import { PrismaClient } from '@prisma/client';

/** Diagnóstico: estado das jornadas e corridas de hoje. */
async function main(): Promise<void> {
  const prisma = new PrismaClient();

  const jornadas = await prisma.jornada.findMany({
    select: {
      id: true,
      data: true,
      status: true,
      odometroInicial: true,
      odometroFinal: true,
      veiculo: { select: { placa: true, odometroAtual: true } },
      motorista: { select: { nome: true } },
      corridas: {
        select: {
          id: true,
          status: true,
          odometroInicial: true,
          odometroFinal: true,
          kmPercorrido: true,
        },
      },
    },
    orderBy: { criadoEm: 'asc' },
  });

  for (const j of jornadas) {
    console.log(
      `jornada ${j.id.slice(0, 8)} · ${j.motorista.nome} · ${j.status} · van ${j.veiculo.placa} (odômetro atual ${j.veiculo.odometroAtual})`,
    );
    console.log(`  odômetro da jornada: inicial=${j.odometroInicial} final=${j.odometroFinal}`);
    for (const c of j.corridas) {
      console.log(
        `  corrida ${c.id.slice(0, 8)} · ${c.status} · inicial=${c.odometroInicial} final=${c.odometroFinal} km=${c.kmPercorrido}`,
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
