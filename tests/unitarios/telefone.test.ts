import { describe, expect, it } from 'vitest';
import {
  aplicarMascaraTelefone,
  formatarTelefone,
  normalizarTelefone,
  telefoneEhValido,
} from '@/utilitarios/telefone';

describe('normalizarTelefone', () => {
  it('converte celular com máscara para E.164', () => {
    expect(normalizarTelefone('(11) 99999-8888')).toBe('+5511999998888');
  });

  it('aceita número já com DDI', () => {
    expect(normalizarTelefone('+55 11 99999-8888')).toBe('+5511999998888');
    expect(normalizarTelefone('5511999998888')).toBe('+5511999998888');
  });

  it('aceita telefone fixo', () => {
    expect(normalizarTelefone('(11) 3333-4444')).toBe('+551133334444');
  });

  it('descarta o zero digitado antes do DDD', () => {
    expect(normalizarTelefone('011 99999-8888')).toBe('+5511999998888');
    expect(normalizarTelefone('011 3333-4444')).toBe('+551133334444');
  });

  it('não confunde o zero do DDD com hábito de digitação', () => {
    // `0 + operadora + DDD + número` é ambíguo e não é aceito: melhor recusar
    // do que adivinhar errado e gravar um número que não completa a chamada.
    expect(normalizarTelefone('015 11 99999-8888')).toBeNull();
  });

  it('devolve null em vez de string incompleta', () => {
    // Um número pela metade gravado no banco falharia só na hora do envio.
    expect(normalizarTelefone('99999')).toBeNull();
    expect(normalizarTelefone('')).toBeNull();
    expect(normalizarTelefone('abc')).toBeNull();
  });

  it('recusa DDD inexistente', () => {
    expect(normalizarTelefone('(01) 99999-8888')).toBeNull();
    expect(normalizarTelefone('(10) 99999-8888')).toBeNull();
  });

  it('recusa celular que não começa com 9', () => {
    expect(normalizarTelefone('(11) 89999-8888')).toBeNull();
  });

  it('recusa fixo com dígito inicial inválido', () => {
    expect(normalizarTelefone('(11) 9333-4444')).toBeNull();
    expect(normalizarTelefone('(11) 1333-4444')).toBeNull();
  });
});

describe('telefoneEhValido', () => {
  it('acompanha a normalização', () => {
    expect(telefoneEhValido('(11) 99999-8888')).toBe(true);
    expect(telefoneEhValido('11 9999-888')).toBe(false);
  });
});

describe('formatarTelefone', () => {
  it('formata celular e fixo', () => {
    expect(formatarTelefone('+5511999998888')).toBe('(11) 99999-8888');
    expect(formatarTelefone('+551133334444')).toBe('(11) 3333-4444');
  });

  it('devolve o valor original quando não reconhece', () => {
    expect(formatarTelefone('sem número')).toBe('sem número');
  });
});

describe('aplicarMascaraTelefone', () => {
  it('formata progressivamente', () => {
    expect(aplicarMascaraTelefone('1')).toBe('(1');
    expect(aplicarMascaraTelefone('11')).toBe('(11');
    expect(aplicarMascaraTelefone('1199')).toBe('(11) 99');
    expect(aplicarMascaraTelefone('11999998')).toBe('(11) 9999-98');
    expect(aplicarMascaraTelefone('11999998888')).toBe('(11) 99999-8888');
  });

  it('descarta o excedente', () => {
    expect(aplicarMascaraTelefone('119999988889999')).toBe('(11) 99999-8888');
  });

  it('devolve vazio para entrada vazia', () => {
    expect(aplicarMascaraTelefone('')).toBe('');
  });
});
