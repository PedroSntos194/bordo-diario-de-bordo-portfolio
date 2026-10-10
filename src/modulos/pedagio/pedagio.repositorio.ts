import type { FormaPagamentoPedagio } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';
import { fimDoDia, inicioDoDia } from '@/utilitarios/data';

/** Acesso a dados dos pedágios. */

export async function criarPedagio(
  cliente: ClientePrisma,
  dados: {
    jornadaId: string;
    veiculoId: string;
    pagoEm: Date;
    valor: number;
    praca: string | null;
    formaPagamento: FormaPagamentoPedagio;
    criadoPor: string;
  },
) {
  return cliente.pedagio.create({ data: dados, select: { id: true } });
}

export async function pedagiosDaJornada(cliente: ClientePrisma, jornadaId: string) {
  return cliente.pedagio.findMany({
    where: { jornadaId },
    select: { id: true, pagoEm: true, valor: true, praca: true, formaPagamento: true },
    orderBy: { pagoEm: 'asc' },
  });
}

/**
 * Pedágios de um período, pela **data da jornada** — e não pela hora do
 * pagamento —, para o total bater com os dias do boletim.
 */
export async function pedagiosDoPeriodo(cliente: ClientePrisma, inicioIso: string, fimIso: string) {
  return cliente.pedagio.findMany({
    where: {
      jornada: {
        data: { gte: new Date(`${inicioIso}T00:00:00Z`), lte: new Date(`${fimIso}T00:00:00Z`) },
      },
    },
    select: {
      id: true,
      pagoEm: true,
      valor: true,
      praca: true,
      formaPagamento: true,
      veiculo: { select: { id: true, placa: true } },
      jornada: { select: { data: true, motorista: { select: { nome: true } } } },
    },
    orderBy: { pagoEm: 'asc' },
  });
}

/** Soma dos pedágios pagos num dia (horário de São Paulo), para o painel. */
export async function totalPedagiosDoDia(cliente: ClientePrisma, dataIso: string): Promise<number> {
  const soma = await cliente.pedagio.aggregate({
    where: { pagoEm: { gte: inicioDoDia(dataIso), lte: fimDoDia(dataIso) } },
    _sum: { valor: true },
  });
  return Number(soma._sum.valor ?? 0);
}
