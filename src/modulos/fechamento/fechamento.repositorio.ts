import type { ClientePrisma } from '@/lib/prisma';

/**
 * Leituras do fechamento mensal. Só leitura: o fechamento não muda registro
 * nenhum, ele olha para o período e devolve as contas.
 */

const comoData = (dataIso: string): Date => new Date(`${dataIso}T00:00:00Z`);

/** Dias de trabalho do ciclo — os cancelados não entram em conta nenhuma. */
export async function jornadasDoCiclo(cliente: ClientePrisma, inicioIso: string, fimIso: string) {
  return cliente.jornada.findMany({
    where: {
      data: { gte: comoData(inicioIso), lte: comoData(fimIso) },
      status: { not: 'CANCELADA' },
    },
    select: {
      id: true,
      data: true,
      status: true,
      iniciadaEm: true,
      encerradaEm: true,
      odometroInicial: true,
      odometroFinal: true,
      inicioPeloAparelho: true,
      fimPeloAparelho: true,
      motorista: { select: { id: true, nome: true } },
      veiculo: { select: { id: true, placa: true, categoriaMedicao: true } },
      // Para tirar do km do dia o rodado entre uma corrida e outra.
      corridas: {
        where: { status: 'ENCERRADA' },
        select: { odometroInicial: true, odometroFinal: true },
      },
    },
    orderBy: [{ data: 'asc' }, { iniciadaEm: 'asc' }],
  });
}

export type JornadaDoCiclo = Awaited<ReturnType<typeof jornadasDoCiclo>>[number];

/** Quem estava escalado no turno da noite, dia a dia: a referência dele é outra. */
export async function escalasNoturnasDoCiclo(
  cliente: ClientePrisma,
  inicioIso: string,
  fimIso: string,
) {
  return cliente.escala.findMany({
    where: { data: { gte: comoData(inicioIso), lte: comoData(fimIso) }, turno: 'NOITE' },
    select: { data: true, motoristaId: true },
  });
}

/**
 * Se o fechamento automático deste ciclo já saiu. A marca é o aviso aos
 * administradores, gravado na mesma transação dos arquivos: com ele, uma
 * segunda passagem do cron na mesma hora não gera tudo de novo.
 */
export async function fechamentoAutomaticoJaGerado(
  cliente: ClientePrisma,
  inicioIso: string,
): Promise<boolean> {
  const aviso = await cliente.notificacao.findFirst({
    where: { referenciaTipo: 'fechamento', referenciaChave: inicioIso },
    select: { id: true },
  });
  return aviso !== null;
}

/** Os arquivos de fechamento já gerados, do mais novo ao mais antigo. */
export async function arquivosDeFechamento(cliente: ClientePrisma, limite: number) {
  return cliente.arquivo.findMany({
    where: { tipo: 'FECHAMENTO_MENSAL' },
    select: {
      id: true,
      nomeOriginal: true,
      parametros: true,
      tamanhoBytes: true,
      criadoEm: true,
      autor: { select: { nome: true } },
    },
    orderBy: { criadoEm: 'desc' },
    take: limite,
  });
}
