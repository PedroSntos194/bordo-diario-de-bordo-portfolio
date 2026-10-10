import type { ClientePrisma } from '@/lib/prisma';

/** Acesso a dados de jornada. */

const CAMPOS = {
  id: true,
  data: true,
  iniciadaEm: true,
  encerradaEm: true,
  odometroInicial: true,
  odometroFinal: true,
  kmTotal: true,
  totalCorridas: true,
  totalPassageiros: true,
  duracaoMinutos: true,
  observacoes: true,
  status: true,
} as const;

const VEICULO_RESUMIDO = {
  select: {
    id: true,
    placa: true,
    modelo: true,
    capacidadePassageiros: true,
    odometroAtual: true,
  },
} as const;

/**
 * Jornada do motorista em uma data (RN012 — no máximo uma).
 *
 * A data vem como texto `AAAA-MM-DD` porque é calculada no fuso da operação,
 * não no fuso do servidor (ver `utilitarios/data.ts`).
 */
export async function buscarJornadaDoDia(
  cliente: ClientePrisma,
  motoristaId: string,
  dataIso: string,
) {
  return cliente.jornada.findFirst({
    where: {
      motoristaId,
      data: new Date(`${dataIso}T00:00:00Z`),
      status: { not: 'CANCELADA' },
    },
    select: {
      ...CAMPOS,
      veiculo: VEICULO_RESUMIDO,
      corridas: {
        select: {
          id: true,
          iniciadaEm: true,
          encerradaEm: true,
          kmPercorrido: true,
          quantidadePassageiros: true,
          status: true,
          rota: { select: { id: true, codigo: true, nome: true } },
          origemDescricao: true,
          destinoDescricao: true,
        },
        orderBy: { iniciadaEm: 'asc' },
      },
    },
  });
}

export type JornadaDoDia = NonNullable<Awaited<ReturnType<typeof buscarJornadaDoDia>>>;

/** Busca por identificador local, para não duplicar registro sincronizado (RN025). */
export async function buscarPorClientUuid(cliente: ClientePrisma, clientUuid: string) {
  return cliente.jornada.findUnique({ where: { clientUuid }, select: { id: true } });
}

export interface DadosDeAbertura {
  motoristaId: string;
  veiculoId: string;
  dataIso: string;
  iniciadaEm: Date;
  /** O horário veio do celular, registrado sem sinal — ver `horarioDoRegistro`. */
  inicioPeloAparelho?: boolean;
  odometroInicial: number;
  clientUuid: string | null;
  criadoPor: string;
}

export async function abrirJornada(cliente: ClientePrisma, dados: DadosDeAbertura) {
  return cliente.jornada.create({
    data: {
      motoristaId: dados.motoristaId,
      veiculoId: dados.veiculoId,
      data: new Date(`${dados.dataIso}T00:00:00Z`),
      iniciadaEm: dados.iniciadaEm,
      inicioPeloAparelho: dados.inicioPeloAparelho ?? false,
      odometroInicial: dados.odometroInicial,
      clientUuid: dados.clientUuid,
      status: 'ABERTA',
      criadoPor: dados.criadoPor,
    },
    select: { ...CAMPOS, veiculo: VEICULO_RESUMIDO },
  });
}

export async function buscarJornadaPorId(cliente: ClientePrisma, id: string) {
  return cliente.jornada.findUnique({
    where: { id },
    select: {
      ...CAMPOS,
      motoristaId: true,
      veiculo: VEICULO_RESUMIDO,
      motorista: { select: { id: true, nome: true } },
    },
  });
}

export type JornadaDetalhada = NonNullable<Awaited<ReturnType<typeof buscarJornadaPorId>>>;

export interface TotaisParaGravar {
  encerradaEm: Date;
  /** O horário veio do celular, registrado sem sinal — ver `horarioDoRegistro`. */
  fimPeloAparelho?: boolean;
  odometroFinal: number;
  kmTotal: number;
  totalCorridas: number;
  totalPassageiros: number;
  duracaoMinutos: number;
  observacoes: string | null;
  atualizadoPor: string;
}

/**
 * Encerra a jornada e **avança o odômetro do veículo** na mesma transação.
 *
 * Os dois precisam andar juntos: se a jornada fechasse e o odômetro do veículo
 * ficasse para trás, a próxima abertura aceitaria uma leitura menor do que a
 * van realmente tem (RN020) e o histórico de quilometragem perderia o sentido.
 */
export async function encerrarJornada(
  cliente: ClientePrisma,
  id: string,
  veiculoId: string,
  totais: TotaisParaGravar,
) {
  const jornada = await cliente.jornada.update({
    where: { id },
    data: { ...totais, status: 'ENCERRADA' },
    select: { ...CAMPOS, veiculo: VEICULO_RESUMIDO },
  });

  await cliente.veiculo.update({
    where: { id: veiculoId },
    data: { odometroAtual: totais.odometroFinal },
  });

  return jornada;
}

/** Uma jornada aberta do motorista, em qualquer data (RN014). */
/**
 * O dia em aberto do motorista, de qualquer data.
 *
 * **O mais antigo primeiro.** Normalmente há no máximo um — a tela esconde o
 * "Iniciar meu dia" enquanto houver dia pendente —, mas a abertura só confere
 * se a *van* está ocupada, não se o *motorista* tem outro dia aberto. Sem a
 * ordem, com dois abertos o `findFirst` escolheria um ao acaso, e a tela de
 * encerrar poderia mostrar um dia enquanto a ação encerra outro.
 */
export async function jornadaAbertaDoMotorista(cliente: ClientePrisma, motoristaId: string) {
  return cliente.jornada.findFirst({
    where: { motoristaId, status: 'ABERTA' },
    orderBy: { data: 'asc' },
    select: { id: true, data: true, veiculo: VEICULO_RESUMIDO },
  });
}

/** O odômetro da van preserva o piso de um encerramento anterior, mesmo após reabrir. */
export async function jornadaAbertaParaCorrida(cliente: ClientePrisma, motoristaId: string) {
  return cliente.jornada.findFirst({
    where: { motoristaId, status: 'ABERTA' },
    select: {
      id: true,
      odometroInicial: true,
      veiculo: { select: { odometroAtual: true } },
    },
  });
}

// ---------------------------------------------------------------- listagem

export interface FiltrosDeJornada {
  dataInicio?: string | undefined;
  dataFim?: string | undefined;
  motoristaId?: string | undefined;
  veiculoId?: string | undefined;
  status?: 'ABERTA' | 'ENCERRADA' | 'CANCELADA' | undefined;
  ordenar: 'data' | 'motorista' | 'kmTotal';
  direcao: 'asc' | 'desc';
  skip: number;
  take: number;
}

function montarFiltroDeJornada(filtros: FiltrosDeJornada) {
  const inicio = filtros.dataInicio ? new Date(`${filtros.dataInicio}T00:00:00Z`) : undefined;
  const fim = filtros.dataFim ? new Date(`${filtros.dataFim}T00:00:00Z`) : undefined;

  return {
    ...(inicio || fim
      ? { data: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } }
      : {}),
    ...(filtros.motoristaId ? { motoristaId: filtros.motoristaId } : {}),
    ...(filtros.veiculoId ? { veiculoId: filtros.veiculoId } : {}),
    ...(filtros.status ? { status: filtros.status } : {}),
  };
}

export async function listarJornadas(cliente: ClientePrisma, filtros: FiltrosDeJornada) {
  const where = montarFiltroDeJornada(filtros);

  const ordem =
    filtros.ordenar === 'motorista'
      ? { motorista: { nome: filtros.direcao } }
      : { [filtros.ordenar]: filtros.direcao };

  const [jornadas, total] = await Promise.all([
    cliente.jornada.findMany({
      where,
      select: {
        ...CAMPOS,
        motorista: { select: { id: true, nome: true } },
        veiculo: { select: { id: true, placa: true } },
        _count: { select: { corridas: true } },
      },
      orderBy: ordem,
      skip: filtros.skip,
      take: filtros.take,
    }),
    cliente.jornada.count({ where }),
  ]);

  return { jornadas, total };
}

/**
 * Uma página do recorte, para a geração em segundo plano (US031).
 *
 * Duas diferenças em relação à listagem, e as duas importam:
 *
 * 1. **Não conta.** A listagem devolve o total junto porque a tela precisa
 *    paginar; aqui a contagem já foi feita uma vez na admissão, e repeti-la a
 *    cada página custaria uma varredura por página.
 *
 * 2. **Desempata por `id`.** Nenhum dos campos de ordenação é único — dezenas
 *    de jornadas dividem a mesma `data` —, e o PostgreSQL não promete ordem
 *    estável entre dois `LIMIT/OFFSET` sobre chaves repetidas. Sem o desempate,
 *    a mesma linha poderia sair duas vezes numa página e sumir da seguinte, e o
 *    defeito só apareceria em exportação grande, que é justamente a que ninguém
 *    confere linha a linha.
 *
 * O que o desempate **não** resolve é uma inserção acontecendo durante a
 * geração: um registro novo dentro do período empurra as páginas seguintes. Na
 * prática só alcança quem exporta o próprio dia corrente com mais de cinco mil
 * linhas; o recorte histórico, que é o caso desta funcionalidade, é imutável.
 */
export async function paginaDeJornadas(cliente: ClientePrisma, filtros: FiltrosDeJornada) {
  const ordem =
    filtros.ordenar === 'motorista'
      ? { motorista: { nome: filtros.direcao } }
      : { [filtros.ordenar]: filtros.direcao };

  return cliente.jornada.findMany({
    where: montarFiltroDeJornada(filtros),
    select: {
      ...CAMPOS,
      motorista: { select: { id: true, nome: true } },
      veiculo: { select: { id: true, placa: true } },
      _count: { select: { corridas: true } },
    },
    orderBy: [ordem, { id: 'asc' }],
    skip: filtros.skip,
    take: filtros.take,
  });
}

/**
 * Só a contagem do recorte, sem trazer registro nenhum.
 *
 * Existe para a admissão da exportação (US031), que precisa saber o tamanho
 * **antes** de decidir se gera na hora ou manda para o segundo plano. Carregar
 * as linhas para depois descobrir que não vai usá-las é o desperdício que este
 * caminho existe para evitar.
 *
 * Reaproveita `montarFiltroDeJornada` de propósito: uma condição escrita duas
 * vezes é uma condição que um dia vai divergir, e aí a contagem passaria a
 * descrever um recorte diferente do exportado.
 */
export async function contarJornadas(
  cliente: ClientePrisma,
  filtros: Omit<FiltrosDeJornada, 'skip' | 'take' | 'ordenar' | 'direcao'>,
): Promise<number> {
  return cliente.jornada.count({
    where: montarFiltroDeJornada({
      ...filtros,
      ordenar: 'data',
      direcao: 'desc',
      skip: 0,
      take: 0,
    }),
  });
}

export type JornadaDaListagem = Awaited<ReturnType<typeof listarJornadas>>['jornadas'][number];

/** Detalhe completo para a tela T16 (US028). */
export async function buscarJornadaCompleta(cliente: ClientePrisma, id: string) {
  return cliente.jornada.findUnique({
    where: { id },
    select: {
      ...CAMPOS,
      motoristaId: true,
      motorista: { select: { id: true, nome: true } },
      veiculo: { select: { id: true, placa: true, modelo: true, capacidadePassageiros: true } },
      corridas: {
        select: {
          id: true,
          status: true,
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
          // O `id` da rota entra para a comparação com a escala (US014); os
          // demais campos já eram usados na tela.
          rota: { select: { id: true, codigo: true, nome: true } },
          origemDescricao: true,
          destinoDescricao: true,
          _count: { select: { localizacoes: true } },
        },
        orderBy: { iniciadaEm: 'asc' },
      },
      ocorrencias: { select: { id: true, tipo: true, descricao: true, ocorridoEm: true } },
    },
  });
}

export type JornadaCompleta = NonNullable<Awaited<ReturnType<typeof buscarJornadaCompleta>>>;

/**
 * Volta o dia encerrado a aberto, apagando o que só existe no encerramento —
 * os totais são recalculados quando o dia fechar de novo. O odômetro da van
 * fica onde está: a próxima corrida parte dele.
 */
export async function reabrirJornada(cliente: ClientePrisma, id: string, atualizadoPor: string) {
  await cliente.jornada.update({
    where: { id },
    data: {
      status: 'ABERTA',
      encerradaEm: null,
      fimPeloAparelho: false,
      odometroFinal: null,
      kmTotal: null,
      totalCorridas: null,
      totalPassageiros: null,
      duracaoMinutos: null,
      atualizadoPor,
    },
  });
}
