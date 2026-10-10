import type { ClientePrisma } from '@/lib/prisma';

/** Acesso a dados dos feriados. A data é `date` puro, como a da jornada. */

const comoData = (dataIso: string): Date => new Date(`${dataIso}T00:00:00Z`);

export async function feriadosDoPeriodo(cliente: ClientePrisma, inicioIso: string, fimIso: string) {
  return cliente.feriado.findMany({
    where: { data: { gte: comoData(inicioIso), lte: comoData(fimIso) } },
    select: { id: true, data: true, nome: true },
    orderBy: { data: 'asc' },
  });
}

export async function buscarFeriadoPorData(cliente: ClientePrisma, dataIso: string) {
  return cliente.feriado.findUnique({ where: { data: comoData(dataIso) }, select: { id: true } });
}

export async function buscarFeriado(cliente: ClientePrisma, id: string) {
  return cliente.feriado.findUnique({
    where: { id },
    select: { id: true, data: true, nome: true },
  });
}

export async function criarFeriado(
  cliente: ClientePrisma,
  dados: { data: string; nome: string; criadoPor: string },
) {
  return cliente.feriado.create({
    data: { data: comoData(dados.data), nome: dados.nome, criadoPor: dados.criadoPor },
    select: { id: true },
  });
}

export async function criarFeriados(
  cliente: ClientePrisma,
  feriados: { data: string; nome: string }[],
  criadoPor: string,
): Promise<number> {
  const resultado = await cliente.feriado.createMany({
    data: feriados.map((feriado) => ({
      data: comoData(feriado.data),
      nome: feriado.nome,
      criadoPor,
    })),
    skipDuplicates: true,
  });
  return resultado.count;
}

export async function removerFeriado(cliente: ClientePrisma, id: string): Promise<void> {
  await cliente.feriado.delete({ where: { id } });
}
