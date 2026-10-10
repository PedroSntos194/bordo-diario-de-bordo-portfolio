import { describe, expect, it } from 'vitest';
import {
  dataOperacional,
  deHoraLocalParaUtc,
  diasNoPeriodo,
  diferencaEmMinutos,
  fimDoDia,
  formatarData,
  formatarDataHora,
  formatarDuracao,
  formatarHora,
  inicioDoDia,
  somarDias,
} from '@/utilitarios/data';

describe('dataOperacional', () => {
  it('usa o fuso da operação, não o UTC', () => {
    // 23/08/2026 02:00 UTC = 22/08/2026 23:00 em São Paulo (UTC-3).
    // Calcular em UTC jogaria esta corrida para o dia seguinte (RN012).
    expect(dataOperacional(new Date('2026-08-23T02:00:00Z'))).toBe('2026-08-22');
  });

  it('vira o dia no horário local correto', () => {
    expect(dataOperacional(new Date('2026-08-23T02:59:59Z'))).toBe('2026-08-22');
    expect(dataOperacional(new Date('2026-08-23T03:00:00Z'))).toBe('2026-08-23');
  });

  it('formata com zero à esquerda', () => {
    expect(dataOperacional(new Date('2026-01-05T15:00:00Z'))).toBe('2026-01-05');
  });
});

describe('deHoraLocalParaUtc', () => {
  it('converte meia-noite local para o instante UTC correspondente', () => {
    expect(deHoraLocalParaUtc(2026, 8, 23, 0, 0, 0).toISOString()).toBe('2026-08-23T03:00:00.000Z');
  });

  it('é o inverso de dataOperacional', () => {
    const instante = deHoraLocalParaUtc(2026, 3, 15, 14, 30);
    expect(dataOperacional(instante)).toBe('2026-03-15');
    expect(formatarHora(instante)).toBe('14:30');
  });
});

describe('inicioDoDia e fimDoDia', () => {
  it('delimitam o dia operacional completo', () => {
    const inicio = inicioDoDia('2026-08-23');
    const fim = fimDoDia('2026-08-23');

    expect(dataOperacional(inicio)).toBe('2026-08-23');
    expect(dataOperacional(fim)).toBe('2026-08-23');
    expect(formatarHora(inicio)).toBe('00:00');
    expect(formatarHora(fim)).toBe('23:59');
    expect(fim.getTime()).toBeGreaterThan(inicio.getTime());
  });
});

describe('formatação', () => {
  const instante = new Date('2026-08-23T10:15:00Z'); // 07:15 local

  it('formata data em pt-BR', () => {
    expect(formatarData(instante)).toBe('23/08/2026');
  });

  it('formata hora em 24h no fuso local', () => {
    expect(formatarHora(instante)).toBe('07:15');
  });

  it('formata data e hora juntas', () => {
    expect(formatarDataHora(instante)).toBe('23/08/2026 07:15');
  });

  it('trata meia-noite local sem devolver 24h', () => {
    expect(formatarHora(new Date('2026-08-23T03:00:00Z'))).toBe('00:00');
  });
});

describe('diferencaEmMinutos', () => {
  it('calcula minutos inteiros', () => {
    const inicio = new Date('2026-08-23T10:00:00Z');
    const fim = new Date('2026-08-23T11:30:00Z');
    expect(diferencaEmMinutos(inicio, fim)).toBe(90);
  });

  it('arredonda para baixo os segundos', () => {
    const inicio = new Date('2026-08-23T10:00:00Z');
    const fim = new Date('2026-08-23T10:00:59Z');
    expect(diferencaEmMinutos(inicio, fim)).toBe(0);
  });
});

describe('formatarDuracao', () => {
  it('cobre os formatos exibidos na interface', () => {
    expect(formatarDuracao(0)).toBe('0min');
    expect(formatarDuracao(45)).toBe('45min');
    expect(formatarDuracao(60)).toBe('1h');
    expect(formatarDuracao(83)).toBe('1h 23min');
    expect(formatarDuracao(-5)).toBe('0min');
  });
});

describe('diasNoPeriodo', () => {
  it('conta as duas pontas', () => {
    expect(diasNoPeriodo('2026-08-23', '2026-08-23')).toBe(1);
    expect(diasNoPeriodo('2026-08-01', '2026-08-31')).toBe(31);
  });
});

describe('somarDias', () => {
  it('atravessa a virada de mês', () => {
    expect(somarDias('2026-08-31', 1)).toBe('2026-09-01');
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31');
  });
});
