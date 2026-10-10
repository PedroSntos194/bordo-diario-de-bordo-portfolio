import { describe, expect, it } from 'vitest';
import { calcularDelta } from '@/modulos/auditoria/auditoria.servico';
import { _mascararDados } from '@/lib/logger';

describe('calcularDelta (RN026)', () => {
  it('registra apenas os campos que mudaram', () => {
    const delta = calcularDelta(
      { nome: 'João', telefone: '+5511999999999', perfil: 'MOTORISTA' },
      { nome: 'João Silva', telefone: '+5511999999999', perfil: 'MOTORISTA' },
    );

    expect(delta).toEqual({
      anterior: { nome: 'João' },
      novo: { nome: 'João Silva' },
    });
  });

  it('devolve null quando nada mudou', () => {
    expect(calcularDelta({ km: 27 }, { km: 27 })).toBeNull();
  });

  it('nunca inclui campos sensíveis, mesmo que tenham mudado', () => {
    const delta = calcularDelta(
      { nome: 'João', senhaHash: 'hash-antigo' },
      { nome: 'João', senhaHash: 'hash-novo' },
    );

    expect(delta).toBeNull();
  });

  it('ignora campos técnicos de auditoria', () => {
    const delta = calcularDelta(
      { km: 27, atualizadoEm: new Date('2026-08-23T09:00:00Z') },
      { km: 27, atualizadoEm: new Date('2026-08-23T10:00:00Z') },
    );

    expect(delta).toBeNull();
  });

  it('serializa datas em ISO', () => {
    const delta = calcularDelta(
      { encerradaEm: null },
      { encerradaEm: new Date('2026-08-23T18:00:00Z') },
    );

    expect(delta?.novo.encerradaEm).toBe('2026-08-23T18:00:00.000Z');
    expect(delta?.anterior.encerradaEm).toBeNull();
  });

  it('compara datas por valor, não por referência', () => {
    const delta = calcularDelta(
      { data: new Date('2026-08-23T09:00:00Z') },
      { data: new Date('2026-08-23T09:00:00Z') },
    );

    expect(delta).toBeNull();
  });

  it('registra a criação como delta contra nada', () => {
    const delta = calcularDelta(null, { nome: 'Nova rota', codigo: 'R-014' });

    expect(delta?.novo).toEqual({ nome: 'Nova rota', codigo: 'R-014' });
    expect(delta?.anterior).toEqual({ nome: null, codigo: null });
  });

  it('não trava com os dois estados nulos', () => {
    expect(calcularDelta(null, null)).toBeNull();
  });
});

describe('mascaramento no log (RNF018)', () => {
  it('protege senha, token, CPF e coordenadas', () => {
    const mascarado = _mascararDados({
      usuarioId: 'abc',
      cpf: '52998224725',
      senha: 'segredo',
      latitude: -23.55,
      longitude: -46.63,
      aninhado: { token: 'xyz', rota: 'R-014' },
    }) as Record<string, unknown>;

    expect(mascarado.usuarioId).toBe('abc');
    expect(mascarado.cpf).toBe('[protegido]');
    expect(mascarado.senha).toBe('[protegido]');
    expect(mascarado.latitude).toBe('[protegido]');
    expect((mascarado.aninhado as Record<string, unknown>).token).toBe('[protegido]');
    expect((mascarado.aninhado as Record<string, unknown>).rota).toBe('R-014');
  });

  it('atravessa listas', () => {
    const mascarado = _mascararDados([{ cpf: '52998224725' }]) as Record<string, unknown>[];
    expect(mascarado[0]?.cpf).toBe('[protegido]');
  });
});
