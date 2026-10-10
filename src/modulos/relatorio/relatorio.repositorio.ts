import type { ClientePrisma } from '@/lib/prisma';
import { fimDoDia, inicioDoDia } from '@/utilitarios/data';
import { filtroMotoristaEscalado } from '@/modulos/escala/escala.repositorio';

/**
 * Consultas de leitura do painel e do resumo do dia (US026, US030).
 *
 * Separadas dos repositórios de jornada e corrida porque a pergunta é outra:
 * ali é "como está este registro", aqui é "como está a operação". As consultas
 * agregam, e agregação tem necessidades próprias de índice e de contorno.
 */

function intervaloDoDia(dataIso: string): { gte: Date; lte: Date } {
  return { gte: inicioDoDia(dataIso), lte: fimDoDia(dataIso) };
}

/** A data operacional é um `date` puro no banco, sem hora (RN012). */
function comoDataOperacional(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00Z`);
}

export interface IndicadoresDoDia {
  jornadasAbertas: number;
  jornadasEncerradas: number;
  corridasEmAndamento: number;
  corridasEncerradas: number;
  kmTotal: number;
  veiculosEmOperacao: number;
  ocorrencias: number;
  motoristasSemRegistro: number;
}

export async function indicadoresDoDia(
  cliente: ClientePrisma,
  dataIso: string,
): Promise<IndicadoresDoDia> {
  const data = comoDataOperacional(dataIso);

  const [
    jornadasAbertas,
    jornadasEncerradas,
    corridasEmAndamento,
    corridasEncerradas,
    somaKm,
    veiculosEmOperacao,
    ocorrencias,
    motoristasSemRegistro,
  ] = await Promise.all([
    cliente.jornada.count({ where: { data, status: 'ABERTA' } }),
    cliente.jornada.count({ where: { data, status: 'ENCERRADA' } }),
    cliente.corrida.count({ where: { jornada: { data }, status: 'EM_ANDAMENTO' } }),
    cliente.corrida.count({ where: { jornada: { data }, status: 'ENCERRADA' } }),
    cliente.corrida.aggregate({
      where: { jornada: { data }, status: 'ENCERRADA' },
      _sum: { kmPercorrido: true },
    }),
    cliente.jornada
      .findMany({ where: { data }, select: { veiculoId: true }, distinct: ['veiculoId'] })
      .then((linhas) => linhas.length),
    cliente.ocorrencia.count({ where: { ocorridoEm: intervaloDoDia(dataIso) } }),
    cliente.usuario.count({
      where: { ...filtroMotoristaEscalado(dataIso), jornadas: { none: { data } } },
    }),
  ]);

  return {
    jornadasAbertas,
    jornadasEncerradas,
    corridasEmAndamento,
    corridasEncerradas,
    kmTotal: Number(somaKm._sum.kmPercorrido ?? 0),
    veiculosEmOperacao,
    ocorrencias,
    motoristasSemRegistro,
  };
}

/** Corridas rodando agora, para o administrador acompanhar (US026). */
export async function corridasEmAndamentoAgora(cliente: ClientePrisma, dataIso: string) {
  return cliente.corrida.findMany({
    where: { status: 'EM_ANDAMENTO', jornada: { data: comoDataOperacional(dataIso) } },
    select: {
      id: true,
      iniciadaEm: true,
      origemDescricao: true,
      destinoDescricao: true,
      rota: { select: { codigo: true, nome: true } },
      jornada: {
        select: {
          motorista: { select: { id: true, nome: true } },
          veiculo: { select: { placa: true } },
        },
      },
    },
    orderBy: { iniciadaEm: 'asc' },
  });
}

export type CorridaAgora = Awaited<ReturnType<typeof corridasEmAndamentoAgora>>[number];

/** Motoristas ativos sem jornada no dia — a pendência que o sistema cobra (US038). */
export async function motoristasSemRegistro(cliente: ClientePrisma, dataIso: string) {
  return cliente.usuario.findMany({
    where: {
      ...filtroMotoristaEscalado(dataIso),
      jornadas: { none: { data: comoDataOperacional(dataIso) } },
    },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });
}

/** Inclui quem tem histórico, mesmo que o cadastro não esteja mais ativo. */
export async function motoristasComJornada(cliente: ClientePrisma) {
  return cliente.usuario.findMany({
    where: { jornadas: { some: {} } },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });
}

/**
 * Resumo do dia por motorista (US030 · RF030).
 *
 * Só jornadas **encerradas** compõem o consolidado (RN017). As abertas aparecem
 * em separado, como pendência: um dia ainda em curso não tem total confiável, e
 * misturá-lo ao consolidado faria o relatório mudar sozinho ao longo da tarde.
 */
export async function resumoPorMotorista(
  cliente: ClientePrisma,
  dataIso: string,
  motoristaId?: string,
) {
  return cliente.jornada.findMany({
    where: { data: comoDataOperacional(dataIso), ...(motoristaId ? { motoristaId } : {}) },
    select: {
      id: true,
      status: true,
      iniciadaEm: true,
      encerradaEm: true,
      odometroInicial: true,
      odometroFinal: true,
      kmTotal: true,
      totalCorridas: true,
      totalPassageiros: true,
      duracaoMinutos: true,
      observacoes: true,
      motorista: { select: { id: true, nome: true } },
      veiculo: { select: { placa: true, modelo: true } },
      corridas: {
        select: {
          id: true,
          status: true,
          iniciadaEm: true,
          encerradaEm: true,
          odometroInicial: true,
          odometroFinal: true,
          kmPercorrido: true,
          quantidadePassageiros: true,
          observacoes: true,
          rota: { select: { codigo: true, nome: true, origem: true, destino: true } },
          origemDescricao: true,
          destinoDescricao: true,
        },
        orderBy: { iniciadaEm: 'asc' },
      },
      ocorrencias: { select: { id: true, tipo: true, descricao: true } },
    },
    orderBy: { motorista: { nome: 'asc' } },
  });
}

export type JornadaDoResumo = Awaited<ReturnType<typeof resumoPorMotorista>>[number];
