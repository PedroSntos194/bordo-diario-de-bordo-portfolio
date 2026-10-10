import { randomUUID } from 'node:crypto';
import {
  Prisma,
  PrismaClient,
  type CategoriaMedicao,
  type TipoOcorrencia,
  type Turno,
} from '@prisma/client';
import { gerarHashDeSenha, gerarSenhaTemporaria } from '../src/lib/senha';
import { calcularTotaisDaJornada } from '../src/modulos/jornada/jornada.regras';
import { VERSAO_AVISO_PRIVACIDADE } from '../src/modulos/privacidade/aviso-privacidade';
import { formatarCpf } from '../src/utilitarios/cpf';
import {
  dataOperacional,
  deHoraLocalParaUtc,
  diferencaEmMinutos,
  somarDias,
} from '../src/utilitarios/data';
import { semearConfiguracoes } from './configuracoes-padrao';

/**
 * Seed de demonstração — uma operação **inteiramente fictícia** para conhecer o
 * sistema sem dado real nenhum.
 *
 *   npm run seed:demo
 *
 * Cria uma transportadora inventada, com administradora, sete motoristas, seis
 * vans com contrato, três linhas de ida e volta com pontos de parada no mapa, e
 * oito semanas de jornadas, corridas, eventos, localizações, ocorrências,
 * abastecimentos e pedágios. O dia de hoje fica **em andamento**: há corrida
 * rodando, dia aberto, dia encerrado e motorista escalado sem registro — o
 * painel do administrador aparece como numa manhã de operação.
 *
 * Os números seguem as mesmas regras do sistema: km da corrida pela diferença
 * dos odômetros, totais da jornada por `calcularTotaisDaJornada`, odômetro da
 * van sempre crescente. Parte dos dias começa antes das 06:00 ou termina depois
 * do limite de saída, para o fechamento do mês ter hora extra a mostrar.
 *
 * ## Senha
 *
 * Todas as contas de demonstração usam a mesma senha, impressa ao final. Ela é
 * gerada a cada execução — como no seed inicial, nenhuma senha fica fixa no
 * código. Para escolher uma, defina `DEMO_SENHA` antes de rodar.
 *
 * ## Segurança
 *
 * Recusa rodar com `APP_AMBIENTE=producao` e em banco que já tenha veículo ou
 * jornada: ele **só acrescenta**, nunca apaga. Para recomeçar do zero em
 * desenvolvimento, `npx prisma migrate reset --force --skip-seed` e rode de novo.
 */
const prisma = new PrismaClient();

// ------------------------------------------------------------------ sorteio

/**
 * Sorteio com semente fixa (mulberry32): a mesma execução gera sempre a mesma
 * operação, o que torna a demonstração reproduzível em capturas de tela.
 */
function criarSorteio(semente: number) {
  let estado = semente >>> 0;
  const proximo = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    inteiro: (minimo: number, maximo: number) =>
      minimo + Math.floor(proximo() * (maximo - minimo + 1)),
    chance: (probabilidade: number) => proximo() < probabilidade,
    um: <T>(itens: readonly T[]): T => itens[Math.floor(proximo() * itens.length)]!,
    desvio: (amplitude: number) => (proximo() * 2 - 1) * amplitude,
  };
}

const sorteio = criarSorteio(20_261_009);

// ------------------------------------------------------------------- datas

const comoData = (dataIso: string) => new Date(`${dataIso}T00:00:00Z`);
const diaDaSemana = (dataIso: string) => new Date(`${dataIso}T12:00:00Z`).getUTCDay();
const somarMinutos = (instante: Date, minutos: number) =>
  new Date(instante.getTime() + minutos * 60_000);

/** Instante de uma hora local (`minutos` desde a meia-noite) numa data operacional. */
function as(dataIso: string, minutos: number): Date {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return deHoraLocalParaUtc(ano!, mes!, dia!, Math.floor(minutos / 60), minutos % 60);
}

// ------------------------------------------------------------------- CPF

/** Completa os dois dígitos verificadores de um CPF a partir dos nove primeiros. */
function cpfComDigitos(base: string): string {
  const digito = (numeros: number[]) => {
    const soma = numeros.reduce((total, n, i) => total + n * (numeros.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const numeros = base.split('').map(Number);
  const primeiro = digito(numeros);
  return `${base}${primeiro}${digito([...numeros, primeiro])}`;
}

// --------------------------------------------------------------- cadastros

interface PessoaDemo {
  chave: string;
  nome: string;
  baseCpf: string;
  telefone: string;
  matricula?: string;
  status?: 'ATIVO' | 'INATIVO';
}

const ADMINISTRADORA: PessoaDemo = {
  chave: 'helena',
  nome: 'Helena Rocha',
  baseCpf: '529982247',
  telefone: '+5511990000001',
};

const MOTORISTAS: PessoaDemo[] = [
  {
    chave: 'carlos',
    nome: 'Carlos Pereira',
    baseCpf: '100000001',
    telefone: '+5511990000011',
    matricula: 'M-001',
  },
  {
    chave: 'ana',
    nome: 'Ana Souza',
    baseCpf: '100000002',
    telefone: '+5511990000012',
    matricula: 'M-002',
  },
  {
    chave: 'bruno',
    nome: 'Bruno Martins',
    baseCpf: '100000003',
    telefone: '+5511990000013',
    matricula: 'M-003',
  },
  {
    chave: 'juliana',
    nome: 'Juliana Ribeiro',
    baseCpf: '100000004',
    telefone: '+5511990000014',
    matricula: 'M-004',
  },
  {
    chave: 'diego',
    nome: 'Diego Alves',
    baseCpf: '100000005',
    telefone: '+5511990000015',
    matricula: 'M-005',
  },
  {
    chave: 'rafael',
    nome: 'Rafael Costa',
    baseCpf: '100000006',
    telefone: '+5511990000016',
    matricula: 'M-006',
  },
  {
    chave: 'marcos',
    nome: 'Marcos Lima',
    baseCpf: '100000007',
    telefone: '+5511990000017',
    matricula: 'M-007',
    status: 'INATIVO',
  },
];

interface VanDemo {
  placa: string;
  modelo: string;
  marca: string;
  ano: number;
  lugares: number;
  odometro: number;
  status?: 'ATIVO' | 'MANUTENCAO';
  contrato?: {
    cliente: string;
    categoria: CategoriaMedicao;
    valorMensal: number;
    valorKmExcedido: number;
    valorDiaExtra: number;
    linhaOrigem: string;
    linhaDestino: string;
  };
}

const VANS: VanDemo[] = [
  {
    placa: 'BRA2E19',
    modelo: 'Sprinter 416 Van',
    marca: 'Mercedes-Benz',
    ano: 2022,
    lugares: 20,
    odometro: 84_210,
    contrato: {
      cliente: 'Indústria Alfa',
      categoria: 'VAN_DIURNA',
      valorMensal: 18_500,
      valorKmExcedido: 4.5,
      valorDiaExtra: 950,
      linhaOrigem: 'Barra Funda',
      linhaDestino: 'Osasco',
    },
  },
  {
    placa: 'RIO4F21',
    modelo: 'Master Minibus',
    marca: 'Renault',
    ano: 2021,
    lugares: 16,
    odometro: 121_430,
    contrato: {
      cliente: 'Hospital Beta',
      categoria: 'VAN_DIURNA',
      valorMensal: 16_200,
      valorKmExcedido: 4.2,
      valorDiaExtra: 820,
      linhaOrigem: 'Pinheiros',
      linhaDestino: 'Paraíso',
    },
  },
  {
    placa: 'MGS1B88',
    modelo: 'Daily Minibus',
    marca: 'Iveco',
    ano: 2020,
    lugares: 19,
    odometro: 168_090,
    contrato: {
      cliente: 'Indústria Alfa',
      categoria: 'VAN_DIURNA',
      valorMensal: 18_500,
      valorKmExcedido: 4.5,
      valorDiaExtra: 950,
      linhaOrigem: 'Barra Funda',
      linhaDestino: 'Osasco',
    },
  },
  {
    placa: 'PRT5D07',
    modelo: 'Transit Minibus',
    marca: 'Ford',
    ano: 2024,
    lugares: 15,
    odometro: 23_510,
    contrato: {
      cliente: 'Hospital Beta',
      categoria: 'VAN_DIURNA',
      valorMensal: 16_200,
      valorKmExcedido: 4.2,
      valorDiaExtra: 820,
      linhaOrigem: 'Pinheiros',
      linhaDestino: 'Paraíso',
    },
  },
  {
    placa: 'SPA3C45',
    modelo: 'Ducato Minibus',
    marca: 'Fiat',
    ano: 2023,
    lugares: 17,
    odometro: 45_870,
    contrato: {
      cliente: 'Logística Gama',
      categoria: 'VAN_NOTURNA',
      valorMensal: 17_300,
      valorKmExcedido: 4.8,
      valorDiaExtra: 900,
      linhaOrigem: 'Santo Amaro',
      linhaDestino: 'Jurubatuba',
    },
  },
  {
    placa: 'VAN7A10',
    modelo: 'Sprinter 515 Van',
    marca: 'Mercedes-Benz',
    ano: 2019,
    lugares: 20,
    odometro: 201_300,
    status: 'MANUTENCAO',
  },
];

interface ParadaDemo {
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
}

interface RotaDemo {
  codigo: string;
  nome: string;
  turno: Turno;
  km: number;
  /** Duração típica da viagem, em minutos. */
  duracao: [number, number];
  paradas: ParadaDemo[];
}

// Pontos públicos de São Paulo com coordenadas aproximadas; as empresas
// atendidas (Indústria Alfa, Hospital Beta, Logística Gama) são inventadas.
const BARRA_FUNDA = {
  nome: 'Terminal Barra Funda',
  endereco: 'Rua Mário de Andrade, Barra Funda — São Paulo',
  latitude: -23.5257,
  longitude: -46.6672,
};
const LAPA = {
  nome: 'Estação Lapa',
  endereco: 'Rua Guaicurus, Lapa — São Paulo',
  latitude: -23.5196,
  longitude: -46.704,
};
const OSASCO = {
  nome: 'Estação Osasco',
  endereco: 'Centro — Osasco',
  latitude: -23.5267,
  longitude: -46.776,
};
const ALFA = {
  nome: 'Indústria Alfa — portaria 2',
  endereco: 'Av. dos Autonomistas — Osasco',
  latitude: -23.539,
  longitude: -46.781,
};
const PINHEIROS = {
  nome: 'Largo da Batata',
  endereco: 'Pinheiros — São Paulo',
  latitude: -23.5667,
  longitude: -46.6936,
};
const REBOUCAS = {
  nome: 'Av. Rebouças × Av. Brasil',
  endereco: 'Jardim América — São Paulo',
  latitude: -23.5735,
  longitude: -46.6728,
};
const PARAISO = {
  nome: 'Estação Paraíso',
  endereco: 'Paraíso — São Paulo',
  latitude: -23.5763,
  longitude: -46.6408,
};
const BETA = {
  nome: 'Hospital Beta — entrada de funcionários',
  endereco: 'Paraíso — São Paulo',
  latitude: -23.5772,
  longitude: -46.6448,
};
const SANTO_AMARO = {
  nome: 'Terminal Santo Amaro',
  endereco: 'Santo Amaro — São Paulo',
  latitude: -23.6544,
  longitude: -46.709,
};
const SOCORRO = {
  nome: 'Estação Socorro',
  endereco: 'Socorro — São Paulo',
  latitude: -23.6726,
  longitude: -46.7026,
};
const GAMA = {
  nome: 'Centro Logístico Gama',
  endereco: 'Jurubatuba — São Paulo',
  latitude: -23.683,
  longitude: -46.689,
};

const ROTAS: RotaDemo[] = [
  {
    codigo: 'R-101',
    nome: 'Barra Funda → Indústria Alfa',
    turno: 'MANHA',
    km: 22,
    duracao: [55, 80],
    paradas: [BARRA_FUNDA, LAPA, OSASCO, ALFA],
  },
  {
    codigo: 'R-102',
    nome: 'Indústria Alfa → Barra Funda',
    turno: 'TARDE',
    km: 22,
    duracao: [55, 85],
    paradas: [ALFA, OSASCO, LAPA, BARRA_FUNDA],
  },
  {
    codigo: 'R-201',
    nome: 'Pinheiros → Hospital Beta',
    turno: 'MANHA',
    km: 9,
    duracao: [28, 45],
    paradas: [PINHEIROS, REBOUCAS, PARAISO, BETA],
  },
  {
    codigo: 'R-202',
    nome: 'Hospital Beta → Pinheiros',
    turno: 'TARDE',
    km: 9,
    duracao: [30, 50],
    paradas: [BETA, PARAISO, REBOUCAS, PINHEIROS],
  },
  {
    codigo: 'R-301',
    nome: 'Santo Amaro → Logística Gama',
    turno: 'NOITE',
    km: 11,
    duracao: [25, 40],
    paradas: [SANTO_AMARO, SOCORRO, GAMA],
  },
  {
    codigo: 'R-302',
    nome: 'Logística Gama → Santo Amaro',
    turno: 'NOITE',
    km: 11,
    duracao: [25, 40],
    paradas: [GAMA, SOCORRO, SANTO_AMARO],
  },
];

/** Viagens fora das linhas, registradas com origem e destino em texto. */
const AVULSAS = [
  { destino: 'Aeroporto de Congonhas', km: 12, duracao: [35, 50] as const, pedagio: null, peso: 7 },
  {
    destino: 'Aeroporto de Viracopos — Campinas',
    km: 98,
    duracao: [95, 120] as const,
    pedagio: 15.2,
    peso: 2,
  },
  {
    destino: 'Treinamento externo — Jundiaí',
    km: 62,
    duracao: [70, 90] as const,
    pedagio: 10.9,
    peso: 1,
  },
];

const FERIADOS_NACIONAIS: [string, string][] = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Dia da Consciência Negra'],
  ['12-25', 'Natal'],
];

const OCORRENCIAS: { tipo: TipoOcorrencia; descricao: string }[] = [
  { tipo: 'ATRASO', descricao: 'Trânsito intenso na Marginal; chegada com 15 minutos de atraso.' },
  {
    tipo: 'ATRASO',
    descricao: 'Acidente na via bloqueou uma faixa. Desvio pela avenida paralela.',
  },
  {
    tipo: 'PASSAGEIRO',
    descricao: 'Passageiro esqueceu uma mochila no banco. Entregue na portaria.',
  },
  {
    tipo: 'PASSAGEIRO',
    descricao: 'Passageira passou mal no embarque; seguiu viagem após atendimento.',
  },
  {
    tipo: 'PANE',
    descricao: 'Luz do freio acesa no painel. Verificado nível do fluido; viagem seguiu.',
  },
  {
    tipo: 'DESVIO',
    descricao: 'Rua da parada interditada para obras. Embarque feito na esquina seguinte.',
  },
  { tipo: 'OUTRO', descricao: 'Ar-condicionado fraco. Pedido de revisão aberto com a manutenção.' },
];

const POSTOS = [
  'Posto Exemplo — Marginal Tietê',
  'Posto Exemplo — Av. dos Autonomistas',
  'Posto Exemplo — Santo Amaro',
];
const PRECO_DIESEL = 6.19;

/** Quem dirige qual van, em qual linha. Rafael cobre sábados e feriados. */
const ESCALA_FIXA = [
  {
    motorista: 'carlos',
    placa: 'BRA2E19',
    ida: 'R-101',
    volta: 'R-102',
    turno: 'INTEGRAL' as Turno,
  },
  {
    motorista: 'bruno',
    placa: 'MGS1B88',
    ida: 'R-101',
    volta: 'R-102',
    turno: 'INTEGRAL' as Turno,
  },
  { motorista: 'ana', placa: 'RIO4F21', ida: 'R-201', volta: 'R-202', turno: 'INTEGRAL' as Turno },
  {
    motorista: 'juliana',
    placa: 'PRT5D07',
    ida: 'R-201',
    volta: 'R-202',
    turno: 'INTEGRAL' as Turno,
  },
  { motorista: 'diego', placa: 'SPA3C45', ida: 'R-301', volta: 'R-302', turno: 'NOITE' as Turno },
];
const ESCALA_EXTRA = {
  motorista: 'rafael',
  placa: 'BRA2E19',
  ida: 'R-101',
  volta: 'R-102',
  turno: 'INTEGRAL' as Turno,
};

const SEMANAS_DE_HISTORICO = 8;

// --------------------------------------------------------------- acúmulo

const registros = {
  escalas: [] as Prisma.EscalaCreateManyInput[],
  escalaRotas: [] as Prisma.EscalaRotaCreateManyInput[],
  folgas: [] as Prisma.FolgaCreateManyInput[],
  jornadas: [] as Prisma.JornadaCreateManyInput[],
  corridas: [] as Prisma.CorridaCreateManyInput[],
  eventos: [] as Prisma.CorridaEventoCreateManyInput[],
  localizacoes: [] as Prisma.PontoLocalizacaoCreateManyInput[],
  ocorrencias: [] as Prisma.OcorrenciaCreateManyInput[],
  abastecimentos: [] as Prisma.AbastecimentoCreateManyInput[],
  pedagios: [] as Prisma.PedagioCreateManyInput[],
};

interface EstadoDaVan {
  id: string;
  lugares: number;
  odometro: number;
  kmDesdeAbastecer: number;
}

interface ViagemPlanejada {
  rota?: RotaDemo & { id: string; paradasIds: string[] };
  avulsa?: (typeof AVULSAS)[number];
  inicio: Date;
  /** Sem fim: a corrida fica em andamento. */
  fim?: Date;
  /** Km rodado até a primeira parada, fora da corrida. */
  deslocamento: number;
}

function registrarLocalizacao(
  corridaId: string,
  eventoId: string | null,
  ponto: { latitude: number; longitude: number },
  instante: Date,
) {
  registros.localizacoes.push({
    corridaId,
    corridaEventoId: eventoId,
    latitude: new Prisma.Decimal((ponto.latitude + sorteio.desvio(0.0004)).toFixed(7)),
    longitude: new Prisma.Decimal((ponto.longitude + sorteio.desvio(0.0004)).toFixed(7)),
    precisaoMetros: new Prisma.Decimal(sorteio.inteiro(6, 28)),
    origem: 'GPS',
    capturadoEm: instante,
    recebidoEm: instante,
  });
}

/**
 * Registra uma jornada com as viagens já planejadas, mantendo o odômetro da van
 * coerente: deslocamento até a primeira parada, km da viagem, volta à garagem.
 */
function registrarJornada(opcoes: {
  dataIso: string;
  motoristaId: string;
  van: EstadoDaVan;
  abertura: Date;
  viagens: ViagemPlanejada[];
  /** Sem encerramento: o dia fica aberto. */
  encerramento?: Date;
}) {
  const { dataIso, motoristaId, van, abertura, viagens, encerramento } = opcoes;
  const jornadaId = randomUUID();
  const odometroInicial = van.odometro;
  const corridasDaJornada: Prisma.CorridaCreateManyInput[] = [];

  for (const viagem of viagens) {
    van.odometro += viagem.deslocamento;
    const corridaId = randomUUID();
    const odometroInicialDaCorrida = van.odometro;
    const distancia = viagem.rota?.km ?? viagem.avulsa!.km;
    const km = Math.max(1, Math.round(distancia + sorteio.desvio(distancia * 0.08)));
    const encerrada = viagem.fim !== undefined;
    const passageiros = encerrada
      ? sorteio.inteiro(Math.ceil(van.lugares * 0.4), van.lugares)
      : null;

    const corrida: Prisma.CorridaCreateManyInput = {
      id: corridaId,
      jornadaId,
      rotaId: viagem.rota?.id ?? null,
      origemDescricao: viagem.avulsa ? 'Garagem — Barra Funda' : null,
      destinoDescricao: viagem.avulsa?.destino ?? null,
      iniciadaEm: viagem.inicio,
      encerradaEm: viagem.fim ?? null,
      odometroInicial: odometroInicialDaCorrida,
      odometroFinal: encerrada ? odometroInicialDaCorrida + km : null,
      kmPercorrido: encerrada ? new Prisma.Decimal(km) : null,
      duracaoMinutos: encerrada ? diferencaEmMinutos(viagem.inicio, viagem.fim!) : null,
      quantidadePassageiros: passageiros,
      status: encerrada ? 'ENCERRADA' : 'EM_ANDAMENTO',
      criadoPor: motoristaId,
      atualizadoPor: motoristaId,
      criadoEm: viagem.inicio,
    };
    corridasDaJornada.push(corrida);

    // Eventos: início, chegada em cada parada já alcançada e fim.
    const paradas = viagem.rota?.paradas ?? [];
    const fimEstimado = viagem.fim ?? somarMinutos(viagem.inicio, viagem.rota?.duracao[0] ?? 40);
    const total = Math.max(1, diferencaEmMinutos(viagem.inicio, fimEstimado));
    const inicioId = randomUUID();
    registros.eventos.push({
      id: inicioId,
      corridaId,
      tipo: 'INICIO',
      ocorridoEm: viagem.inicio,
      criadoPor: motoristaId,
      pontoParadaId: viagem.rota?.paradasIds[0] ?? null,
    });
    registrarLocalizacao(corridaId, inicioId, paradas[0] ?? BARRA_FUNDA, viagem.inicio);

    paradas.slice(1, -1).forEach((parada, indice) => {
      const instante = somarMinutos(
        viagem.inicio,
        Math.round((total * (indice + 1)) / (paradas.length - 1)),
      );
      if (!encerrada && instante > new Date()) return;
      const eventoId = randomUUID();
      registros.eventos.push({
        id: eventoId,
        corridaId,
        tipo: 'CHEGADA',
        ocorridoEm: instante,
        criadoPor: motoristaId,
        pontoParadaId: viagem.rota!.paradasIds[indice + 1] ?? null,
      });
      registrarLocalizacao(corridaId, eventoId, parada, instante);
    });

    if (encerrada) {
      const fimId = randomUUID();
      registros.eventos.push({
        id: fimId,
        corridaId,
        tipo: 'FIM',
        ocorridoEm: viagem.fim!,
        criadoPor: motoristaId,
        pontoParadaId: viagem.rota?.paradasIds.at(-1) ?? null,
      });
      registrarLocalizacao(corridaId, fimId, paradas.at(-1) ?? BARRA_FUNDA, viagem.fim!);
      van.odometro += km;

      if (sorteio.chance(0.06)) {
        const ocorrencia = sorteio.um(OCORRENCIAS);
        registros.ocorrencias.push({
          jornadaId,
          corridaId,
          tipo: ocorrencia.tipo,
          descricao: ocorrencia.descricao,
          ocorridoEm: somarMinutos(viagem.inicio, Math.floor(total / 2)),
          criadoPor: motoristaId,
          atualizadoPor: motoristaId,
        });
      }

      if (viagem.avulsa?.pedagio) {
        for (const [sentido, minutos] of [
          ['ida', Math.floor(total / 3)],
          ['volta', Math.floor((total * 2) / 3)],
        ] as const) {
          registros.pedagios.push({
            jornadaId,
            veiculoId: van.id,
            pagoEm: somarMinutos(viagem.inicio, minutos),
            valor: new Prisma.Decimal(viagem.avulsa.pedagio),
            praca: `Praça de pedágio — Rod. dos Bandeirantes (${sentido})`,
            formaPagamento: 'TAG',
            criadoPor: motoristaId,
            atualizadoPor: motoristaId,
          });
        }
      }
    } else {
      // Em andamento: a van já saiu, mas o km da corrida só existe no fim.
      van.odometro = odometroInicialDaCorrida;
    }
  }

  let totais: ReturnType<typeof calcularTotaisDaJornada> | null = null;
  let odometroFinal: number | null = null;
  if (encerramento) {
    van.odometro += sorteio.inteiro(2, 6);
    odometroFinal = van.odometro;
    totais = calcularTotaisDaJornada(
      corridasDaJornada.map((corrida) => ({
        kmPercorrido: corrida.kmPercorrido === null ? null : Number(corrida.kmPercorrido),
        duracaoMinutos: corrida.duracaoMinutos ?? null,
        quantidadePassageiros: corrida.quantidadePassageiros ?? null,
        status: corrida.status!,
      })),
      abertura,
      encerramento,
    );

    van.kmDesdeAbastecer += odometroFinal - odometroInicial;
    if (van.kmDesdeAbastecer > 380) {
      const litros = Math.round((van.kmDesdeAbastecer / 8.5) * 10) / 10;
      registros.abastecimentos.push({
        jornadaId,
        veiculoId: van.id,
        abastecidoEm: somarMinutos(encerramento, -6),
        litros: new Prisma.Decimal(litros),
        valorTotal: new Prisma.Decimal((litros * PRECO_DIESEL).toFixed(2)),
        odometro: odometroFinal,
        posto: sorteio.um(POSTOS),
        tipoCombustivel: 'DIESEL',
        tanqueCheio: true,
        criadoPor: motoristaId,
        atualizadoPor: motoristaId,
      });
      van.kmDesdeAbastecer = 0;
    }
  }

  registros.jornadas.push({
    id: jornadaId,
    motoristaId,
    veiculoId: van.id,
    data: comoData(dataIso),
    iniciadaEm: abertura,
    encerradaEm: encerramento ?? null,
    odometroInicial,
    odometroFinal,
    kmTotal: totais ? new Prisma.Decimal(totais.kmTotal) : null,
    totalCorridas: totais?.totalCorridas ?? null,
    totalPassageiros: totais?.totalPassageiros ?? null,
    duracaoMinutos: totais?.duracaoMinutos ?? null,
    status: encerramento ? 'ENCERRADA' : 'ABERTA',
    criadoPor: motoristaId,
    atualizadoPor: motoristaId,
    criadoEm: abertura,
  });
  registros.corridas.push(...corridasDaJornada);
}

// ------------------------------------------------------------------ main

async function main(): Promise<void> {
  if (process.env.APP_AMBIENTE === 'producao') {
    throw new Error('O seed de demonstração não roda em produção (APP_AMBIENTE=producao).');
  }
  const [veiculos, jornadas] = await Promise.all([prisma.veiculo.count(), prisma.jornada.count()]);
  if (veiculos > 0 || jornadas > 0) {
    throw new Error(
      'O banco já tem veículos ou jornadas. O seed de demonstração só roda em banco vazio — ' +
        'em desenvolvimento, use `npx prisma migrate reset --force --skip-seed` e rode de novo.',
    );
  }

  await semearConfiguracoes(prisma);

  const agora = new Date();
  const hoje = dataOperacional(agora);
  const inicioHistorico = somarDias(hoje, -7 * SEMANAS_DE_HISTORICO);
  const cadastroEm = as(somarDias(inicioHistorico, -3), 9 * 60);

  // --- pessoas
  const senha = process.env.DEMO_SENHA ?? gerarSenhaTemporaria(10);
  const senhaHash = await gerarHashDeSenha(senha);
  const ids = new Map<string, string>();
  for (const pessoa of [ADMINISTRADORA, ...MOTORISTAS]) ids.set(pessoa.chave, randomUUID());
  const adminId = ids.get('helena')!;

  await prisma.usuario.createMany({
    data: [ADMINISTRADORA, ...MOTORISTAS].map((pessoa) => ({
      id: ids.get(pessoa.chave)!,
      nome: pessoa.nome,
      cpf: cpfComDigitos(pessoa.baseCpf),
      telefone: pessoa.telefone,
      email: `${pessoa.chave}@exemplo.com.br`,
      matricula: pessoa.matricula ?? null,
      perfil: pessoa === ADMINISTRADORA ? 'ADMIN' : 'MOTORISTA',
      senhaHash,
      deveTrocarSenha: false,
      cnhNumero: pessoa === ADMINISTRADORA ? null : `0${pessoa.baseCpf}1`,
      cnhCategoria: pessoa === ADMINISTRADORA ? null : 'D',
      cnhValidade:
        pessoa === ADMINISTRADORA
          ? null
          : comoData(`${2027 + (pessoa.nome.length % 3)}-0${(pessoa.nome.length % 9) + 1}-15`),
      status: pessoa.status ?? 'ATIVO',
      ultimoLoginEm:
        pessoa.status === 'INATIVO' ? null : somarMinutos(agora, -sorteio.inteiro(20, 600)),
      criadoEm: cadastroEm,
      criadoPor: pessoa === ADMINISTRADORA ? null : adminId,
    })),
  });
  await prisma.aceitePrivacidade.createMany({
    data: [ADMINISTRADORA, ...MOTORISTAS]
      .filter((pessoa) => pessoa.status !== 'INATIVO')
      .map((pessoa) => ({
        usuarioId: ids.get(pessoa.chave)!,
        versaoTexto: VERSAO_AVISO_PRIVACIDADE,
        aceitoEm: cadastroEm,
      })),
  });

  // --- vans
  const vans = new Map<string, EstadoDaVan>();
  for (const van of VANS) {
    vans.set(van.placa, {
      id: randomUUID(),
      lugares: van.lugares,
      odometro: van.odometro,
      kmDesdeAbastecer: sorteio.inteiro(0, 300),
    });
  }
  // --- linhas
  const rotas = new Map<string, RotaDemo & { id: string; paradasIds: string[] }>();
  for (const rota of ROTAS) {
    rotas.set(rota.codigo, {
      ...rota,
      id: randomUUID(),
      paradasIds: rota.paradas.map(() => randomUUID()),
    });
  }
  await prisma.rota.createMany({
    data: [...rotas.values()].map((rota) => ({
      id: rota.id,
      codigo: rota.codigo,
      nome: rota.nome,
      origem: rota.paradas[0]!.nome,
      destino: rota.paradas.at(-1)!.nome,
      turno: rota.turno,
      distanciaEstimadaKm: new Prisma.Decimal(rota.km),
      criadoEm: cadastroEm,
      criadoPor: adminId,
    })),
  });
  await prisma.pontoParada.createMany({
    data: [...rotas.values()].flatMap((rota) =>
      rota.paradas.map((parada, indice) => ({
        id: rota.paradasIds[indice]!,
        rotaId: rota.id,
        ordem: indice + 1,
        nome: parada.nome,
        endereco: parada.endereco,
        latitude: new Prisma.Decimal(parada.latitude),
        longitude: new Prisma.Decimal(parada.longitude),
      })),
    ),
  });

  // --- feriados do ano corrente e do próximo
  const ano = Number(hoje.slice(0, 4));
  const feriados = new Set<string>();
  await prisma.feriado.createMany({
    data: [ano, ano + 1].flatMap((cada) =>
      FERIADOS_NACIONAIS.map(([mesDia, nome]) => {
        feriados.add(`${cada}-${mesDia}`);
        return { data: comoData(`${cada}-${mesDia}`), nome, criadoPor: adminId };
      }),
    ),
  });

  // --- escala, jornadas e corridas, dia a dia
  const escalar = (dataIso: string, escala: (typeof ESCALA_FIXA)[number]) => {
    const escalaId = randomUUID();
    registros.escalas.push({
      id: escalaId,
      data: comoData(dataIso),
      motoristaId: ids.get(escala.motorista)!,
      veiculoId: vans.get(escala.placa)!.id,
      turno: escala.turno,
      criadoPor: adminId,
    });
    registros.escalaRotas.push(
      { escalaId, rotaId: rotas.get(escala.ida)!.id, ordem: 1 },
      { escalaId, rotaId: rotas.get(escala.volta)!.id, ordem: 2 },
    );
  };

  const escalasDoDia = (dataIso: string) => {
    const semana = diaDaSemana(dataIso);
    if (semana === 0) return [];
    if (semana === 6 || feriados.has(dataIso)) return [ESCALA_EXTRA];
    return ESCALA_FIXA;
  };

  /** Um dia passado inteiro, do início ao encerramento. */
  const planejarDiaPassado = (dataIso: string, escala: (typeof ESCALA_FIXA)[number]) => {
    const semana = diaDaSemana(dataIso);
    const noturno = escala.turno === 'NOITE';
    const extra = escala === ESCALA_EXTRA;
    const ida = rotas.get(escala.ida)!;
    const volta = rotas.get(escala.volta)!;

    const abertura = as(
      dataIso,
      noturno
        ? sorteio.inteiro(17 * 60 + 35, 18 * 60 + 10)
        : extra
          ? sorteio.inteiro(6 * 60 + 20, 6 * 60 + 50)
          : sorteio.inteiro(5 * 60 + 35, 6 * 60 + 15),
    );
    const viagens: ViagemPlanejada[] = [];
    let relogio = somarMinutos(abertura, sorteio.inteiro(8, 15));
    const viajar = (
      planejada: Omit<ViagemPlanejada, 'inicio' | 'fim'>,
      duracao: readonly [number, number],
    ) => {
      const fim = somarMinutos(relogio, sorteio.inteiro(duracao[0], duracao[1]));
      viagens.push({ ...planejada, inicio: relogio, fim });
      relogio = fim;
    };

    viajar({ rota: ida, deslocamento: sorteio.inteiro(2, 6) }, ida.duracao);

    if (!noturno && !extra && sorteio.chance(0.25)) {
      const pesos = AVULSAS.flatMap((avulsa) => Array<typeof avulsa>(avulsa.peso).fill(avulsa));
      const avulsa = sorteio.um(pesos);
      relogio = as(dataIso, sorteio.inteiro(10 * 60, 12 * 60 + 30));
      viajar({ avulsa, deslocamento: sorteio.inteiro(3, 8) }, avulsa.duracao);
    }

    const saidaVolta = noturno
      ? sorteio.inteiro(22 * 60 + 15, 22 * 60 + 45)
      : extra
        ? sorteio.inteiro(12 * 60 + 30, 13 * 60 + 15)
        : semana === 5
          ? sorteio.inteiro(15 * 60 + 40, 16 * 60 + 30)
          : sorteio.inteiro(16 * 60 + 15, 17 * 60 + 25);
    relogio = as(dataIso, saidaVolta);
    viajar({ rota: volta, deslocamento: sorteio.inteiro(1, 4) }, volta.duracao);

    return { abertura, viagens, encerramento: somarMinutos(relogio, sorteio.inteiro(10, 28)) };
  };

  for (let dataIso = inicioHistorico; dataIso < hoje; dataIso = somarDias(dataIso, 1)) {
    for (const escala of escalasDoDia(dataIso)) {
      const motoristaId = ids.get(escala.motorista)!;
      if (sorteio.chance(0.04)) {
        registros.folgas.push({
          data: comoData(dataIso),
          motoristaId,
          observacoes: 'Consulta médica',
          criadoPor: adminId,
        });
        continue;
      }
      escalar(dataIso, escala);
      registrarJornada({
        dataIso,
        motoristaId,
        van: vans.get(escala.placa)!,
        ...planejarDiaPassado(dataIso, escala),
      });
    }
  }

  // --- hoje, em andamento
  const minutoAgora = diferencaEmMinutos(as(hoje, 0), agora);
  /** Converte "minutos antes de agora" em instantes de hoje, comprimindo se ainda é madrugada. */
  const antesDeAgora = (...minutos: number[]) => {
    const escala = Math.min(1, (minutoAgora - 5) / Math.max(...minutos));
    return minutos.map((antes) => somarMinutos(agora, -Math.max(1, Math.round(antes * escala))));
  };
  const viagemDeHoje = (codigo: string, inicio: Date, fim?: Date): ViagemPlanejada => ({
    rota: rotas.get(codigo),
    inicio,
    ...(fim ? { fim } : {}),
    deslocamento: sorteio.inteiro(2, 5),
  });

  for (const escala of ESCALA_FIXA) escalar(hoje, escala);
  {
    const [abertura, ida, chegada, volta] = antesDeAgora(240, 228, 160, 25);
    registrarJornada({
      dataIso: hoje,
      motoristaId: ids.get('carlos')!,
      van: vans.get('BRA2E19')!,
      abertura: abertura!,
      viagens: [viagemDeHoje('R-101', ida!, chegada!), viagemDeHoje('R-102', volta!)],
    });
  }
  {
    const [abertura, ida, chegada] = antesDeAgora(200, 190, 152);
    registrarJornada({
      dataIso: hoje,
      motoristaId: ids.get('ana')!,
      van: vans.get('RIO4F21')!,
      abertura: abertura!,
      viagens: [viagemDeHoje('R-201', ida!, chegada!)],
    });
  }
  {
    const [abertura, ida, chegada, volta, fim, encerramento] = antesDeAgora(
      420,
      410,
      372,
      140,
      102,
      88,
    );
    registrarJornada({
      dataIso: hoje,
      motoristaId: ids.get('juliana')!,
      van: vans.get('PRT5D07')!,
      abertura: abertura!,
      viagens: [viagemDeHoje('R-201', ida!, chegada!), viagemDeHoje('R-202', volta!, fim!)],
      encerramento: encerramento!,
    });
  }
  {
    const [abertura, ida] = antesDeAgora(70, 55);
    registrarJornada({
      dataIso: hoje,
      motoristaId: ids.get('diego')!,
      van: vans.get('SPA3C45')!,
      abertura: abertura!,
      viagens: [viagemDeHoje('R-301', ida!)],
    });
  }
  // Bruno está escalado e ainda não registrou nada: vira pendência no painel.
  registros.folgas.push({
    data: comoData(hoje),
    motoristaId: ids.get('rafael')!,
    observacoes: 'Folga compensatória do sábado',
    criadoPor: adminId,
  });

  // Próximos dias já escalados, para a tela de escala ter o que mostrar.
  for (let dia = 1; dia <= 7; dia++) {
    const dataIso = somarDias(hoje, dia);
    for (const escala of escalasDoDia(dataIso)) escalar(dataIso, escala);
  }

  // --- gravação
  await prisma.veiculo.createMany({
    data: VANS.map((van) => ({
      id: vans.get(van.placa)!.id,
      placa: van.placa,
      modelo: van.modelo,
      marca: van.marca,
      ano: van.ano,
      capacidadePassageiros: van.lugares,
      odometroAtual: vans.get(van.placa)!.odometro,
      status: van.status ?? 'ATIVO',
      observacoes:
        van.status === 'MANUTENCAO' ? 'Troca de embreagem na oficina credenciada.' : null,
      cliente: van.contrato?.cliente ?? null,
      categoriaMedicao: van.contrato?.categoria ?? null,
      valorMensal: van.contrato ? new Prisma.Decimal(van.contrato.valorMensal) : null,
      valorKmExcedido: van.contrato ? new Prisma.Decimal(van.contrato.valorKmExcedido) : null,
      valorDiaExtra: van.contrato ? new Prisma.Decimal(van.contrato.valorDiaExtra) : null,
      linhaOrigem: van.contrato?.linhaOrigem ?? null,
      linhaDestino: van.contrato?.linhaDestino ?? null,
      criadoEm: cadastroEm,
      criadoPor: adminId,
    })),
  });
  await prisma.escala.createMany({ data: registros.escalas });
  await prisma.escalaRota.createMany({ data: registros.escalaRotas });
  await prisma.folga.createMany({ data: registros.folgas });
  await prisma.jornada.createMany({ data: registros.jornadas });
  await prisma.corrida.createMany({ data: registros.corridas });
  await prisma.corridaEvento.createMany({ data: registros.eventos });
  await prisma.pontoLocalizacao.createMany({ data: registros.localizacoes });
  await prisma.ocorrencia.createMany({ data: registros.ocorrencias });
  await prisma.abastecimento.createMany({ data: registros.abastecimentos });
  await prisma.pedagio.createMany({ data: registros.pedagios });

  await prisma.logAuditoria.createMany({
    data: [
      ...MOTORISTAS.map((pessoa) => ({
        usuarioId: adminId,
        acao: 'CRIAR' as const,
        entidade: 'usuario',
        entidadeId: ids.get(pessoa.chave)!,
        valorNovo: { nome: pessoa.nome, perfil: 'MOTORISTA' },
        ocorridoEm: cadastroEm,
      })),
      ...VANS.map((van) => ({
        usuarioId: adminId,
        acao: 'CRIAR' as const,
        entidade: 'veiculo',
        entidadeId: vans.get(van.placa)!.id,
        valorNovo: { placa: van.placa, modelo: van.modelo },
        ocorridoEm: cadastroEm,
      })),
      ...[...rotas.values()].map((rota) => ({
        usuarioId: adminId,
        acao: 'CRIAR' as const,
        entidade: 'rota',
        entidadeId: rota.id,
        valorNovo: { codigo: rota.codigo, nome: rota.nome },
        ocorridoEm: cadastroEm,
      })),
      {
        usuarioId: adminId,
        acao: 'ATUALIZAR' as const,
        entidade: 'usuario',
        entidadeId: ids.get('marcos')!,
        valorAnterior: { status: 'ATIVO' },
        valorNovo: { status: 'INATIVO' },
        justificativa: 'Desligado da empresa.',
        ocorridoEm: somarMinutos(agora, -60 * 24 * 12),
      },
    ],
  });

  const cpfAdmin = formatarCpf(cpfComDigitos(ADMINISTRADORA.baseCpf));
  console.log(
    `  ${registros.jornadas.length} jornadas, ${registros.corridas.length} corridas, ${registros.eventos.length} eventos.`,
  );
  console.log('\n─────────────────────────────────────────────');
  console.log(' Demonstração pronta — todos os dados são fictícios');
  console.log(`   Administradora · ${ADMINISTRADORA.nome} · CPF ${cpfAdmin}`);
  console.log(`   Motorista ····· Carlos Pereira · CPF ${formatarCpf(cpfComDigitos('100000001'))}`);
  console.log(`   Senha de todas as contas: ${senha}`);
  console.log(
    process.env.DEMO_SENHA ? '' : ' Senha gerada agora; defina DEMO_SENHA para escolher outra.',
  );
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch((erro) => {
    console.error('Falha no seed de demonstração:', erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
