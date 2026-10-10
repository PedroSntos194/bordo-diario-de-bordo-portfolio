import { describe, expect, it } from 'vitest';
import { horarioDoRegistro } from '@/modulos/jornada/jornada.regras';

/** Horário que vale para abrir e encerrar o dia, online ou sem sinal. */

const AGORA = new Date('2026-10-07T10:00:00Z'); // 07:00 em São Paulo

describe('horarioDoRegistro', () => {
  it('online, sem horário do celular, vale o servidor', () => {
    expect(horarioDoRegistro(AGORA, undefined)).toEqual({ instante: AGORA, peloAparelho: false });
  });

  it('sem sinal, vale o horário do celular e o dia fica marcado para conferir', () => {
    // Abriu às 05:50 sem internet, sincronizou às 07:00.
    const resultado = horarioDoRegistro(AGORA, '2026-10-07T08:50:00Z');
    expect(resultado.instante.toISOString()).toBe('2026-10-07T08:50:00.000Z');
    expect(resultado.peloAparelho).toBe(true);
  });

  it('diferença de até 2 minutos é o mesmo instante, não horário do celular', () => {
    const resultado = horarioDoRegistro(AGORA, '2026-10-07T09:58:30Z');
    expect(resultado).toEqual({ instante: AGORA, peloAparelho: false });
  });

  it('horário no futuro é relógio errado: vale o servidor', () => {
    expect(horarioDoRegistro(AGORA, '2026-10-07T11:00:00Z').peloAparelho).toBe(false);
  });

  it('mais de 48 horas antes do envio: vale o servidor', () => {
    expect(horarioDoRegistro(AGORA, '2026-10-05T09:00:00Z').peloAparelho).toBe(false);
    expect(horarioDoRegistro(AGORA, '2026-10-05T11:00:00Z').peloAparelho).toBe(true);
  });

  it('encerramento nunca antes da abertura', () => {
    const abertura = new Date('2026-10-07T09:00:00Z');
    const resultado = horarioDoRegistro(AGORA, '2026-10-07T08:00:00Z', abertura);
    expect(resultado).toEqual({ instante: AGORA, peloAparelho: false });
  });

  it('texto que não é data: vale o servidor', () => {
    expect(horarioDoRegistro(AGORA, 'ontem').peloAparelho).toBe(false);
  });
});
