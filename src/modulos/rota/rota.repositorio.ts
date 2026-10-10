import type { ClientePrisma } from '@/lib/prisma';

/** Acesso a dados de rotas e pontos de parada. */

const CAMPOS_ROTA = {
  id: true,
  codigo: true,
  nome: true,
  origem: true,
  destino: true,
  turno: true,
  distanciaEstimadaKm: true,
  status: true,
  criadoEm: true,
} as const;

export interface Rota {
  id: string;
  codigo: string;
  nome: string;
  origem: string;
  destino: string;
  turno: 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL';
  /** `Decimal` do Prisma chega serializado como string. */
  distanciaEstimadaKm: unknown;
  status: 'ATIVA' | 'INATIVA';
  criadoEm: Date;
}

export interface PontoDeParada {
  id: string;
  ordem: number;
  nome: string;
  endereco: string | null;
  latitude: unknown;
  longitude: unknown;
}

export interface FiltrosDeRota {
  busca?: string | undefined;
  turno?: 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL' | undefined;
  status?: 'ATIVA' | 'INATIVA' | undefined;
  ordenar: 'codigo' | 'nome';
  direcao: 'asc' | 'desc';
  skip: number;
  take: number;
}

function montarFiltro(filtros: FiltrosDeRota) {
  const busca = filtros.busca?.trim();

  return {
    ...(filtros.status ? { status: filtros.status } : {}),
    ...(filtros.turno ? { turno: filtros.turno } : {}),
    ...(busca && busca.length >= 2
      ? {
          OR: [
            { codigo: { contains: busca.toUpperCase() } },
            { nome: { contains: busca, mode: 'insensitive' as const } },
            { origem: { contains: busca, mode: 'insensitive' as const } },
            { destino: { contains: busca, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

export async function listarRotas(cliente: ClientePrisma, filtros: FiltrosDeRota) {
  const where = montarFiltro(filtros);

  const [rotas, total] = await Promise.all([
    cliente.rota.findMany({
      where,
      select: { ...CAMPOS_ROTA, _count: { select: { pontos: true } } },
      orderBy: { [filtros.ordenar]: filtros.direcao },
      skip: filtros.skip,
      take: filtros.take,
    }),
    cliente.rota.count({ where }),
  ]);

  return { rotas, total };
}

export type RotaDaListagem = Awaited<ReturnType<typeof listarRotas>>['rotas'][number];

export async function contarRotas(cliente: ClientePrisma): Promise<number> {
  return cliente.rota.count();
}

export async function buscarRotaPorId(cliente: ClientePrisma, id: string) {
  return cliente.rota.findUnique({
    where: { id },
    select: {
      ...CAMPOS_ROTA,
      pontos: {
        select: {
          id: true,
          ordem: true,
          nome: true,
          endereco: true,
          latitude: true,
          longitude: true,
        },
        orderBy: { ordem: 'asc' },
      },
    },
  });
}

export type RotaDetalhada = NonNullable<Awaited<ReturnType<typeof buscarRotaPorId>>>;

export async function existeOutraComCodigo(
  cliente: ClientePrisma,
  codigo: string,
  ignorarId?: string,
): Promise<boolean> {
  const encontrada = await cliente.rota.findFirst({
    where: { codigo, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
    select: { id: true },
  });
  return encontrada !== null;
}

export interface DadosDeRota {
  codigo: string;
  nome: string;
  origem: string;
  destino: string;
  turno: 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL';
  distanciaEstimadaKm: number | null;
}

export async function criarRota(
  cliente: ClientePrisma,
  dados: DadosDeRota & { criadoPor: string },
) {
  return cliente.rota.create({ data: { ...dados, status: 'ATIVA' }, select: CAMPOS_ROTA });
}

export async function atualizarRota(
  cliente: ClientePrisma,
  id: string,
  dados: DadosDeRota & { atualizadoPor: string },
) {
  return cliente.rota.update({ where: { id }, data: dados, select: CAMPOS_ROTA });
}

export async function alterarStatusRota(
  cliente: ClientePrisma,
  id: string,
  status: 'ATIVA' | 'INATIVA',
  atualizadoPor: string,
): Promise<void> {
  await cliente.rota.update({ where: { id }, data: { status, atualizadoPor } });
}

export interface PontoParaSalvar {
  nome: string;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Substitui a lista de pontos da rota.
 *
 * Roda dentro da transação da ação: apagar e recriar precisa ser atômico, ou
 * uma falha no meio deixaria a rota sem nenhuma parada.
 *
 * Pontos referenciados por eventos de corridas antigas não são apagados — o
 * `onDelete` desses eventos é `SetNull` por padrão no Prisma para relação
 * opcional, de modo que o histórico continua legível pela descrição do evento.
 */
export async function substituirPontos(
  cliente: ClientePrisma,
  rotaId: string,
  pontos: PontoParaSalvar[],
): Promise<void> {
  await cliente.pontoParada.deleteMany({ where: { rotaId } });

  if (pontos.length === 0) return;

  await cliente.pontoParada.createMany({
    data: pontos.map((ponto, indice) => ({
      rotaId,
      ordem: indice + 1,
      nome: ponto.nome,
      endereco: ponto.endereco,
      latitude: ponto.latitude,
      longitude: ponto.longitude,
    })),
  });
}

/** Rotas ativas para o motorista escolher ao iniciar a corrida (RF015). */
export async function listarRotasAtivas(cliente: ClientePrisma) {
  return cliente.rota.findMany({
    where: { status: 'ATIVA' },
    select: { id: true, codigo: true, nome: true, origem: true, destino: true, turno: true },
    orderBy: { codigo: 'asc' },
  });
}

/** Quais destes códigos já existem (US015). Ver a nota em `chavesJaCadastradas`. */
export async function codigosJaCadastrados(
  cliente: ClientePrisma,
  codigos: string[],
): Promise<Set<string>> {
  if (codigos.length === 0) return new Set();

  const encontradas = await cliente.rota.findMany({
    where: { codigo: { in: codigos } },
    select: { codigo: true },
  });

  return new Set(encontradas.map((rota) => rota.codigo));
}
