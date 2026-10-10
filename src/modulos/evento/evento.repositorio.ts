import type { TipoEvento } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';

/** Acesso a dados dos eventos da corrida (RF017). */

export interface NovoEvento {
  corridaId: string;
  pontoParadaId: string | null;
  tipo: TipoEvento;
  descricao: string | null;
  ocorridoEm: Date;
  clientUuid: string | null;
  criadoPor: string;
}

export async function criarEvento(
  cliente: ClientePrisma,
  dados: NovoEvento,
): Promise<{ id: string }> {
  return cliente.corridaEvento.create({ data: dados, select: { id: true } });
}

const CAMPOS = {
  id: true,
  tipo: true,
  descricao: true,
  ocorridoEm: true,
  corridaId: true,
  pontoParadaId: true,
} as const;

export async function eventosDaCorrida(cliente: ClientePrisma, corridaId: string) {
  return cliente.corridaEvento.findMany({
    where: { corridaId },
    select: {
      ...CAMPOS,
      pontoParada: { select: { id: true, nome: true, ordem: true } },
      localizacoes: {
        select: { latitude: true, longitude: true, precisaoMetros: true },
        take: 1,
      },
    },
    // Cronológica: a linha do tempo da corrida é lida de cima para baixo.
    orderBy: { ocorridoEm: 'asc' },
  });
}

export type EventoDaCorrida = Awaited<ReturnType<typeof eventosDaCorrida>>[number];

export async function buscarEventoPorId(cliente: ClientePrisma, id: string) {
  return cliente.corridaEvento.findUnique({
    where: { id },
    select: {
      ...CAMPOS,
      criadoPor: true,
      corrida: { select: { id: true, status: true, jornada: { select: { motoristaId: true } } } },
    },
  });
}

export async function buscarPorClientUuid(cliente: ClientePrisma, clientUuid: string) {
  return cliente.corridaEvento.findUnique({ where: { clientUuid }, select: { id: true } });
}

/**
 * Remove o evento. Os pontos de localização vão junto por cascade — desfazer
 * precisa apagar o registro inteiro, não deixar a coordenada órfã de um evento
 * que o motorista já disse que não aconteceu.
 */
export async function removerEvento(cliente: ClientePrisma, id: string): Promise<void> {
  await cliente.corridaEvento.delete({ where: { id } });
}

/** Ponto de parada com a rota a que pertence, para conferir o vínculo. */
export async function buscarPontoParada(cliente: ClientePrisma, id: string) {
  return cliente.pontoParada.findUnique({
    where: { id },
    select: { id: true, nome: true, ordem: true, rotaId: true },
  });
}
