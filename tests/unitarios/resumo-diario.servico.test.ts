import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import type { UsuarioAutenticado } from '@/lib/sessao';
import { CodigoErro } from '@/lib/erros';

const simulacoes = vi.hoisted(() => ({
  sessao: vi.fn<() => Promise<UsuarioAutenticado | null>>(),
  armazenar: vi.fn(),
  auditar: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    jornada: { findMany: vi.fn() },
    usuario: { findUnique: vi.fn(), findMany: vi.fn() },
  },
  tarefas: {
    buscarTarefaPorId: vi.fn(),
    contarTarefasNaFila: vi.fn(),
    criarTarefa: vi.fn(),
    tarefasDoSolicitante: vi.fn(),
    concluirTarefa: vi.fn(),
    devolverTarefasAbandonadas: vi.fn(),
    reclamarTarefa: vi.fn(),
    registrarFalhaDaTarefa: vi.fn(),
    tarefasPendentes: vi.fn(),
  },
}));

// Serviços, autorização, validação, consulta do resumo e geração Excel são reais.
vi.mock('@/lib/sessao', () => ({ obterUsuarioDaSessao: simulacoes.sessao }));
vi.mock('@/lib/prisma', () => ({ prisma: simulacoes.prisma }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/modulos/auditoria/auditoria.servico', () => ({
  registrarAuditoria: simulacoes.auditar,
}));
vi.mock('@/modulos/arquivo/arquivo.servico', () => ({ armazenarERegistrar: simulacoes.armazenar }));
vi.mock('@/lib/limite-requisicao', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/limite-requisicao')>()),
  consumirLimite: vi.fn(),
}));
vi.mock('@/modulos/exportacao/exportacao.repositorio', () => simulacoes.tarefas);
vi.mock('@/modulos/notificacao/notificacao.repositorio', () => ({ registrarNotificacao: vi.fn() }));

import { listarMotoristasDoResumo, resumoDoDia } from '@/modulos/relatorio/relatorio.servico';
import { exportar } from '@/modulos/exportacao/exportacao.servico';
import { processarExportacoesPendentes } from '@/modulos/exportacao/tarefa.servico';

const DATA = '2026-10-07';
const ADMIN = '10000000-0000-4000-8000-000000000001';
const JOAO = '10000000-0000-4000-8000-000000000002';
const MARIA = '10000000-0000-4000-8000-000000000003';
const TAREFA = '10000000-0000-4000-8000-000000000004';

function usuario(perfil: 'ADMIN' | 'MOTORISTA' = 'ADMIN', id = ADMIN): UsuarioAutenticado {
  return {
    id,
    perfil,
    nome: id === JOAO ? 'João' : 'Administrador',
    cpf: '',
    deveTrocarSenha: false,
    aceitouPrivacidade: true,
  };
}

function jornada(id: string, motoristaId: string, status = 'ENCERRADA', data = DATA) {
  return {
    id,
    motoristaId,
    data: new Date(`${data}T00:00:00Z`),
    status,
    motorista: { id: motoristaId, nome: motoristaId === JOAO ? 'João' : 'Maria' },
    veiculo: { placa: 'ABC1234', modelo: 'Van' },
    iniciadaEm: new Date(`${data}T10:00:00Z`),
    encerradaEm: status === 'ENCERRADA' ? new Date(`${data}T19:00:00Z`) : null,
    odometroInicial: 1000,
    odometroFinal: status === 'ENCERRADA' ? 1060 : null,
    kmTotal: status === 'ENCERRADA' ? '60.5' : null,
    totalCorridas: status === 'ENCERRADA' ? 3 : null,
    totalPassageiros: status === 'ENCERRADA' ? 12 : null,
    duracaoMinutos: status === 'ENCERRADA' ? 540 : null,
    observacoes: null,
    corridas: [],
    ocorrencias: [{ id: `${id}-ocorrencia`, tipo: 'OUTRA', descricao: 'Atraso' }],
  };
}

const jornadas = [
  jornada('joao-encerrada', JOAO),
  jornada('maria-aberta', MARIA, 'ABERTA'),
  jornada('maria-outro-dia', MARIA, 'ENCERRADA', '2026-10-06'),
];

beforeEach(() => {
  vi.clearAllMocks();
  simulacoes.sessao.mockResolvedValue(usuario());
  simulacoes.prisma.$transaction.mockImplementation(async (executar) =>
    executar(simulacoes.prisma),
  );
  simulacoes.prisma.jornada.findMany.mockImplementation(async ({ where }) =>
    jornadas.filter(
      (registro) =>
        registro.data.getTime() === where.data.getTime() &&
        (!where.motoristaId || registro.motoristaId === where.motoristaId),
    ),
  );
  simulacoes.prisma.usuario.findUnique.mockImplementation(async ({ where }) => ({
    id: where.id,
    nome: where.id === JOAO ? 'João' : 'Maria',
  }));
  simulacoes.armazenar.mockResolvedValue({ id: TAREFA, tamanhoBytes: 100 });
  simulacoes.tarefas.contarTarefasNaFila.mockResolvedValue(0);
  simulacoes.tarefas.criarTarefa.mockResolvedValue({ id: TAREFA });
  simulacoes.tarefas.devolverTarefasAbandonadas.mockResolvedValue(0);
  simulacoes.tarefas.tarefasPendentes.mockResolvedValue([TAREFA]);
  simulacoes.tarefas.reclamarTarefa.mockResolvedValue(true);
});

async function livroGerado() {
  const livro = new ExcelJS.Workbook();
  const gravacao = simulacoes.armazenar.mock.calls[0]?.[1];
  expect(gravacao).toBeDefined();
  await livro.xlsx.load(gravacao.conteudo);
  return livro;
}

function identificacao(livro: ExcelJS.Workbook, rotulo: string) {
  let valor: ExcelJS.CellValue | undefined;
  livro.getWorksheet('Identificação')!.eachRow((linha) => {
    if (linha.getCell(1).value === rotulo) valor = linha.getCell(2).value;
  });
  return valor;
}

describe('diário: filtro e escopo de acesso', () => {
  it('filtra jornadas encerradas e totais pelo motorista escolhido', async () => {
    const resultado = await resumoDoDia({ data: DATA, motoristaId: JOAO });
    expect(resultado).toMatchObject({
      sucesso: true,
      dados: {
        encerradas: [{ id: 'joao-encerrada' }],
        emAberto: [],
        consolidado: { motoristas: 1, corridas: 3, kmTotal: 60.5, passageiros: 12, ocorrencias: 1 },
      },
    });
  });

  it('mostra jornada aberta sem somar dados incompletos ao consolidado', async () => {
    expect(await resumoDoDia({ data: DATA, motoristaId: MARIA })).toMatchObject({
      sucesso: true,
      dados: {
        encerradas: [],
        emAberto: [{ id: 'maria-aberta' }],
        consolidado: { motoristas: 0, corridas: 0, kmTotal: 0, passageiros: 0, ocorrencias: 1 },
      },
    });
  });

  it('mantém a frota inteira sem seleção e permite consultar datas históricas', async () => {
    expect(await resumoDoDia({ data: DATA })).toMatchObject({
      sucesso: true,
      dados: { encerradas: [{ id: 'joao-encerrada' }], emAberto: [{ id: 'maria-aberta' }] },
    });
    expect(await resumoDoDia({ data: '2026-10-06', motoristaId: MARIA })).toMatchObject({
      sucesso: true,
      dados: { encerradas: [{ id: 'maria-outro-dia' }], emAberto: [] },
    });
  });

  it('ignora seleção alheia por MOTORISTA e limita a consulta antes de buscar', async () => {
    simulacoes.sessao.mockResolvedValue(usuario('MOTORISTA', JOAO));
    expect(await resumoDoDia({ data: DATA, motoristaId: MARIA })).toMatchObject({
      sucesso: true,
      dados: { encerradas: [{ id: 'joao-encerrada' }], emAberto: [] },
    });
    expect(simulacoes.prisma.jornada.findMany.mock.calls[0]![0].where.motoristaId).toBe(JOAO);
  });

  it('recusa entrada inválida antes de consultar e impede lista de motoristas para MOTORISTA', async () => {
    expect(await resumoDoDia({ data: DATA, motoristaId: 'invalido' })).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.DADOS_INVALIDOS },
    });
    simulacoes.sessao.mockResolvedValue(usuario('MOTORISTA', JOAO));
    expect(await listarMotoristasDoResumo()).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.SEM_PERMISSAO },
    });
    expect(simulacoes.prisma.jornada.findMany).not.toHaveBeenCalled();
    expect(simulacoes.prisma.usuario.findMany).not.toHaveBeenCalled();
  });
});

describe('Excel do diário: dados e identificação do mesmo recorte', () => {
  it('exporta somente o motorista selecionado com nome, data e filtro gravados', async () => {
    const filtros = { data: DATA, motoristaId: MARIA };
    expect(await exportar({ tipo: 'RESUMO_DIA', filtros })).toMatchObject({
      sucesso: true,
      dados: { modo: 'sincrono', totalDeLinhas: 1 },
    });
    const livro = await livroGerado();
    expect(livro.getWorksheet('Resumo do dia')!.rowCount).toBe(2);
    expect(livro.getWorksheet('Resumo do dia')!.getCell('B2').value).toBe('Maria');
    expect(identificacao(livro, 'Motorista')).toBe('Maria');
    expect(identificacao(livro, 'Período')).toBe('07/10/2026');
    expect(simulacoes.armazenar.mock.calls[0]![1].parametros).toEqual({
      tipo: 'RESUMO_DIA',
      filtros,
    });
  });

  it('trocar o filtro não permite exportar outro motorista e a identificação usa o próprio nome', async () => {
    simulacoes.sessao.mockResolvedValue(usuario('MOTORISTA', JOAO));
    expect(
      await exportar({ tipo: 'RESUMO_DIA', filtros: { data: DATA, motoristaId: MARIA } }),
    ).toMatchObject({ sucesso: true, dados: { totalDeLinhas: 1 } });
    const livro = await livroGerado();
    expect(livro.getWorksheet('Resumo do dia')!.getCell('B2').value).toBe('João');
    expect(identificacao(livro, 'Motorista')).toBe('João');
    expect(simulacoes.armazenar.mock.calls[0]![1].parametros.filtros.motoristaId).toBe(JOAO);
  });

  it('recusa recorte vazio sem criar arquivo de outro motorista', async () => {
    expect(
      await exportar({ tipo: 'RESUMO_DIA', filtros: { data: '2026-10-06', motoristaId: JOAO } }),
    ).toMatchObject({ sucesso: false, erro: { codigo: CodigoErro.SEM_RESULTADOS_PARA_EXPORTAR } });
    expect(simulacoes.armazenar).not.toHaveBeenCalled();
  });

  it('congela o motorista selecionado na admissão em segundo plano', async () => {
    simulacoes.prisma.jornada.findMany.mockResolvedValue(
      Array.from({ length: 5001 }, (_, indice) => jornada(`registro-${indice}`, JOAO)),
    );
    const filtros = { data: DATA, motoristaId: JOAO };
    expect(await exportar({ tipo: 'RESUMO_DIA', filtros })).toMatchObject({
      sucesso: true,
      dados: { modo: 'segundo-plano', totalDeLinhas: 5001 },
    });
    expect(simulacoes.tarefas.criarTarefa.mock.calls[0]![1]).toMatchObject({
      tipo: 'RESUMO_DIA',
      filtros,
      solicitadoPor: ADMIN,
    });
    expect(simulacoes.armazenar).not.toHaveBeenCalled();
  });
});

describe('diário em segundo plano', () => {
  it.each([
    ['ADMIN', ADMIN, MARIA, 'Maria'],
    ['MOTORISTA', JOAO, MARIA, 'João'],
  ])('respeita o perfil atual %s e registra o filtro efetivo', async (perfil, id, pedido, nome) => {
    simulacoes.tarefas.buscarTarefaPorId.mockResolvedValue({
      id: TAREFA,
      tipo: 'RESUMO_DIA',
      filtros: { data: DATA, motoristaId: pedido },
      linhasPrevistas: 1,
      tentativas: 1,
      solicitadoPor: id,
      solicitante: {
        id,
        nome: perfil === 'ADMIN' ? 'Administrador' : 'João',
        perfil,
        status: 'ATIVO',
      },
    });
    expect(await processarExportacoesPendentes()).toMatchObject({ concluidas: 1, falhadas: 0 });
    const livro = await livroGerado();
    expect(livro.getWorksheet('Resumo do dia')!.rowCount).toBe(2);
    expect(livro.getWorksheet('Resumo do dia')!.getCell('B2').value).toBe(nome);
    expect(identificacao(livro, 'Motorista')).toBe(nome);
    expect(simulacoes.armazenar.mock.calls[0]![1].parametros.filtros.motoristaId).toBe(
      perfil === 'ADMIN' ? pedido : id,
    );
  });
});
