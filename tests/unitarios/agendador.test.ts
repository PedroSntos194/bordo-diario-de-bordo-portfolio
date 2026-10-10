import { describe, expect, it } from 'vitest';
import { cronDoHorario } from '@/servidor/agendador';

/**
 * US033 — o horário do consolidado é configurável em banco (RF040 ·
 * `horario_consolidado`), e essa configuração vira expressão cron aqui.
 */
describe('cronDoHorario', () => {
  it('converte o horário configurável em expressão cron', () => {
    expect(cronDoHorario('23:00')).toBe('0 23 * * *');
    expect(cronDoHorario('07:05')).toBe('5 7 * * *');
    expect(cronDoHorario('00:00')).toBe('0 0 * * *');
    expect(cronDoHorario('23:59')).toBe('59 23 * * *');
  });

  it('cai no padrão em vez de derrubar o agendador', () => {
    // Uma configuração ruim não pode significar nenhuma planilha gerada: é
    // melhor fechar o dia às 23h do que não fechar.
    expect(cronDoHorario('vinte e três horas')).toBe('0 23 * * *');
    expect(cronDoHorario('25:00')).toBe('0 23 * * *');
    expect(cronDoHorario('12:60')).toBe('0 23 * * *');
    expect(cronDoHorario('')).toBe('0 23 * * *');
  });

  it('respeita um padrão alternativo quando informado', () => {
    expect(cronDoHorario('valor-invalido', '20:30')).toBe('30 20 * * *');
  });
});
