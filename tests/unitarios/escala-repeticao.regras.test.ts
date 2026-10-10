import { describe, expect, it } from 'vitest';
import {
  LIMITE_DE_DIAS_DA_REPETICAO,
  chaveDaFolga,
  datasDaRepeticao,
  diaDaSemanaDaData,
  planejarRepeticao,
  type ModeloDeEscala,
  type OcupacaoDoDia,
} from '@/modulos/escala/escala.regras';
import { somarDias } from '@/utilitarios/data';

/** Repetição da escala de um dia nos dias seguintes (US014). */

const SEG_A_SEX = [1, 2, 3, 4, 5];

describe('diaDaSemanaDaData', () => {
  it('lê o dia da semana da data operacional, sem fuso', () => {
    expect(diaDaSemanaDaData('2026-10-02')).toBe(5); // sexta
    expect(diaDaSemanaDaData('2026-10-04')).toBe(0); // domingo
    expect(diaDaSemanaDaData('2026-10-05')).toBe(1); // segunda
  });
});

describe('datasDaRepeticao', () => {
  it('começa no dia seguinte ao modelo e pula o fim de semana', () => {
    // O modelo é uma sexta; a cópia não reescreve o próprio dia.
    expect(datasDaRepeticao('2026-10-02', '2026-10-09', SEG_A_SEX)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
  });

  it('inclui a data final', () => {
    expect(datasDaRepeticao('2026-10-05', '2026-10-06', SEG_A_SEX)).toEqual(['2026-10-06']);
  });

  it('atravessa a virada do mês', () => {
    expect(datasDaRepeticao('2026-10-30', '2026-11-03', [0, 1, 2, 3, 4, 5, 6])).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
  });

  it('respeita só os dias marcados', () => {
    expect(datasDaRepeticao('2026-10-02', '2026-10-18', [0])).toEqual([
      '2026-10-04',
      '2026-10-11',
      '2026-10-18',
    ]);
  });

  it('recusa data final igual ou anterior ao modelo', () => {
    expect(() => datasDaRepeticao('2026-10-05', '2026-10-05', SEG_A_SEX)).toThrow('depois do dia');
    expect(() => datasDaRepeticao('2026-10-05', '2026-10-01', SEG_A_SEX)).toThrow();
  });

  it('aceita exatamente o limite e recusa um dia além', () => {
    // Fronteira clássica: um `>=` no lugar do `>` recusaria o próprio limite
    // anunciado na tela.
    const noLimite = somarDias('2026-10-05', LIMITE_DE_DIAS_DA_REPETICAO);
    expect(() => datasDaRepeticao('2026-10-05', noLimite, SEG_A_SEX)).not.toThrow();

    const alem = somarDias('2026-10-05', LIMITE_DE_DIAS_DA_REPETICAO + 1);
    expect(() => datasDaRepeticao('2026-10-05', alem, SEG_A_SEX)).toThrow('no máximo');
  });
});

const CARLOS: ModeloDeEscala = {
  motoristaId: 'm-carlos',
  motoristaNome: 'Carlos',
  veiculoId: 'v-abc',
  placa: 'ABC1234',
  turno: 'INTEGRAL',
  rotaIds: ['r-014'],
};

const ANA: ModeloDeEscala = {
  motoristaId: 'm-ana',
  motoristaNome: 'Ana',
  veiculoId: 'v-xyz',
  placa: 'XYZ2B34',
  turno: 'MANHA',
  rotaIds: [],
};

function ocupacao(entradas: [string, OcupacaoDoDia][]): Map<string, OcupacaoDoDia[]> {
  const mapa = new Map<string, OcupacaoDoDia[]>();
  for (const [data, item] of entradas) mapa.set(data, [...(mapa.get(data) ?? []), item]);
  return mapa;
}

describe('planejarRepeticao', () => {
  const DATAS = ['2026-10-05', '2026-10-06'];

  it('copia cada escala do modelo para cada data livre', () => {
    const plano = planejarRepeticao([CARLOS, ANA], DATAS, new Map(), new Set());

    expect(plano.criar).toHaveLength(4);
    expect(plano.puladas).toEqual([]);
    expect(plano.criar[0]).toEqual({ data: '2026-10-05', modelo: CARLOS });
  });

  it('não escala quem está de folga', () => {
    const folgas = new Set([chaveDaFolga('2026-10-06', 'm-carlos')]);
    const plano = planejarRepeticao([CARLOS], DATAS, new Map(), folgas);

    expect(plano.criar.map((item) => item.data)).toEqual(['2026-10-05']);
    expect(plano.puladas).toEqual([
      { data: '2026-10-06', motorista: 'Carlos', placa: 'ABC1234', motivo: 'folga' },
    ]);
  });

  it('não sobrescreve o motorista já escalado no dia', () => {
    // Carlos já tem a manhã de 06/10 em outra van; a cópia é de dia inteiro, e
    // dia inteiro conflita com qualquer turno.
    const mapa = ocupacao([
      ['2026-10-06', { motoristaId: 'm-carlos', veiculoId: 'v-outra', turno: 'MANHA' }],
    ]);
    const plano = planejarRepeticao([CARLOS], DATAS, mapa, new Set());

    expect(plano.criar.map((item) => item.data)).toEqual(['2026-10-05']);
    expect(plano.puladas[0]?.motivo).toBe('motorista-ocupado');
  });

  it('não põe a van com dois motoristas no mesmo turno', () => {
    const mapa = ocupacao([
      ['2026-10-05', { motoristaId: 'm-outro', veiculoId: 'v-xyz', turno: 'INTEGRAL' }],
    ]);
    const plano = planejarRepeticao([ANA], DATAS, mapa, new Set());

    expect(plano.criar.map((item) => item.data)).toEqual(['2026-10-06']);
    expect(plano.puladas[0]?.motivo).toBe('van-ocupada');
  });

  it('deixa a mesma van em turnos diferentes', () => {
    // Manhã e tarde na mesma van é o uso normal de uma frota pequena.
    const mapa = ocupacao([
      ['2026-10-05', { motoristaId: 'm-outro', veiculoId: 'v-xyz', turno: 'TARDE' }],
    ]);
    const plano = planejarRepeticao([ANA], ['2026-10-05'], mapa, new Set());

    expect(plano.criar).toHaveLength(1);
  });

  it('uma cópia planejada ocupa o dia para as seguintes', () => {
    const outraNaMesmaVan: ModeloDeEscala = {
      ...ANA,
      motoristaId: 'm-bia',
      motoristaNome: 'Bia',
      turno: 'INTEGRAL',
    };
    const plano = planejarRepeticao([ANA, outraNaMesmaVan], ['2026-10-05'], new Map(), new Set());

    expect(plano.criar.map((item) => item.modelo.motoristaNome)).toEqual(['Ana']);
    expect(plano.puladas).toEqual([
      { data: '2026-10-05', motorista: 'Bia', placa: 'XYZ2B34', motivo: 'van-ocupada' },
    ]);
  });
});
