import { describe, expect, it } from 'vitest';
import {
  aplicarMascaraCpf,
  cpfEhValido,
  formatarCpf,
  mascararCpf,
  normalizarCpf,
} from '@/utilitarios/cpf';

describe('normalizarCpf', () => {
  it('remove máscara e espaços', () => {
    expect(normalizarCpf('529.982.247-25')).toBe('52998224725');
    expect(normalizarCpf(' 529 982 247 25 ')).toBe('52998224725');
  });
});

describe('cpfEhValido', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(cpfEhValido('52998224725')).toBe(true);
    expect(cpfEhValido('529.982.247-25')).toBe(true);
  });

  it('recusa dígito verificador incorreto', () => {
    expect(cpfEhValido('52998224726')).toBe(false);
  });

  it('recusa sequências de dígitos repetidos', () => {
    // Passam no cálculo aritmético, mas não são CPFs reais.
    for (const digito of '0123456789') {
      expect(cpfEhValido(digito.repeat(11))).toBe(false);
    }
  });

  it('recusa tamanho diferente de 11 dígitos', () => {
    expect(cpfEhValido('5299822472')).toBe(false);
    expect(cpfEhValido('529982247250')).toBe(false);
    expect(cpfEhValido('')).toBe(false);
  });

  it('aceita CPF cujo dígito verificador é zero', () => {
    // Caso de fronteira: resto 10 vira dígito 0.
    expect(cpfEhValido('12345678909')).toBe(true);
  });
});

describe('formatarCpf', () => {
  it('aplica a máscara completa', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('devolve a entrada quando não há 11 dígitos', () => {
    expect(formatarCpf('123')).toBe('123');
  });
});

describe('mascararCpf', () => {
  it('esconde os blocos das pontas (RN029)', () => {
    expect(mascararCpf('52998224725')).toBe('***.982.247-**');
  });

  it('não vaza nada quando o valor é inválido', () => {
    expect(mascararCpf('abc')).toBe('***.***.***-**');
  });
});

describe('aplicarMascaraCpf', () => {
  it('formata progressivamente conforme a digitação', () => {
    expect(aplicarMascaraCpf('529')).toBe('529');
    expect(aplicarMascaraCpf('529982')).toBe('529.982');
    expect(aplicarMascaraCpf('529982247')).toBe('529.982.247');
    expect(aplicarMascaraCpf('52998224725')).toBe('529.982.247-25');
  });

  it('descarta o excedente além de 11 dígitos', () => {
    expect(aplicarMascaraCpf('529982247259999')).toBe('529.982.247-25');
  });
});
