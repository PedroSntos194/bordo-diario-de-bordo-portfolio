import type { TipoCombustivel } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';

/** Acesso a dados do abastecimento (US024 · RF021). */

const CAMPOS = {
  id: true,
  abastecidoEm: true,
  litros: true,
  valorTotal: true,
  odometro: true,
  posto: true,
  tipoCombustivel: true,
  tanqueCheio: true,
} as const;

export interface NovoAbastecimento {
  jornadaId: string;
  veiculoId: string;
  abastecidoEm: Date;
  litros: number;
  valorTotal: number | null;
  odometro: number;
  posto: string | null;
  tipoCombustivel: TipoCombustivel;
  tanqueCheio: boolean | null;
  criadoPor: string;
}

export async function criarAbastecimento(cliente: ClientePrisma, dados: NovoAbastecimento) {
  return cliente.abastecimento.create({ data: dados, select: CAMPOS });
}

/**
 * Abastecimentos de uma van, do mais antigo para o mais novo.
 *
 * A ordem é por **odômetro**, e não por data: é a distância que o cálculo de
 * consumo percorre, e um registro lançado com atraso teria data fora de ordem
 * sem que a quilometragem estivesse errada.
 */
export async function abastecimentosDoVeiculo(
  cliente: ClientePrisma,
  veiculoId: string,
  limite = 60,
) {
  return cliente.abastecimento.findMany({
    where: { veiculoId },
    select: {
      ...CAMPOS,
      jornada: { select: { id: true, data: true, motorista: { select: { nome: true } } } },
    },
    orderBy: { odometro: 'desc' },
    take: limite,
  });
}

export type AbastecimentoDoVeiculo = Awaited<ReturnType<typeof abastecimentosDoVeiculo>>[number];

/** Abastecimentos do dia do motorista, para a tela dele. */
export async function abastecimentosDaJornada(cliente: ClientePrisma, jornadaId: string) {
  return cliente.abastecimento.findMany({
    where: { jornadaId },
    select: CAMPOS,
    orderBy: { abastecidoEm: 'desc' },
  });
}
