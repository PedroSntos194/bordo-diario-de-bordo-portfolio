import { describe, expect, it } from 'vitest';
import {
  arredondar,
  formatarKm,
  formatarLitros,
  formatarMoeda,
  formatarOdometro,
  interpretarNumero,
} from '@/utilitarios/numero';

/** O Intl usa espaço não separável antes do símbolo da moeda. */
const normalizar = (valor: string): string => valor.replace(/ /g, ' ');

describe('formatarKm', () => {
  it('usa vírgula decimal', () => {
    expect(formatarKm(12.4)).toBe('12,4 km');
  });

  it('aceita string vinda do Decimal do Prisma', () => {
    expect(formatarKm('27.50')).toBe('27,5 km');
  });

  it('devolve traço para ausência de valor', () => {
    expect(formatarKm(null)).toBe('—');
    expect(formatarKm(undefined)).toBe('—');
    expect(formatarKm('abc')).toBe('—');
  });
});

describe('formatarOdometro', () => {
  it('formata inteiro com separador de milhar', () => {
    expect(formatarOdometro(84320)).toBe('84.320');
  });

  it('devolve traço quando não há leitura', () => {
    expect(formatarOdometro(null)).toBe('—');
  });
});

describe('formatarMoeda e formatarLitros', () => {
  it('formata em reais', () => {
    expect(normalizar(formatarMoeda(320.5))).toBe('R$ 320,50');
  });

  it('formata litros', () => {
    expect(formatarLitros(45.25)).toBe('45,3 L');
  });
});

describe('interpretarNumero', () => {
  it('aceita o formato brasileiro', () => {
    expect(interpretarNumero('1.234,5')).toBe(1234.5);
    expect(interpretarNumero('84320')).toBe(84320);
  });

  it('aceita o formato com ponto decimal', () => {
    expect(interpretarNumero('1234.5')).toBe(1234.5);
  });

  it('devolve null em vez de NaN', () => {
    // NaN se propagaria silenciosamente por um cálculo de quilometragem.
    expect(interpretarNumero('abc')).toBeNull();
    expect(interpretarNumero('')).toBeNull();
    expect(interpretarNumero('   ')).toBeNull();
  });
});

describe('arredondar', () => {
  it('evita o erro clássico de ponto flutuante', () => {
    expect(arredondar(1.005, 2)).toBe(1.01);
    expect(arredondar(0.1 + 0.2, 2)).toBe(0.3);
  });
});
