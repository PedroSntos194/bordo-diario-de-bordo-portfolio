import { describe, expect, it } from 'vitest';
import { comoDataIso, formatarData, formatarDataOperacional } from '@/utilitarios/data';

/**
 * Regressão do defeito encontrado na Sprint 5.
 *
 * A coluna `data` da jornada é um `date` puro, e o Prisma a devolve como
 * meia-noite **UTC**. Formatá-la pelo conversor de fuso jogava o valor para as
 * 21h do dia anterior em São Paulo, e toda jornada aparecia um dia antes na
 * tela do administrador.
 */
describe('formatarDataOperacional', () => {
  it('não desloca a data de uma coluna date', () => {
    // Foi exatamente assim que 23/08 virou 22/08 na listagem de jornadas.
    const colunaDate = new Date('2026-08-23T00:00:00.000Z');

    expect(formatarDataOperacional(colunaDate)).toBe('23/08/2026');
    expect(formatarData(colunaDate)).toBe('22/08/2026');
  });

  it('aceita a data já em texto', () => {
    expect(formatarDataOperacional('2026-08-23')).toBe('23/08/2026');
  });

  it('mantém o dia na virada do mês e do ano', () => {
    expect(formatarDataOperacional(new Date('2026-01-01T00:00:00.000Z'))).toBe('01/01/2026');
    expect(formatarDataOperacional(new Date('2026-12-31T00:00:00.000Z'))).toBe('31/12/2026');
  });
});

describe('comoDataIso', () => {
  it('devolve o dia da coluna sem conversão de fuso', () => {
    expect(comoDataIso(new Date('2026-08-23T00:00:00.000Z'))).toBe('2026-08-23');
  });
});

describe('formatarData continua correta para instantes', () => {
  it('converte um timestamptz para o fuso da operação', () => {
    // 02:00 UTC ainda é o dia anterior em São Paulo — e aqui isso é o certo.
    expect(formatarData(new Date('2026-08-23T02:00:00Z'))).toBe('22/08/2026');
    expect(formatarData(new Date('2026-08-23T10:00:00Z'))).toBe('23/08/2026');
  });
});
