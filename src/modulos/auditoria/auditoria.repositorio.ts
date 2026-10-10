import type { AcaoAuditoria, Prisma } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';

/**
 * Consulta da trilha de auditoria (US040, US041 · RF038, RF039 · RN027).
 *
 * **Só leitura.** Não existe função de escrita aqui de propósito: quem grava é
 * `auditoria.servico.ts`, chamado exclusivamente pelo `definirAcao`. Separar os
 * dois deixa evidente que consultar a trilha nunca a modifica.
 */

const CAMPOS = {
  id: true,
  acao: true,
  entidade: true,
  entidadeId: true,
  valorAnterior: true,
  valorNovo: true,
  justificativa: true,
  ip: true,
  ocorridoEm: true,
  usuario: { select: { id: true, nome: true } },
} as const;

export interface FiltrosDaTrilha {
  usuarioId?: string;
  acao?: AcaoAuditoria;
  entidade?: string;
  entidadeId?: string;
  dataInicio?: Date;
  dataFim?: Date;
  skip: number;
  take: number;
}

function montarFiltro(filtros: FiltrosDaTrilha): Prisma.LogAuditoriaWhereInput {
  return {
    ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
    ...(filtros.acao ? { acao: filtros.acao } : {}),
    ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
    ...(filtros.entidadeId ? { entidadeId: filtros.entidadeId } : {}),
    ...(filtros.dataInicio || filtros.dataFim
      ? {
          ocorridoEm: {
            ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}),
            ...(filtros.dataFim ? { lte: filtros.dataFim } : {}),
          },
        }
      : {}),
  };
}

export async function listarTrilha(cliente: ClientePrisma, filtros: FiltrosDaTrilha) {
  const where = montarFiltro(filtros);

  const [linhas, total] = await Promise.all([
    cliente.logAuditoria.findMany({
      where,
      select: CAMPOS,
      orderBy: { ocorridoEm: 'desc' },
      skip: filtros.skip,
      take: filtros.take,
    }),
    cliente.logAuditoria.count({ where }),
  ]);

  // `id` é BigInt e não atravessa a fronteira servidor/cliente nem o JSON.
  return { registros: linhas.map((linha) => ({ ...linha, id: String(linha.id) })), total };
}

export type RegistroDaTrilha = Awaited<ReturnType<typeof listarTrilha>>['registros'][number];

/**
 * Histórico de um registro específico (US041).
 *
 * Sem paginação: a linha do tempo de uma corrida tem unidades de entradas, não
 * milhares, e paginá-la esconderia a criação — que é justamente o ponto de
 * partida que dá sentido às alterações seguintes.
 */
export async function historicoDoRegistro(
  cliente: ClientePrisma,
  entidade: string,
  entidadeId: string,
) {
  const linhas = await cliente.logAuditoria.findMany({
    where: { entidade, entidadeId },
    select: CAMPOS,
    orderBy: { ocorridoEm: 'asc' },
    take: 200,
  });

  return linhas.map((linha) => ({ ...linha, id: String(linha.id) }));
}

/** Usuários que aparecem na trilha, para alimentar o filtro. */
export async function autoresDaTrilha(cliente: ClientePrisma) {
  return cliente.usuario.findMany({
    where: { auditorias: { some: {} } },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });
}
