import { describe, expect, it } from 'vitest';
import {
  COLUNAS_DE_CORRIDA,
  COLUNAS_DE_JORNADA,
  descreverPeriodo,
  descreverTrajeto,
  montarIdentificacao,
  nomeDoArquivo,
  type LinhaDeCorrida,
  type LinhaDeJornada,
} from '@/modulos/exportacao/exportacao.regras';
import { comoDataParaPlanilha, comoRelogioLocalParaPlanilha } from '@/utilitarios/data';

/** US032 — o que a planilha diz, verificado sem abrir um `.xlsx`. */

const JORNADA: LinhaDeJornada = {
  data: '2026-08-23',
  status: 'ENCERRADA',
  motorista: { nome: 'Carlos Pereira' },
  veiculo: { placa: 'ABC1234' },
  // 18:35 em São Paulo (UTC-3) é 21:35 UTC.
  iniciadaEm: new Date('2026-08-23T21:35:00Z'),
  encerradaEm: new Date('2026-08-24T01:10:00Z'),
  odometroInicial: 160400,
  odometroFinal: 160445,
  kmTotal: '32.5',
  totalCorridas: 3,
  totalPassageiros: 25,
  duracaoMinutos: 215,
  observacoes: null,
};

function celula<T>(
  colunas: { cabecalho: string; valor: (r: T) => unknown }[],
  nome: string,
  registro: T,
) {
  const coluna = colunas.find((item) => item.cabecalho === nome);
  if (!coluna) throw new Error(`Coluna ausente: ${nome}`);
  return coluna.valor(registro);
}

describe('nomeDoArquivo', () => {
  it('segue o padrão bordo_<relatorio>_<AAAA-MM-DD>.xlsx', () => {
    expect(nomeDoArquivo('JORNADAS', '2026-08-23')).toBe('bordo_jornadas_2026-08-23.xlsx');
    expect(nomeDoArquivo('CORRIDAS', '2026-01-05')).toBe('bordo_corridas_2026-01-05.xlsx');
    expect(nomeDoArquivo('RESUMO_DIA', '2026-12-31')).toBe('bordo_resumo-do-dia_2026-12-31.xlsx');
  });
});

describe('colunas de jornada', () => {
  it('devolve números como número, não como texto', () => {
    // O critério de aceitação é explícito: uma coluna de km em texto não soma
    // no Excel, e a planilha existe justamente para ser somada.
    expect(celula(COLUNAS_DE_JORNADA, 'Km total', JORNADA)).toBe(32.5);
    expect(celula(COLUNAS_DE_JORNADA, 'Odômetro inicial', JORNADA)).toBe(160400);
    expect(celula(COLUNAS_DE_JORNADA, 'Passageiros', JORNADA)).toBe(25);
  });

  it('converte o Decimal do Prisma, que chega como string', () => {
    expect(celula(COLUNAS_DE_JORNADA, 'Km total', { ...JORNADA, kmTotal: '7.25' })).toBe(7.25);
    expect(celula(COLUNAS_DE_JORNADA, 'Km total', { ...JORNADA, kmTotal: null })).toBeNull();
  });

  it('devolve a data operacional sem deslocar o dia', () => {
    // Regressão da Sprint 5 aplicada à planilha: o ExcelJS lê o `Date` em UTC
    // puro, então meia-noite UTC é o único valor que rende o dia certo.
    const data = celula(COLUNAS_DE_JORNADA, 'Data', JORNADA) as Date;

    expect(data.toISOString()).toBe('2026-08-23T00:00:00.000Z');
  });

  it('projeta o instante para o relógio de São Paulo', () => {
    const inicio = celula(COLUNAS_DE_JORNADA, 'Início', JORNADA) as Date;

    // 21:35 UTC é 18:35 em São Paulo. Sem a projeção, o Excel mostraria 21:35.
    expect(inicio.getUTCHours()).toBe(18);
    expect(inicio.getUTCMinutes()).toBe(35);
  });

  it('deixa a célula vazia quando o dia ainda não foi encerrado', () => {
    const aberta = { ...JORNADA, encerradaEm: null, odometroFinal: null };

    expect(celula(COLUNAS_DE_JORNADA, 'Encerramento', aberta)).toBeNull();
    expect(celula(COLUNAS_DE_JORNADA, 'Odômetro final', aberta)).toBeNull();
  });

  it('mostra o status em português', () => {
    expect(celula(COLUNAS_DE_JORNADA, 'Status', JORNADA)).toBe('Encerrada');
  });

  it('formata a placa', () => {
    expect(celula(COLUNAS_DE_JORNADA, 'Veículo', JORNADA)).toBe('ABC-1234');
  });
});

describe('descreverTrajeto', () => {
  const base: LinhaDeCorrida = {
    status: 'ENCERRADA',
    iniciadaEm: new Date('2026-08-23T21:35:00Z'),
    encerradaEm: null,
    odometroInicial: 100,
    odometroFinal: null,
    kmPercorrido: null,
    duracaoMinutos: null,
    quantidadePassageiros: null,
    observacoes: null,
    motivoCancelamento: null,
    origemDescricao: null,
    destinoDescricao: null,
    rota: null,
    jornada: {
      data: '2026-08-23',
      motorista: { nome: 'Carlos Pereira' },
      veiculo: { placa: 'ABC1234' },
    },
  };

  it('usa a rota cadastrada quando existe', () => {
    expect(descreverTrajeto({ ...base, rota: { codigo: 'R-014', nome: 'Centro → Fábrica' } })).toBe(
      'R-014 · Centro → Fábrica',
    );
  });

  it('cai para origem e destino na corrida avulsa', () => {
    expect(
      descreverTrajeto({ ...base, origemDescricao: 'Terminal', destinoDescricao: 'Portaria 2' }),
    ).toBe('Terminal → Portaria 2');
  });

  it('não deixa a célula ambígua quando falta um dos lados', () => {
    expect(descreverTrajeto({ ...base, origemDescricao: 'Terminal' })).toBe('Terminal → —');
  });

  it('cai para o motivo do cancelamento quando não há observação', () => {
    const cancelada = { ...base, status: 'CANCELADA', motivoCancelamento: 'Van quebrou' };

    expect(celula(COLUNAS_DE_CORRIDA, 'Observações', cancelada)).toBe('Van quebrou');
  });
});

describe('descreverPeriodo', () => {
  it('descreve o recorte de forma legível', () => {
    expect(descreverPeriodo({ data: '2026-08-23' })).toBe('23/08/2026');
    expect(descreverPeriodo({ dataInicio: '2026-08-01', dataFim: '2026-08-31' })).toBe(
      '01/08/2026 a 31/08/2026',
    );
    expect(descreverPeriodo({ dataInicio: '2026-08-01' })).toBe('A partir de 01/08/2026');
    expect(descreverPeriodo({ dataFim: '2026-08-31' })).toBe('Até 31/08/2026');
    expect(descreverPeriodo({})).toBe('Todo o período');
  });
});

describe('montarIdentificacao', () => {
  const contexto = {
    tipo: 'JORNADAS' as const,
    totalDeLinhas: 42,
    geradoEm: new Date('2026-08-23T21:35:00Z'),
    geradoPor: 'Administrador',
  };

  it('registra empresa, relatório, período, volume e autoria', () => {
    const pares = montarIdentificacao({ ...contexto, filtros: { dataInicio: '2026-08-01' } });
    const mapa = Object.fromEntries(pares.map((par) => [par.rotulo, par.valor]));

    expect(mapa.Empresa).toBe('Transportes Exemplo');
    expect(mapa.Relatório).toBe('Jornadas');
    expect(mapa.Período).toBe('A partir de 01/08/2026');
    expect(mapa.Registros).toBe('42');
    expect(mapa['Gerado por']).toBe('Administrador');
    expect(mapa['Gerado em']).toBe('23/08/2026 18:35');
  });

  it('diz explicitamente quando não há filtro além do período', () => {
    const pares = montarIdentificacao({ ...contexto, filtros: { dataInicio: '2026-08-01' } });

    expect(pares.some((par) => par.valor === 'Nenhum filtro adicional aplicado')).toBe(true);
  });

  it('traduz identificadores em nomes legíveis', () => {
    const pares = montarIdentificacao({
      ...contexto,
      filtros: { motoristaId: 'uuid-do-carlos', status: 'ENCERRADA' },
      rotulosDeFiltro: { motoristaId: 'Carlos Pereira' },
    });
    const mapa = Object.fromEntries(pares.map((par) => [par.rotulo, par.valor]));

    expect(mapa.Motorista).toBe('Carlos Pereira');
    expect(mapa.Status).toBe('Encerrada');
  });

  it('ignora os parâmetros que descrevem a tela, não o recorte', () => {
    const pares = montarIdentificacao({
      ...contexto,
      filtros: { pagina: 3, tamanho: 20, ordenar: 'data', direcao: 'desc' },
    });

    expect(pares.some((par) => par.valor === 'Nenhum filtro adicional aplicado')).toBe(true);
  });
});

describe('conversores de célula', () => {
  it('comoDataParaPlanilha aceita texto e coluna date sem mover o dia', () => {
    expect(comoDataParaPlanilha('2026-08-23').toISOString()).toBe('2026-08-23T00:00:00.000Z');
    expect(comoDataParaPlanilha(new Date('2026-08-23T00:00:00.000Z')).toISOString()).toBe(
      '2026-08-23T00:00:00.000Z',
    );
  });

  it('comoRelogioLocalParaPlanilha vira o dia quando o horário local pede', () => {
    // 01:10 UTC do dia 24 ainda é 22:10 do dia 23 em São Paulo.
    const projetado = comoRelogioLocalParaPlanilha(new Date('2026-08-24T01:10:00Z'));

    expect(projetado.getUTCDate()).toBe(23);
    expect(projetado.getUTCHours()).toBe(22);
    expect(projetado.getUTCMinutes()).toBe(10);
  });
});
