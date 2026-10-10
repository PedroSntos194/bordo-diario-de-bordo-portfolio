import type { Prisma, TipoOcorrencia } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';
import { fimDoDia, inicioDoDia } from '@/utilitarios/data';

/** Acesso a dados das ocorrências (RF020 · RN023). */

export interface NovaOcorrencia {
  jornadaId: string;
  corridaId: string | null;
  tipo: TipoOcorrencia;
  descricao: string;
  ocorridoEm: Date;
  latitude: Prisma.Decimal | number | null;
  longitude: Prisma.Decimal | number | null;
  criadoPor: string;
}

export async function criarOcorrencia(
  cliente: ClientePrisma,
  dados: NovaOcorrencia,
): Promise<{ id: string }> {
  return cliente.ocorrencia.create({
    data: {
      jornadaId: dados.jornadaId,
      corridaId: dados.corridaId,
      tipo: dados.tipo,
      descricao: dados.descricao,
      ocorridoEm: dados.ocorridoEm,
      latitude: dados.latitude,
      longitude: dados.longitude,
      criadoPor: dados.criadoPor,
    },
    select: { id: true },
  });
}

const CAMPOS = {
  id: true,
  tipo: true,
  descricao: true,
  ocorridoEm: true,
  corridaId: true,
  jornadaId: true,
} as const;

export async function ocorrenciasDaJornada(cliente: ClientePrisma, jornadaId: string) {
  return cliente.ocorrencia.findMany({
    where: { jornadaId },
    select: { ...CAMPOS, registradoPor: { select: { id: true, nome: true } } },
    orderBy: { ocorridoEm: 'desc' },
  });
}

export type OcorrenciaDaJornada = Awaited<ReturnType<typeof ocorrenciasDaJornada>>[number];

/** Ocorrências do dia, para o destaque no painel do administrador (US023). */
export async function ocorrenciasDoDia(cliente: ClientePrisma, dataIso: string) {
  return cliente.ocorrencia.findMany({
    where: { ocorridoEm: { gte: inicioDoDia(dataIso), lte: fimDoDia(dataIso) } },
    select: {
      ...CAMPOS,
      registradoPor: { select: { id: true, nome: true } },
      jornada: { select: { id: true, veiculo: { select: { placa: true } } } },
    },
    orderBy: { ocorridoEm: 'desc' },
  });
}

export type OcorrenciaDoDia = Awaited<ReturnType<typeof ocorrenciasDoDia>>[number];
