import { describe, expect, it } from 'vitest';
import { formatarPlaca, formatoDaPlaca, normalizarPlaca, placaEhValida } from '@/utilitarios/placa';

describe('normalizarPlaca', () => {
  it('remove hífen e espaços e converte para maiúsculas', () => {
    expect(normalizarPlaca('abc-1234')).toBe('ABC1234');
    expect(normalizarPlaca(' abc 1d23 ')).toBe('ABC1D23');
  });
});

describe('placaEhValida', () => {
  it('aceita o formato antigo', () => {
    expect(placaEhValida('ABC1234')).toBe(true);
    expect(placaEhValida('abc-1234')).toBe(true);
  });

  it('aceita o formato Mercosul', () => {
    expect(placaEhValida('ABC1D23')).toBe(true);
    expect(placaEhValida('abc1d23')).toBe(true);
  });

  it('recusa formatos inválidos', () => {
    expect(placaEhValida('AB1234')).toBe(false);
    expect(placaEhValida('ABCD123')).toBe(false);
    expect(placaEhValida('ABC12D3')).toBe(false);
    expect(placaEhValida('')).toBe(false);
  });
});

describe('formatoDaPlaca', () => {
  it('identifica cada formato', () => {
    expect(formatoDaPlaca('ABC1234')).toBe('ANTIGO');
    expect(formatoDaPlaca('ABC1D23')).toBe('MERCOSUL');
    expect(formatoDaPlaca('XX')).toBe('INVALIDO');
  });
});

describe('formatarPlaca', () => {
  it('usa hífen apenas no formato antigo', () => {
    expect(formatarPlaca('ABC1234')).toBe('ABC-1234');
    expect(formatarPlaca('ABC1D23')).toBe('ABC1D23');
  });
});
