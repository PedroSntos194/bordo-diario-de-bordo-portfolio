import type { ClientePrisma } from '@/lib/prisma';

/** Acesso a dados de veículos. Único ponto com Prisma neste módulo (doc 00 · §5). */

const CAMPOS = {
  id: true,
  placa: true,
  modelo: true,
  marca: true,
  ano: true,
  capacidadePassageiros: true,
  odometroAtual: true,
  observacoes: true,
  status: true,
  criadoEm: true,
  criadoPor: true,
} as const;

export type Veiculo = {
  id: string;
  placa: string;
  modelo: string;
  marca: string | null;
  ano: number | null;
  capacidadePassageiros: number;
  odometroAtual: number;
  observacoes: string | null;
  status: 'ATIVO' | 'INATIVO' | 'MANUTENCAO';
  criadoEm: Date;
  criadoPor: string | null;
  nomeCriador?: string | null;
};

export interface FiltrosDeVeiculo {
  busca?: string | undefined;
  status?: 'ATIVO' | 'INATIVO' | 'MANUTENCAO' | undefined;
  ordenar: 'placa' | 'modelo' | 'odometroAtual';
  direcao: 'asc' | 'desc';
  skip: number;
  take: number;
}

function montarFiltro(filtros: FiltrosDeVeiculo) {
  const busca = filtros.busca?.trim();

  return {
    ...(filtros.status ? { status: filtros.status } : {}),
    ...(busca && busca.length >= 2
      ? {
          OR: [
            // A busca por placa ignora hífen e caixa, como a pessoa digita.
            { placa: { contains: busca.toUpperCase().replace(/[^A-Z0-9]/g, '') } },
            { modelo: { contains: busca, mode: 'insensitive' as const } },
            { marca: { contains: busca, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

export async function listarVeiculos(
  cliente: ClientePrisma,
  filtros: FiltrosDeVeiculo,
): Promise<{ veiculos: Veiculo[]; total: number }> {
  const where = montarFiltro(filtros);

  const [veiculos, total] = await Promise.all([
    cliente.veiculo.findMany({
      where,
      select: CAMPOS,
      orderBy: { [filtros.ordenar]: filtros.direcao },
      skip: filtros.skip,
      take: filtros.take,
    }),
    cliente.veiculo.count({ where }),
  ]);

  const autores = [
    ...new Set(veiculos.flatMap((veiculo) => (veiculo.criadoPor ? [veiculo.criadoPor] : []))),
  ];
  const usuarios =
    autores.length === 0
      ? []
      : await cliente.usuario.findMany({
          where: { id: { in: autores } },
          select: { id: true, nome: true },
        });
  const nomes = new Map(usuarios.map((usuario) => [usuario.id, usuario.nome]));

  return {
    veiculos: veiculos.map((veiculo) => ({
      ...veiculo,
      nomeCriador: veiculo.criadoPor ? (nomes.get(veiculo.criadoPor) ?? null) : null,
    })),
    total,
  };
}

export async function contarVeiculos(cliente: ClientePrisma): Promise<number> {
  return cliente.veiculo.count();
}

export async function buscarVeiculoPorId(cliente: ClientePrisma, id: string) {
  return cliente.veiculo.findUnique({ where: { id }, select: CAMPOS });
}

export async function existeOutroComPlaca(
  cliente: ClientePrisma,
  placa: string,
  ignorarId?: string,
): Promise<boolean> {
  const encontrado = await cliente.veiculo.findFirst({
    where: { placa, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
    select: { id: true },
  });
  return encontrado !== null;
}

export interface DadosDeVeiculo {
  placa: string;
  modelo: string;
  marca: string | null;
  ano: number | null;
  capacidadePassageiros: number;
  observacoes: string | null;
}

export async function criarVeiculo(
  cliente: ClientePrisma,
  dados: DadosDeVeiculo & { odometroAtual: number; criadoPor: string },
) {
  return cliente.veiculo.create({ data: { ...dados, status: 'ATIVO' }, select: CAMPOS });
}

export async function atualizarVeiculo(
  cliente: ClientePrisma,
  id: string,
  dados: DadosDeVeiculo & { atualizadoPor: string },
) {
  return cliente.veiculo.update({ where: { id }, data: dados, select: CAMPOS });
}

export async function alterarStatusVeiculo(
  cliente: ClientePrisma,
  id: string,
  status: 'ATIVO' | 'INATIVO' | 'MANUTENCAO',
  atualizadoPor: string,
): Promise<void> {
  await cliente.veiculo.update({ where: { id }, data: { status, atualizadoPor } });
}

/** Jornada em andamento deste veículo, se houver (RN013). */
export async function jornadaAbertaDoVeiculo(cliente: ClientePrisma, veiculoId: string) {
  return cliente.jornada.findFirst({
    where: { veiculoId, status: 'ABERTA' },
    select: {
      id: true,
      data: true,
      motorista: { select: { id: true, nome: true } },
    },
  });
}

/**
 * Veículos que o motorista pode selecionar ao abrir a jornada (RF014).
 *
 * O filtro é feito na consulta, não na tela: um veículo ocupado que chegasse à
 * lista só seria recusado no envio, depois de o motorista já ter escolhido.
 */
export async function listarDisponiveis(cliente: ClientePrisma) {
  return cliente.veiculo.findMany({
    where: {
      status: 'ATIVO',
      jornadas: { none: { status: 'ABERTA' } },
    },
    select: {
      id: true,
      placa: true,
      modelo: true,
      capacidadePassageiros: true,
      odometroAtual: true,
    },
    orderBy: { placa: 'asc' },
  });
}

export type VeiculoDisponivel = Awaited<ReturnType<typeof listarDisponiveis>>[number];

/** Quais destas placas já existem (US015). Ver a nota em `chavesJaCadastradas`. */
export async function placasJaCadastradas(
  cliente: ClientePrisma,
  placas: string[],
): Promise<Set<string>> {
  if (placas.length === 0) return new Set();

  const encontrados = await cliente.veiculo.findMany({
    where: { placa: { in: placas } },
    select: { placa: true },
  });

  return new Set(encontrados.map((veiculo) => veiculo.placa));
}

/**
 * Move o odômetro da van (RN020 · US024).
 *
 * O encerramento da jornada faz o mesmo, embutido em `encerrarJornada`. O
 * abastecimento precisa da operação isolada porque acontece **no meio** do dia:
 * é o mesmo painel sendo lido, e deixar os dois valores divergirem faria a
 * abertura da jornada seguinte acusar divergência de uma quilometragem que o
 * próprio sistema já conhecia.
 *
 * Nunca recua: a regra que impede o valor menor está em `*.regras.ts`, e esta
 * função é o braço que grava.
 */
export async function atualizarOdometro(
  cliente: ClientePrisma,
  id: string,
  odometroAtual: number,
): Promise<void> {
  await cliente.veiculo.update({ where: { id }, data: { odometroAtual } });
}

// ------------------------------------------------------------ contrato

const CAMPOS_DO_CONTRATO = {
  id: true,
  placa: true,
  modelo: true,
  status: true,
  cliente: true,
  categoriaMedicao: true,
  valorMensal: true,
  valorKmExcedido: true,
  valorDiaExtra: true,
  limiteKmDia: true,
  linhaOrigem: true,
  linhaDestino: true,
} as const;

export async function buscarContratoDoVeiculo(cliente: ClientePrisma, id: string) {
  return cliente.veiculo.findUnique({ where: { id }, select: CAMPOS_DO_CONTRATO });
}

/** Contratos de todas as vans, para o boletim — as inativas também, se trabalharam no período. */
export async function contratosDosVeiculos(cliente: ClientePrisma) {
  return cliente.veiculo.findMany({ select: CAMPOS_DO_CONTRATO, orderBy: { placa: 'asc' } });
}

export type ContratoGravado = NonNullable<Awaited<ReturnType<typeof buscarContratoDoVeiculo>>>;

export async function salvarContratoDoVeiculo(
  cliente: ClientePrisma,
  id: string,
  dados: {
    cliente: string | null;
    categoriaMedicao: 'ONIBUS' | 'VAN_DIURNA' | 'VAN_NOTURNA' | null;
    valorMensal: number | null;
    valorKmExcedido: number | null;
    valorDiaExtra: number | null;
    limiteKmDia: number | null;
    linhaOrigem: string | null;
    linhaDestino: string | null;
    atualizadoPor: string;
  },
): Promise<void> {
  await cliente.veiculo.update({ where: { id }, data: dados });
}
