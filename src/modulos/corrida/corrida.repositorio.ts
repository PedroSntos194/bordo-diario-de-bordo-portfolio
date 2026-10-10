import type { ClientePrisma } from '@/lib/prisma';
import type { EntradaLocalizacao } from '@/modulos/corrida/corrida.schema';

/** Acesso a dados de corrida e pontos de localização. */

const CAMPOS = {
  id: true,
  jornadaId: true,
  rotaId: true,
  origemDescricao: true,
  destinoDescricao: true,
  iniciadaEm: true,
  encerradaEm: true,
  odometroInicial: true,
  odometroFinal: true,
  kmPercorrido: true,
  duracaoMinutos: true,
  quantidadePassageiros: true,
  observacoes: true,
  motivoCancelamento: true,
  editadaEm: true,
  status: true,
} as const;

export async function buscarCorridaPorId(cliente: ClientePrisma, id: string) {
  return cliente.corrida.findUnique({
    where: { id },
    select: {
      ...CAMPOS,
      rota: {
        select: {
          id: true,
          codigo: true,
          nome: true,
          origem: true,
          destino: true,
          // Os pontos da rota são os botões de um toque da US021.
          pontos: {
            select: { id: true, nome: true, ordem: true, endereco: true },
            orderBy: { ordem: 'asc' },
          },
        },
      },
      jornada: {
        select: {
          id: true,
          motoristaId: true,
          status: true,
          odometroInicial: true,
          veiculo: { select: { id: true, placa: true, capacidadePassageiros: true } },
        },
      },
      eventos: {
        select: {
          id: true,
          tipo: true,
          descricao: true,
          ocorridoEm: true,
          pontoParada: { select: { id: true, nome: true, ordem: true } },
        },
        orderBy: { ocorridoEm: 'asc' },
      },
      localizacoes: {
        select: {
          id: true,
          latitude: true,
          longitude: true,
          precisaoMetros: true,
          capturadoEm: true,
          origem: true,
          corridaEventoId: true,
          evento: {
            select: {
              id: true,
              tipo: true,
              descricao: true,
              pontoParada: { select: { nome: true } },
            },
          },
        },
        orderBy: { capturadoEm: 'asc' },
      },
    },
  });
}

export type CorridaDetalhada = NonNullable<Awaited<ReturnType<typeof buscarCorridaPorId>>>;

/** Corrida em andamento do motorista, se houver (RN014). */
export async function corridaEmAndamento(cliente: ClientePrisma, motoristaId: string) {
  return cliente.corrida.findFirst({
    where: { status: 'EM_ANDAMENTO', jornada: { motoristaId } },
    select: {
      ...CAMPOS,
      rota: { select: { codigo: true, nome: true } },
    },
  });
}

export async function buscarPorClientUuid(cliente: ClientePrisma, clientUuid: string) {
  return cliente.corrida.findUnique({ where: { clientUuid }, select: { id: true } });
}

/** Maior odômetro já registrado nas corridas da jornada — piso do encerramento (RN020). */
export async function maiorOdometroDaJornada(
  cliente: ClientePrisma,
  jornadaId: string,
): Promise<number | null> {
  const resultado = await cliente.corrida.aggregate({
    where: { jornadaId, status: 'ENCERRADA' },
    _max: { odometroFinal: true },
  });
  return resultado._max.odometroFinal;
}

export interface DadosDeInicio {
  jornadaId: string;
  rotaId: string | null;
  origemDescricao: string | null;
  destinoDescricao: string | null;
  iniciadaEm: Date;
  odometroInicial: number;
  clientUuid: string | null;
  criadoPor: string;
}

export async function iniciarCorrida(cliente: ClientePrisma, dados: DadosDeInicio) {
  return cliente.corrida.create({
    data: { ...dados, status: 'EM_ANDAMENTO' },
    select: CAMPOS,
  });
}

export interface DadosDeEncerramento {
  encerradaEm: Date;
  odometroFinal: number;
  kmPercorrido: number;
  duracaoMinutos: number;
  quantidadePassageiros: number | null;
  observacoes: string | null;
  atualizadoPor: string;
}

export async function encerrarCorrida(
  cliente: ClientePrisma,
  id: string,
  dados: DadosDeEncerramento,
) {
  return cliente.corrida.update({
    where: { id },
    data: { ...dados, status: 'ENCERRADA' },
    select: CAMPOS,
  });
}

export interface DadosDeCorrecao {
  odometroFinal: number;
  kmPercorrido: number;
  quantidadePassageiros: number | null;
  observacoes: string | null;
  editadaEm: Date;
  atualizadoPor: string;
}

/**
 * Aplica a correção (US022 · RN019).
 *
 * `editadaEm` é gravado junto e nunca limpo: é ele que sustenta a marcação
 * "editado" na tela, que existe para quem lê o relatório saber que aquele
 * número foi ajustado depois do fato.
 */
export async function corrigirCorrida(cliente: ClientePrisma, id: string, dados: DadosDeCorrecao) {
  return cliente.corrida.update({ where: { id }, data: dados, select: CAMPOS });
}

/**
 * Refaz o km e os passageiros guardados de um dia já encerrado (RN018).
 *
 * O encerramento grava a soma das corridas; sem isto, corrigir uma corrida
 * depois deixava a planilha de jornadas e o resumo do dia com o total antigo.
 * Dia aberto não tem total guardado, e o filtro de status o deixa intocado.
 */
export async function recalcularTotaisDoDiaEncerrado(
  cliente: ClientePrisma,
  jornadaId: string,
  atualizadoPor: string,
): Promise<void> {
  const soma = await cliente.corrida.aggregate({
    where: { jornadaId, status: 'ENCERRADA' },
    _sum: { kmPercorrido: true, quantidadePassageiros: true },
  });
  await cliente.jornada.updateMany({
    where: { id: jornadaId, status: 'ENCERRADA' },
    data: {
      kmTotal: soma._sum.kmPercorrido ?? 0,
      totalPassageiros: soma._sum.quantidadePassageiros ?? 0,
      atualizadoPor,
    },
  });
}

export async function cancelarCorrida(
  cliente: ClientePrisma,
  id: string,
  motivo: string,
  atualizadoPor: string,
): Promise<void> {
  await cliente.corrida.update({
    where: { id },
    data: { status: 'CANCELADA', motivoCancelamento: motivo, atualizadoPor },
  });
}

/**
 * Grava o ponto de localização de um marco da corrida.
 *
 * Falha aqui **não** desfaz o registro operacional (RN022): a corrida vale sem
 * coordenada. Por isso o chamador trata o erro em vez de deixá-lo subir.
 */
export async function registrarLocalizacao(
  cliente: ClientePrisma,
  corridaId: string,
  localizacao: EntradaLocalizacao,
  /**
   * Evento que originou a captura, quando houver (US021).
   *
   * É o que permite ao mapa do trajeto dizer *o que* aconteceu em cada ponto —
   * "chegada no Terminal Norte" em vez de uma coordenada solta.
   */
  corridaEventoId?: string,
): Promise<void> {
  await cliente.pontoLocalizacao.create({
    data: {
      corridaId,
      corridaEventoId: corridaEventoId ?? null,
      latitude: localizacao.latitude,
      longitude: localizacao.longitude,
      precisaoMetros: localizacao.precisaoMetros ?? null,
      origem: 'GPS',
      capturadoEm: localizacao.capturadoEm ? new Date(localizacao.capturadoEm) : new Date(),
    },
  });
}

/** Corridas de uma jornada, para consolidar os totais no encerramento (RN018). */
export async function corridasDaJornada(cliente: ClientePrisma, jornadaId: string) {
  return cliente.corrida.findMany({
    where: { jornadaId },
    select: {
      kmPercorrido: true,
      duracaoMinutos: true,
      quantidadePassageiros: true,
      status: true,
    },
  });
}

// ---------------------------------------------------------------- listagem

export interface FiltrosDeCorrida {
  dataInicio?: string | undefined;
  dataFim?: string | undefined;
  motoristaId?: string | undefined;
  veiculoId?: string | undefined;
  rotaId?: string | undefined;
  status?: 'EM_ANDAMENTO' | 'ENCERRADA' | 'CANCELADA' | undefined;
  ordenar: 'iniciadaEm' | 'kmPercorrido';
  direcao: 'asc' | 'desc';
  skip: number;
  take: number;
}

function montarFiltroDeCorrida(filtros: FiltrosDeCorrida) {
  const inicio = filtros.dataInicio ? new Date(`${filtros.dataInicio}T00:00:00Z`) : undefined;
  const fim = filtros.dataFim ? new Date(`${filtros.dataFim}T00:00:00Z`) : undefined;

  // O filtro de período usa a **data operacional da jornada**, não o instante
  // de início da corrida: uma corrida que começa 23h50 pertence ao dia dela.
  const porData =
    inicio || fim
      ? { data: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } }
      : {};

  const porJornada = {
    ...porData,
    ...(filtros.motoristaId ? { motoristaId: filtros.motoristaId } : {}),
    ...(filtros.veiculoId ? { veiculoId: filtros.veiculoId } : {}),
  };

  return {
    ...(Object.keys(porJornada).length > 0 ? { jornada: porJornada } : {}),
    ...(filtros.rotaId ? { rotaId: filtros.rotaId } : {}),
    ...(filtros.status ? { status: filtros.status } : {}),
  };
}

export async function listarCorridas(cliente: ClientePrisma, filtros: FiltrosDeCorrida) {
  const where = montarFiltroDeCorrida(filtros);

  const [corridas, total] = await Promise.all([
    cliente.corrida.findMany({
      where,
      select: {
        ...CAMPOS,
        rota: { select: { codigo: true, nome: true } },
        jornada: {
          select: {
            id: true,
            data: true,
            motorista: { select: { id: true, nome: true } },
            veiculo: { select: { placa: true } },
          },
        },
        _count: { select: { localizacoes: true } },
      },
      orderBy: { [filtros.ordenar]: filtros.direcao },
      skip: filtros.skip,
      take: filtros.take,
    }),
    cliente.corrida.count({ where }),
  ]);

  return { corridas, total };
}

/** Uma página do recorte — ver a nota em `paginaDeJornadas` (US031). */
export async function paginaDeCorridas(cliente: ClientePrisma, filtros: FiltrosDeCorrida) {
  return cliente.corrida.findMany({
    where: montarFiltroDeCorrida(filtros),
    select: {
      ...CAMPOS,
      rota: { select: { codigo: true, nome: true } },
      jornada: {
        select: {
          id: true,
          data: true,
          motorista: { select: { id: true, nome: true } },
          veiculo: { select: { placa: true } },
        },
      },
      _count: { select: { localizacoes: true } },
    },
    orderBy: [{ [filtros.ordenar]: filtros.direcao }, { id: 'asc' }],
    skip: filtros.skip,
    take: filtros.take,
  });
}

/** Só a contagem do recorte — ver a nota em `contarJornadas` (US031). */
export async function contarCorridas(
  cliente: ClientePrisma,
  filtros: Omit<FiltrosDeCorrida, 'skip' | 'take' | 'ordenar' | 'direcao'>,
): Promise<number> {
  return cliente.corrida.count({
    where: montarFiltroDeCorrida({
      ...filtros,
      ordenar: 'iniciadaEm',
      direcao: 'desc',
      skip: 0,
      take: 0,
    }),
  });
}

export type CorridaDaListagem = Awaited<ReturnType<typeof listarCorridas>>['corridas'][number];
