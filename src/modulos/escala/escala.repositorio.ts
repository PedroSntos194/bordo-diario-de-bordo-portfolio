import type { Turno } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';

/** Acesso a dados da escala (US014 · RF013). */

/** A data da escala é um `date` puro no banco, sem hora (como a da jornada). */
function comoDataOperacional(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00Z`);
}

/** Uma pessoa ativa só deve ser cobrada se foi escalada e não está de folga. */
export function filtroMotoristaEscalado(dataIso: string) {
  const data = comoDataOperacional(dataIso);
  return {
    perfil: 'MOTORISTA' as const,
    status: 'ATIVO' as const,
    escalas: { some: { data } },
    folgas: { none: { data, ativa: true } },
  };
}

export async function folgasDoDia(cliente: ClientePrisma, dataIso: string) {
  return cliente.folga.findMany({
    where: { data: comoDataOperacional(dataIso), ativa: true },
    select: { id: true, observacoes: true, motorista: { select: { id: true, nome: true } } },
    orderBy: { motorista: { nome: 'asc' } },
  });
}

export async function buscarFolga(cliente: ClientePrisma, id: string) {
  return cliente.folga.findUnique({ where: { id } });
}

export async function folgaDoMotorista(
  cliente: ClientePrisma,
  motoristaId: string,
  dataIso: string,
) {
  return cliente.folga.findUnique({
    where: { data_motoristaId: { data: comoDataOperacional(dataIso), motoristaId } },
  });
}

export async function salvarFolga(
  cliente: ClientePrisma,
  dados: { data: string; motoristaId: string; observacoes: string | null; usuarioId: string },
) {
  const data = comoDataOperacional(dados.data);
  return cliente.folga.upsert({
    where: { data_motoristaId: { data, motoristaId: dados.motoristaId } },
    create: {
      data,
      motoristaId: dados.motoristaId,
      observacoes: dados.observacoes,
      criadoPor: dados.usuarioId,
    },
    update: { ativa: true, observacoes: dados.observacoes, atualizadoPor: dados.usuarioId },
  });
}

export async function desativarFolga(cliente: ClientePrisma, id: string, usuarioId: string) {
  return cliente.folga.update({ where: { id }, data: { ativa: false, atualizadoPor: usuarioId } });
}

const CAMPOS = {
  id: true,
  data: true,
  turno: true,
  motorista: { select: { id: true, nome: true } },
  veiculo: { select: { id: true, placa: true, modelo: true } },
  rotas: {
    select: { rota: { select: { id: true, codigo: true, nome: true } }, ordem: true },
    orderBy: { ordem: 'asc' },
  },
} as const;

export async function escalasDoDia(cliente: ClientePrisma, dataIso: string) {
  return cliente.escala.findMany({
    where: { data: comoDataOperacional(dataIso) },
    select: CAMPOS,
    orderBy: [{ turno: 'asc' }, { veiculo: { placa: 'asc' } }],
  });
}

export type EscalaDaTela = Awaited<ReturnType<typeof escalasDoDia>>[number];

/**
 * Escala de um motorista numa data.
 *
 * É o que a abertura da jornada consulta para pré-preencher, e o que o painel
 * usa para detectar divergência. Um motorista pode ter mais de uma escala no
 * dia (manhã e tarde, em vans diferentes): a lista volta inteira, e quem
 * escolhe é o consumidor.
 */
export async function escalasDoMotorista(
  cliente: ClientePrisma,
  motoristaId: string,
  dataIso: string,
) {
  return cliente.escala.findMany({
    where: { motoristaId, data: comoDataOperacional(dataIso) },
    select: CAMPOS,
    orderBy: { turno: 'asc' },
  });
}

/** Escalas já existentes de uma van naquele dia — para checar conflito. */
export async function escalasDoVeiculo(cliente: ClientePrisma, veiculoId: string, dataIso: string) {
  return cliente.escala.findMany({
    where: { veiculoId, data: comoDataOperacional(dataIso) },
    select: {
      turno: true,
      motorista: { select: { nome: true } },
      veiculo: { select: { placa: true } },
    },
  });
}

export interface NovaEscala {
  data: string;
  motoristaId: string;
  veiculoId: string;
  turno: Turno;
  rotaIds: string[];
  criadoPor: string;
}

export async function criarEscala(cliente: ClientePrisma, dados: NovaEscala) {
  return cliente.escala.create({
    data: {
      data: comoDataOperacional(dados.data),
      motoristaId: dados.motoristaId,
      veiculoId: dados.veiculoId,
      turno: dados.turno,
      criadoPor: dados.criadoPor,
      rotas: {
        create: dados.rotaIds.map((rotaId, indice) => ({ rotaId, ordem: indice + 1 })),
      },
    },
    select: CAMPOS,
  });
}

export async function buscarEscalaPorId(cliente: ClientePrisma, id: string) {
  return cliente.escala.findUnique({ where: { id }, select: CAMPOS });
}

/** A remoção leva as rotas junto, pelo `onDelete: Cascade` da tabela de ligação. */
export async function removerEscala(cliente: ClientePrisma, id: string): Promise<void> {
  await cliente.escala.delete({ where: { id } });
}

/** Escalas já gravadas num intervalo de datas, inclusive — para a repetição checar conflito. */
export async function escalasNoPeriodo(cliente: ClientePrisma, inicioIso: string, fimIso: string) {
  return cliente.escala.findMany({
    where: { data: { gte: comoDataOperacional(inicioIso), lte: comoDataOperacional(fimIso) } },
    select: { data: true, turno: true, motoristaId: true, veiculoId: true },
  });
}

/** Folgas ativas num intervalo de datas, inclusive. */
export async function folgasNoPeriodo(cliente: ClientePrisma, inicioIso: string, fimIso: string) {
  return cliente.folga.findMany({
    where: {
      ativa: true,
      data: { gte: comoDataOperacional(inicioIso), lte: comoDataOperacional(fimIso) },
    },
    select: { data: true, motoristaId: true },
  });
}
