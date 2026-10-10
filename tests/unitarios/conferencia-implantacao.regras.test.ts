import { describe, expect, it } from 'vitest';
import {
  avaliarSituacaoDoMotorista,
  type DadosDoMotorista,
} from '@/modulos/acompanhamento/acompanhamento.regras';
import {
  assinaturaDaConferencia,
  conferirImplantacao,
} from '@/modulos/acompanhamento/conferencia.regras';

const dia = '2026-10-05';
const noite = new Date('2026-10-05T23:30:00Z');
const base: DadosDoMotorista = {
  id: 'motorista-1',
  nome: 'Motorista',
  status: 'ATIVO',
  ultimoLoginEm: new Date('2026-10-01T12:00:00Z'),
  deveTrocarSenha: false,
  senhaTemporariaExpiraEm: null,
  bloqueadoAte: null,
  versoesAceitas: ['v1'],
  escalado: true,
  deFolga: false,
  primeiraJornadaEm: new Date('2026-10-01T12:00:00Z'),
  possuiCorridaConcluida: true,
  jornadaDoDia: null,
  jornadaAnteriorAberta: null,
};
const situacao = (campos: Partial<DadosDoMotorista> = {}) =>
  avaliarSituacaoDoMotorista({ ...base, ...campos }, dia, noite, 'v1');
const aberta: DadosDoMotorista['jornadaDoDia'] = {
  id: 'jornada-1',
  data: dia,
  status: 'ABERTA',
  iniciadaEm: new Date('2026-10-05T12:00:00Z'),
  encerradaEm: null,
  corridas: [{ status: 'EM_ANDAMENTO', encerradaEm: null }],
};

describe('conferência diária da implantação', () => {
  it('pede confirmação do fechamento a partir das 20h30 de São Paulo, inclusive na folga', () => {
    const motoristas = [situacao({ deFolga: true, jornadaDoDia: aberta })];
    expect(conferirImplantacao(motoristas, new Date('2026-10-05T23:29:59Z'))).toEqual([]);
    expect(conferirImplantacao(motoristas, noite)).toEqual([
      expect.objectContaining({ tipo: 'CONFERIR_FECHAMENTO' }),
    ]);
  });

  it('folga e ausência de escala não geram falta de registro', () => {
    expect(
      conferirImplantacao([situacao({ deFolga: true }), situacao({ escalado: false })], noite),
    ).toEqual([]);
    expect(conferirImplantacao([situacao()], noite)).toEqual([
      expect.objectContaining({ tipo: 'SEM_REGISTRO' }),
    ]);
  });

  it('mantém jornadas antigas como pendência mesmo em conta desativada', () => {
    const motorista = situacao({
      status: 'INATIVO',
      jornadaAnteriorAberta: { id: 'antiga', data: '2026-10-02' },
    });
    expect(conferirImplantacao([motorista], noite)).toEqual([
      expect.objectContaining({ tipo: 'JORNADA_ANTERIOR' }),
    ]);
  });

  it('não trata falhas de acesso como registros de operação nem cobra conta desativada', () => {
    const motoristas = [
      situacao({
        escalado: false,
        deveTrocarSenha: true,
        senhaTemporariaExpiraEm: new Date('2026-10-01'),
      }),
      situacao({ id: '2', status: 'INATIVO' }),
    ];
    expect(conferirImplantacao(motoristas, noite)).toEqual([
      expect.objectContaining({ tipo: 'ACESSO' }),
    ]);
  });

  it('primeira utilização depende de uma corrida concluída', () => {
    const motorista = situacao({ escalado: false, possuiCorridaConcluida: false });
    expect(conferirImplantacao([motorista], noite)[0]?.tipo).toBe('PRIMEIRA_UTILIZACAO');
  });

  it('assinatura ignora ordem mas identifica operação, pendências e indisponibilidade', () => {
    const a = situacao({ escalado: false });
    const b = situacao({ id: '2', escalado: false });
    const entrada = { data: dia, disponivel: true, motoristas: [a, b], pendencias: [] };
    const assinatura = assinaturaDaConferencia(entrada);
    expect(assinaturaDaConferencia({ ...entrada, motoristas: [b, a] })).toBe(assinatura);
    expect(assinaturaDaConferencia({ ...entrada, disponivel: false })).not.toBe(assinatura);
    expect(
      assinaturaDaConferencia({ ...entrada, motoristas: [situacao({ jornadaDoDia: aberta }), b] }),
    ).not.toBe(assinatura);
    expect(
      assinaturaDaConferencia({ ...entrada, pendencias: conferirImplantacao([situacao()], noite) }),
    ).not.toBe(assinatura);
  });
});
