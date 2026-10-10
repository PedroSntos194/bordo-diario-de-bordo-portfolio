import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodigoErro } from '@/lib/erros';
import type { UsuarioAutenticado } from '@/lib/sessao';

type Registro = Record<string, unknown>;
type Selecao = { [campo: string]: true | { select: Selecao } };
interface Consulta {
  where: Registro;
  select?: Selecao;
  data?: Registro;
}

const simulacoes = vi.hoisted(() => ({
  sessao: vi.fn<() => Promise<UsuarioAutenticado | null>>(),
  auditar: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    jornada: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    veiculo: { findUnique: vi.fn(), update: vi.fn() },
    corrida: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    notificacao: { updateMany: vi.fn() },
    configuracao: { findUnique: vi.fn() },
  },
}));

// Ações, autorização, esquemas, regras e repositórios reais. Só as fronteiras
// externas são simuladas; nenhuma conexão com banco ou serviço é criada.
vi.mock('@/lib/sessao', () => ({ obterUsuarioDaSessao: simulacoes.sessao }));
vi.mock('@/lib/prisma', () => ({ prisma: simulacoes.prisma }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/modulos/auditoria/auditoria.servico', () => ({
  registrarAuditoria: simulacoes.auditar,
}));

import { abrir, encerrar, reabrir } from '@/modulos/jornada/jornada.servico';
import {
  encerrar as encerrarCorrida,
  iniciar as iniciarCorrida,
} from '@/modulos/corrida/corrida.servico';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const MOTORISTA = '22222222-2222-4222-8222-222222222222';
const OUTRO_MOTORISTA = '33333333-3333-4333-8333-333333333333';
const VAN = '44444444-4444-4444-8444-444444444444';
const JORNADA = '55555555-5555-4555-8555-555555555555';
const PRIMEIRA_CORRIDA = '66666666-6666-4666-8666-666666666666';
const SEGUNDA_CORRIDA = '77777777-7777-4777-8777-777777777777';
const OUTRA_JORNADA = '88888888-8888-4888-8888-888888888888';
const AGORA = new Date('2026-10-08T12:00:00Z');
const MOTIVO = 'Dia encerrado por engano após a primeira corrida.';

function usuario(perfil: 'ADMIN' | 'MOTORISTA' = 'ADMIN'): UsuarioAutenticado {
  return {
    id: perfil === 'ADMIN' ? ADMIN : MOTORISTA,
    nome: perfil === 'ADMIN' ? 'Administrador de teste' : 'Motorista de teste',
    cpf: '',
    perfil,
    deveTrocarSenha: false,
    aceitouPrivacidade: true,
  };
}

function criarEstado() {
  return {
    jornadas: [
      {
        id: JORNADA,
        motoristaId: MOTORISTA,
        veiculoId: VAN,
        data: new Date('2026-10-08T00:00:00Z'),
        iniciadaEm: new Date('2026-10-08T08:12:00Z'),
        encerradaEm: new Date('2026-10-08T11:51:00Z'),
        odometroInicial: 1000,
        odometroFinal: 1020,
        kmTotal: 10,
        totalCorridas: 1,
        totalPassageiros: 4,
        duracaoMinutos: 219,
        observacoes: null,
        fimPeloAparelho: false,
        status: 'ENCERRADA',
      },
    ] as [Registro, ...Registro[]],
    veiculos: [
      {
        id: VAN,
        placa: 'EXE1A23',
        modelo: 'Van de teste',
        capacidadePassageiros: 15,
        odometroAtual: 1020,
        status: 'ATIVO',
      },
    ] as [Registro, ...Registro[]],
    corridas: [
      {
        id: PRIMEIRA_CORRIDA,
        jornadaId: JORNADA,
        rotaId: null,
        origemDescricao: 'Casa',
        destinoDescricao: 'Obra',
        iniciadaEm: new Date('2026-10-08T08:13:00Z'),
        encerradaEm: new Date('2026-10-08T11:51:00Z'),
        odometroInicial: 1000,
        odometroFinal: 1010,
        kmPercorrido: 10,
        duracaoMinutos: 218,
        quantidadePassageiros: 4,
        status: 'ENCERRADA',
        observacoes: null,
      },
    ] as [Registro, ...Registro[]],
    notificacoes: [
      { id: 'enviado', status: 'ENVIADA', tipo: 'RESUMO_DIA', referenciaId: JORNADA },
      { id: 'pendente', status: 'PENDENTE', tipo: 'RESUMO_DIA', referenciaId: JORNADA },
      { id: 'cancelado', status: 'CANCELADA', tipo: 'RESUMO_DIA', referenciaId: JORNADA },
      { id: 'outro', status: 'ENVIADA', tipo: 'RESUMO_DIA', referenciaId: OUTRA_JORNADA },
    ].map((registro) => ({ ...registro, referenciaTipo: 'jornada' })) as Registro[],
  };
}

let estado = criarEstado();

function coincide(registro: Registro, filtro: Registro): boolean {
  return Object.entries(filtro).every(([campo, esperado]) => {
    const valor = registro[campo];
    if (esperado instanceof Date) {
      return valor instanceof Date && valor.getTime() === esperado.getTime();
    }
    if (esperado && typeof esperado === 'object') {
      const condicao = esperado as Registro;
      if ('not' in condicao) return valor !== condicao.not;
      return !!valor && typeof valor === 'object' && coincide(valor as Registro, condicao);
    }
    return valor === esperado;
  });
}

// Respeita os selects, inclusive das relações: devolver a fixture inteira
// esconderia a falta de veiculo.odometroAtual nas consultas de produção.
function selecionar(registro: Registro | undefined, campos?: Selecao): Registro | null {
  if (!registro) return null;
  if (!campos) return { ...registro };
  return Object.fromEntries(
    Object.entries(campos).map(([campo, selecao]) => {
      const valor = registro[campo];
      if (selecao === true || valor == null) return [campo, valor];
      return [
        campo,
        Array.isArray(valor)
          ? valor.map((item) => selecionar(item as Registro, selecao.select))
          : selecionar(valor as Registro, selecao.select),
      ];
    }),
  );
}

function jornadaComRelacoes(registro: Registro): Registro {
  return {
    ...registro,
    veiculo: estado.veiculos.find((veiculo) => veiculo.id === registro.veiculoId),
    motorista: { id: registro.motoristaId, nome: 'Motorista de teste' },
    corridas: estado.corridas.filter((corrida) => corrida.jornadaId === registro.id),
  };
}

function corridaComRelacoes(registro: Registro): Registro {
  const jornada = estado.jornadas.find((item) => item.id === registro.jornadaId);
  return { ...registro, jornada: jornada && jornadaComRelacoes(jornada), rota: null };
}

function atualizar(registros: Registro[], consulta: Consulta): Registro {
  const registro = registros.find((item) => coincide(item, consulta.where));
  if (!registro) throw new Error('Fixture não encontrada para atualização.');
  Object.assign(registro, consulta.data);
  return registro;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
  vi.clearAllMocks();
  estado = criarEstado();
  simulacoes.sessao.mockResolvedValue(usuario());
  simulacoes.prisma.$transaction.mockImplementation(async (executar) => {
    const anterior = structuredClone(estado);
    try {
      return await executar(simulacoes.prisma);
    } catch (erro) {
      estado = anterior;
      throw erro;
    }
  });
  simulacoes.prisma.jornada.findFirst.mockImplementation(async (consulta: Consulta) => {
    const registro = estado.jornadas.find((item) => coincide(item, consulta.where));
    return selecionar(registro && jornadaComRelacoes(registro), consulta.select);
  });
  simulacoes.prisma.jornada.findUnique.mockImplementation(async (consulta: Consulta) => {
    const registro = estado.jornadas.find((item) => coincide(item, consulta.where));
    return selecionar(registro && jornadaComRelacoes(registro), consulta.select);
  });
  simulacoes.prisma.jornada.update.mockImplementation(async (consulta: Consulta) =>
    selecionar(jornadaComRelacoes(atualizar(estado.jornadas, consulta)), consulta.select),
  );
  simulacoes.prisma.veiculo.findUnique.mockImplementation(async (consulta: Consulta) =>
    selecionar(
      estado.veiculos.find((item) => coincide(item, consulta.where)),
      consulta.select,
    ),
  );
  simulacoes.prisma.veiculo.update.mockImplementation(async (consulta: Consulta) =>
    selecionar(atualizar(estado.veiculos, consulta), consulta.select),
  );
  simulacoes.prisma.corrida.findFirst.mockImplementation(async (consulta: Consulta) => {
    const registro = estado.corridas
      .map(corridaComRelacoes)
      .find((item) => coincide(item, consulta.where));
    return selecionar(registro, consulta.select);
  });
  simulacoes.prisma.corrida.findUnique.mockImplementation(async (consulta: Consulta) => {
    const registro = estado.corridas.find((item) => coincide(item, consulta.where));
    return selecionar(registro && corridaComRelacoes(registro), consulta.select);
  });
  simulacoes.prisma.corrida.findMany.mockImplementation(async (consulta: Consulta) =>
    estado.corridas
      .filter((item) => coincide(item, consulta.where))
      .map((item) => selecionar(item, consulta.select)),
  );
  simulacoes.prisma.corrida.aggregate.mockImplementation(async (consulta: Consulta) => {
    const odometros = estado.corridas
      .filter((item) => coincide(item, consulta.where))
      .map((item) => Number(item.odometroFinal));
    return { _max: { odometroFinal: odometros.length ? Math.max(...odometros) : null } };
  });
  simulacoes.prisma.corrida.create.mockImplementation(async (consulta: Consulta) => {
    const registro = { id: SEGUNDA_CORRIDA, ...consulta.data };
    estado.corridas.push(registro);
    return selecionar(registro, consulta.select);
  });
  simulacoes.prisma.corrida.update.mockImplementation(async (consulta: Consulta) =>
    selecionar(atualizar(estado.corridas, consulta), consulta.select),
  );
  simulacoes.prisma.notificacao.updateMany.mockImplementation(async (consulta: Consulta) => {
    const registros = estado.notificacoes.filter((item) => coincide(item, consulta.where));
    registros.forEach((item) => Object.assign(item, consulta.data));
    return { count: registros.length };
  });
  simulacoes.prisma.configuracao.findUnique.mockResolvedValue(null);
});

afterEach(() => vi.useRealTimers());

describe('reabrir jornada: permissão e validação pela ação real', () => {
  it('recusa MOTORISTA antes de consultar ou escrever registros', async () => {
    simulacoes.sessao.mockResolvedValue(usuario('MOTORISTA'));
    expect(await reabrir({ id: JORNADA, motivo: MOTIVO })).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.SEM_PERMISSAO },
    });
    expect(simulacoes.prisma.$transaction).not.toHaveBeenCalled();
    expect(simulacoes.prisma.jornada.findUnique).not.toHaveBeenCalled();
  });

  it('exige uma sessão antes de reabrir', async () => {
    simulacoes.sessao.mockResolvedValue(null);
    expect(await reabrir({ id: JORNADA, motivo: MOTIVO })).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.NAO_AUTENTICADO },
    });
    expect(simulacoes.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   ', 'abc', 'a'.repeat(241)])(
    'recusa motivo inválido %j antes de abrir transação',
    async (motivo) => {
      expect(await reabrir({ id: JORNADA, motivo })).toMatchObject({
        sucesso: false,
        erro: { codigo: CodigoErro.DADOS_INVALIDOS, campos: { motivo: expect.any(String) } },
      });
      expect(simulacoes.prisma.$transaction).not.toHaveBeenCalled();
      expect(simulacoes.auditar).not.toHaveBeenCalled();
    },
  );
});

describe('reabrir jornada: disponibilidade atual da van e do motorista', () => {
  it.each(['INATIVO', 'MANUTENCAO'])('recusa van com status %s', async (status) => {
    estado.veiculos[0].status = status;
    const anterior = structuredClone(estado);
    expect(await reabrir({ id: JORNADA, motivo: MOTIVO })).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.VEICULO_INATIVO },
    });
    expect(estado).toEqual(anterior);
    expect(simulacoes.prisma.jornada.update).not.toHaveBeenCalled();
    expect(simulacoes.prisma.notificacao.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    { motoristaId: MOTORISTA, veiculoId: 'outra-van', codigo: CodigoErro.JORNADA_JA_ABERTA },
    { motoristaId: OUTRO_MOTORISTA, veiculoId: VAN, codigo: CodigoErro.VEICULO_EM_USO },
  ])('recusa conflito de uso: $codigo', async ({ codigo, ...ocupacao }) => {
    estado.jornadas.push({
      ...estado.jornadas[0],
      ...ocupacao,
      id: OUTRA_JORNADA,
      status: 'ABERTA',
    });
    const anterior = structuredClone(estado);
    expect(await reabrir({ id: JORNADA, motivo: MOTIVO })).toMatchObject({
      sucesso: false,
      erro: { codigo },
    });
    expect(estado).toEqual(anterior);
    expect(simulacoes.prisma.jornada.update).not.toHaveBeenCalled();
  });

  it('recusa reabertura de um dia anterior', async () => {
    estado.jornadas[0].data = new Date('2026-10-07T00:00:00Z');
    expect(await reabrir({ id: JORNADA, motivo: MOTIVO })).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.JORNADA_JA_ENCERRADA },
    });
    expect(simulacoes.prisma.jornada.update).not.toHaveBeenCalled();
  });
});

describe('reabrir jornada: continuidade das corridas e do odômetro', () => {
  it('reabre o mesmo dia, preserva a corrida e a leitura 1020 da van e audita o motivo', async () => {
    const primeira = structuredClone(estado.corridas[0]);
    const iniciadaEm = estado.jornadas[0].iniciadaEm;
    expect(await reabrir({ id: JORNADA, motivo: `  ${MOTIVO}  ` })).toEqual({
      sucesso: true,
      dados: { id: JORNADA },
    });
    expect(estado.jornadas).toHaveLength(1);
    expect(estado.jornadas[0]).toMatchObject({
      id: JORNADA,
      status: 'ABERTA',
      iniciadaEm,
      odometroInicial: 1000,
      odometroFinal: null,
      encerradaEm: null,
      kmTotal: null,
      totalCorridas: null,
    });
    expect(estado.corridas).toEqual([primeira]);
    expect(estado.veiculos[0].odometroAtual).toBe(1020);
    expect(simulacoes.prisma.veiculo.update).not.toHaveBeenCalled();
    expect(estado.notificacoes.map((item) => item.status)).toEqual([
      'CANCELADA',
      'CANCELADA',
      'CANCELADA',
      'ENVIADA',
    ]);
    expect(simulacoes.auditar).toHaveBeenCalledExactlyOnceWith(
      simulacoes.prisma,
      expect.objectContaining({
        usuarioId: ADMIN,
        entidade: 'jornada',
        entidadeId: JORNADA,
        valorAnterior: expect.objectContaining({ status: 'ENCERRADA', odometroFinal: 1020 }),
        valorNovo: { status: 'ABERTA', motivo: MOTIVO, resumosCancelados: 2 },
      }),
    );
  });

  it('recusa encerrar em 1015 após reabrir, mesmo com última corrida terminada em 1010', async () => {
    expect((await reabrir({ id: JORNADA, motivo: MOTIVO })).sucesso).toBe(true);
    simulacoes.sessao.mockResolvedValue(usuario('MOTORISTA'));
    const anterior = structuredClone(estado);
    expect(await encerrar({ odometroFinal: 1015 })).toMatchObject({
      sucesso: false,
      erro: {
        codigo: CodigoErro.ODOMETRO_INCOERENTE,
        campos: { odometroFinal: expect.stringContaining('1020') },
      },
    });
    expect(estado).toEqual(anterior);
    expect(simulacoes.prisma.veiculo.update).not.toHaveBeenCalled();
  });

  it('permite encerrar novamente sem nova corrida mantendo o piso 1020', async () => {
    expect((await reabrir({ id: JORNADA, motivo: MOTIVO })).sucesso).toBe(true);
    simulacoes.sessao.mockResolvedValue(usuario('MOTORISTA'));
    expect(await encerrar({ odometroFinal: 1020 })).toMatchObject({
      sucesso: true,
      dados: { totalCorridas: 1, kmTotal: 10, totalPassageiros: 4 },
    });
    expect(estado.veiculos[0].odometroAtual).toBe(1020);
  });

  it('parte de 1020 na segunda corrida e soma as duas corridas ao encerrar em 1030', async () => {
    const primeira = structuredClone(estado.corridas[0]);
    expect((await reabrir({ id: JORNADA, motivo: MOTIVO })).sucesso).toBe(true);
    simulacoes.sessao.mockResolvedValue(usuario('MOTORISTA'));
    expect(await iniciarCorrida({ origemDescricao: 'Obra', destinoDescricao: 'Casa' })).toEqual({
      sucesso: true,
      dados: { id: SEGUNDA_CORRIDA, jaExistia: false },
    });
    expect(estado.corridas[1]).toMatchObject({
      jornadaId: JORNADA,
      odometroInicial: 1020,
      status: 'EM_ANDAMENTO',
    });
    vi.setSystemTime(new Date('2026-10-08T13:00:00Z'));
    expect(
      await encerrarCorrida({
        id: SEGUNDA_CORRIDA,
        odometroFinal: 1030,
        quantidadePassageiros: 6,
      }),
    ).toEqual({ sucesso: true, dados: { kmPercorrido: 10, duracaoMinutos: 60 } });
    expect(await encerrar({ odometroFinal: 1030 })).toEqual({
      sucesso: true,
      dados: { totalCorridas: 2, kmTotal: 20, totalPassageiros: 10, duracaoMinutos: 288 },
    });
    expect(estado.jornadas).toHaveLength(1);
    expect(estado.jornadas[0]).toMatchObject({
      status: 'ENCERRADA',
      odometroFinal: 1030,
      totalCorridas: 2,
      kmTotal: 20,
      totalPassageiros: 10,
    });
    expect(estado.veiculos[0].odometroAtual).toBe(1030);
    expect(estado.corridas).toHaveLength(2);
    expect(estado.corridas[0]).toEqual(primeira);
  });

  it('continua retomando a mesma jornada ao tocar novamente em abrir o dia', async () => {
    expect((await reabrir({ id: JORNADA, motivo: MOTIVO })).sucesso).toBe(true);
    simulacoes.sessao.mockResolvedValue(usuario('MOTORISTA'));
    expect(await abrir({ veiculoId: VAN, odometroInicial: 1020 })).toEqual({
      sucesso: true,
      dados: { id: JORNADA, jaExistia: true },
    });
    expect(estado.jornadas).toHaveLength(1);
    expect(simulacoes.prisma.jornada.create).not.toHaveBeenCalled();
    expect(simulacoes.prisma.veiculo.update).not.toHaveBeenCalled();
  });
});
