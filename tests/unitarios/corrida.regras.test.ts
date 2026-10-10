import { describe, expect, it } from 'vitest';
import {
  JANELA_EDICAO_HORAS_PADRAO,
  encerrarCorrida,
  existeSobreposicao,
  validarCancelamento,
  validarCorrecao,
  validarHorarioDoEvento,
  validarInicioDeCorrida,
} from '@/modulos/corrida/corrida.regras';
import { CodigoErro, type ErroDaAplicacao } from '@/lib/erros';

function codigoDoErro(executar: () => void): string {
  try {
    executar();
  } catch (erro) {
    return (erro as ErroDaAplicacao).codigo;
  }
  throw new Error('esperava um erro, mas nada foi lançado');
}

describe('validarInicioDeCorrida (RN014, RN021)', () => {
  const comRota = {
    temCorridaEmAndamento: false,
    rotaId: 'rota-1',
    origemDescricao: null,
    destinoDescricao: null,
    rotaEstaAtiva: true,
  };

  it('aceita início com rota ativa', () => {
    expect(() => validarInicioDeCorrida(comRota)).not.toThrow();
  });

  it('bloqueia segunda corrida simultânea', () => {
    expect(
      codigoDoErro(() => validarInicioDeCorrida({ ...comRota, temCorridaEmAndamento: true })),
    ).toBe(CodigoErro.CORRIDA_JA_EM_ANDAMENTO);
  });

  it('recusa rota inativa', () => {
    expect(codigoDoErro(() => validarInicioDeCorrida({ ...comRota, rotaEstaAtiva: false }))).toBe(
      CodigoErro.ROTA_INATIVA,
    );
  });

  it('aceita corrida avulsa com origem e destino', () => {
    expect(() =>
      validarInicioDeCorrida({
        temCorridaEmAndamento: false,
        rotaId: null,
        origemDescricao: 'Terminal Centro',
        destinoDescricao: 'Planta Industrial',
        rotaEstaAtiva: null,
      }),
    ).not.toThrow();
  });

  it('exige origem e destino na corrida avulsa', () => {
    try {
      validarInicioDeCorrida({
        temCorridaEmAndamento: false,
        rotaId: null,
        origemDescricao: '  ',
        destinoDescricao: null,
        rotaEstaAtiva: null,
      });
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      const falha = erro as ErroDaAplicacao;
      expect(falha.codigo).toBe(CodigoErro.DADOS_INVALIDOS);
      expect(falha.campos).toHaveProperty('origemDescricao');
      expect(falha.campos).toHaveProperty('destinoDescricao');
    }
  });
});

describe('encerrarCorrida (RN016, RN018, RN020)', () => {
  const base = {
    status: 'EM_ANDAMENTO' as const,
    iniciadaEm: new Date('2026-08-23T09:00:00Z'),
    encerradaEm: new Date('2026-08-23T09:45:00Z'),
    odometroInicial: 84320,
    odometroFinal: 84347,
    quantidadePassageiros: 14,
    capacidadeDoVeiculo: 16,
    confirmaExcessoPassageiros: false,
  };

  it('calcula km e duração', () => {
    expect(encerrarCorrida(base)).toEqual({ kmPercorrido: 27, duracaoMinutos: 45 });
  });

  it('ignora corrida já encerrada', () => {
    expect(codigoDoErro(() => encerrarCorrida({ ...base, status: 'ENCERRADA' }))).toBe(
      CodigoErro.CORRIDA_JA_ENCERRADA,
    );
  });

  it('recusa horário de fim anterior ou igual ao de início', () => {
    expect(codigoDoErro(() => encerrarCorrida({ ...base, encerradaEm: base.iniciadaEm }))).toBe(
      CodigoErro.HORARIO_INVALIDO,
    );
    expect(
      codigoDoErro(() =>
        encerrarCorrida({ ...base, encerradaEm: new Date('2026-08-23T08:00:00Z') }),
      ),
    ).toBe(CodigoErro.HORARIO_INVALIDO);
  });

  it('recusa odômetro final menor que o inicial', () => {
    expect(codigoDoErro(() => encerrarCorrida({ ...base, odometroFinal: 84000 }))).toBe(
      CodigoErro.ODOMETRO_MENOR_QUE_INICIAL,
    );
  });

  it('aceita odômetro final igual ao inicial — fronteira, km zero', () => {
    expect(encerrarCorrida({ ...base, odometroFinal: 84320 }).kmPercorrido).toBe(0);
  });

  it('exige confirmação quando passa da capacidade', () => {
    expect(codigoDoErro(() => encerrarCorrida({ ...base, quantidadePassageiros: 20 }))).toBe(
      CodigoErro.EXCESSO_PASSAGEIROS_NAO_CONFIRMADO,
    );
  });

  it('aceita excesso confirmado', () => {
    expect(() =>
      encerrarCorrida({
        ...base,
        quantidadePassageiros: 20,
        confirmaExcessoPassageiros: true,
      }),
    ).not.toThrow();
  });

  it('aceita exatamente a capacidade — fronteira', () => {
    expect(() => encerrarCorrida({ ...base, quantidadePassageiros: 16 })).not.toThrow();
  });

  it('recusa odômetro fracionário', () => {
    expect(codigoDoErro(() => encerrarCorrida({ ...base, odometroFinal: 84347.5 }))).toBe(
      CodigoErro.ODOMETRO_INCOERENTE,
    );
  });
});

describe('validarHorarioDoEvento (RN016)', () => {
  const inicio = new Date('2026-08-23T09:00:00Z');
  const fim = new Date('2026-08-23T10:00:00Z');

  it('aceita evento dentro do intervalo', () => {
    expect(() =>
      validarHorarioDoEvento(new Date('2026-08-23T09:30:00Z'), inicio, fim),
    ).not.toThrow();
  });

  it('recusa evento antes do início', () => {
    expect(
      codigoDoErro(() => validarHorarioDoEvento(new Date('2026-08-23T08:59:00Z'), inicio, fim)),
    ).toBe(CodigoErro.HORARIO_INVALIDO);
  });

  it('recusa evento depois do encerramento', () => {
    expect(
      codigoDoErro(() => validarHorarioDoEvento(new Date('2026-08-23T10:01:00Z'), inicio, fim)),
    ).toBe(CodigoErro.HORARIO_INVALIDO);
  });

  it('aceita qualquer horário posterior enquanto a corrida está aberta', () => {
    expect(() =>
      validarHorarioDoEvento(new Date('2026-08-23T23:00:00Z'), inicio, null),
    ).not.toThrow();
  });
});

describe('existeSobreposicao (RN016)', () => {
  const existentes = [
    {
      iniciadaEm: new Date('2026-08-23T09:00:00Z'),
      encerradaEm: new Date('2026-08-23T10:00:00Z'),
    },
  ];

  it('detecta intervalo sobreposto', () => {
    expect(
      existeSobreposicao(
        new Date('2026-08-23T09:30:00Z'),
        new Date('2026-08-23T10:30:00Z'),
        existentes,
      ),
    ).toBe(true);
  });

  it('aceita intervalos encostados sem sobreposição', () => {
    expect(
      existeSobreposicao(
        new Date('2026-08-23T10:00:00Z'),
        new Date('2026-08-23T11:00:00Z'),
        existentes,
      ),
    ).toBe(false);
  });

  it('trata corrida ainda aberta como intervalo infinito', () => {
    const abertas = [{ iniciadaEm: new Date('2026-08-23T09:00:00Z'), encerradaEm: null }];
    expect(existeSobreposicao(new Date('2026-08-23T20:00:00Z'), null, abertas)).toBe(true);
  });
});

describe('validarCorrecao (RN019)', () => {
  const encerradaEm = new Date('2026-08-23T18:00:00Z');
  const justificativa = 'Odômetro digitado errado no encerramento';

  it('permite ao motorista dentro da janela', () => {
    expect(() =>
      validarCorrecao({
        perfil: 'MOTORISTA',
        encerradaEm,
        agora: new Date('2026-08-24T05:00:00Z'),
        justificativa,
      }),
    ).not.toThrow();
  });

  it('bloqueia o motorista fora da janela', () => {
    const foraDaJanela = new Date(
      encerradaEm.getTime() + (JANELA_EDICAO_HORAS_PADRAO + 1) * 3_600_000,
    );

    expect(
      codigoDoErro(() =>
        validarCorrecao({ perfil: 'MOTORISTA', encerradaEm, agora: foraDaJanela, justificativa }),
      ),
    ).toBe(CodigoErro.FORA_DA_JANELA_DE_EDICAO);
  });

  it('aceita exatamente no limite da janela — fronteira', () => {
    const noLimite = new Date(encerradaEm.getTime() + JANELA_EDICAO_HORAS_PADRAO * 3_600_000);
    expect(() =>
      validarCorrecao({ perfil: 'MOTORISTA', encerradaEm, agora: noLimite, justificativa }),
    ).not.toThrow();
  });

  it('permite ao administrador a qualquer momento', () => {
    expect(() =>
      validarCorrecao({
        perfil: 'ADMIN',
        encerradaEm,
        agora: new Date('2027-01-01T00:00:00Z'),
        justificativa,
      }),
    ).not.toThrow();
  });

  it('exige justificativa mínima de todos os perfis', () => {
    expect(
      codigoDoErro(() =>
        validarCorrecao({
          perfil: 'ADMIN',
          encerradaEm,
          agora: encerradaEm,
          justificativa: 'erro',
        }),
      ),
    ).toBe(CodigoErro.JUSTIFICATIVA_OBRIGATORIA);
  });

  it('não conta espaços em branco como justificativa', () => {
    expect(
      codigoDoErro(() =>
        validarCorrecao({
          perfil: 'ADMIN',
          encerradaEm,
          agora: encerradaEm,
          justificativa: '              ',
        }),
      ),
    ).toBe(CodigoErro.JUSTIFICATIVA_OBRIGATORIA);
  });

  it('respeita janela configurada diferente do padrão', () => {
    expect(
      codigoDoErro(() =>
        validarCorrecao({
          perfil: 'MOTORISTA',
          encerradaEm,
          agora: new Date(encerradaEm.getTime() + 3 * 3_600_000),
          justificativa,
          janelaHoras: 2,
        }),
      ),
    ).toBe(CodigoErro.FORA_DA_JANELA_DE_EDICAO);
  });
});

describe('validarCancelamento (RN024)', () => {
  it('exige motivo com o mínimo de caracteres', () => {
    expect(codigoDoErro(() => validarCancelamento('erro'))).toBe(
      CodigoErro.JUSTIFICATIVA_OBRIGATORIA,
    );
    expect(() => validarCancelamento('Van quebrou antes de sair')).not.toThrow();
  });
});
