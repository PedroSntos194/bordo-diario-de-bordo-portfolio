import { describe, expect, it } from 'vitest';
import { CodigoErro } from '@/lib/erros';
import {
  JANELA_EDICAO_HORAS_PADRAO,
  podeCorrigirAgora,
  validarOdometroDeCorrecao,
} from '@/modulos/corrida/corrida.regras';

/**
 * US022 — quem corrige, até quando e com que limites.
 *
 * `validarCorrecao` já era coberta desde a Sprint 4. O que entra aqui é o par
 * que a Sprint 8 acrescentou: a decisão de **exibir** a ação e o limite do
 * odômetro corrigido.
 */

const ENCERRADA = new Date('2026-08-26T08:00:00Z');

function codigoDoErro(acao: () => void): string {
  try {
    acao();
  } catch (erro) {
    return (erro as { codigo: string }).codigo;
  }
  throw new Error('esperava um erro, não houve');
}

describe('podeCorrigirAgora', () => {
  it('libera o administrador a qualquer momento', () => {
    const muitoDepois = new Date('2027-01-01T00:00:00Z');

    expect(podeCorrigirAgora({ perfil: 'ADMIN', encerradaEm: ENCERRADA, agora: muitoDepois })).toBe(
      true,
    );
  });

  it('libera o motorista dentro da janela', () => {
    const dentro = new Date('2026-08-26T19:00:00Z'); // 11 h depois

    expect(podeCorrigirAgora({ perfil: 'MOTORISTA', encerradaEm: ENCERRADA, agora: dentro })).toBe(
      true,
    );
  });

  it('fecha para o motorista depois da janela', () => {
    const fora = new Date('2026-08-26T21:00:00Z'); // 13 h depois

    expect(podeCorrigirAgora({ perfil: 'MOTORISTA', encerradaEm: ENCERRADA, agora: fora })).toBe(
      false,
    );
  });

  it('usa a janela configurada, não a constante, quando informada', () => {
    const seisHorasDepois = new Date('2026-08-26T14:00:00Z');

    expect(
      podeCorrigirAgora({
        perfil: 'MOTORISTA',
        encerradaEm: ENCERRADA,
        agora: seisHorasDepois,
        janelaHoras: 4,
      }),
    ).toBe(false);
    expect(
      podeCorrigirAgora({
        perfil: 'MOTORISTA',
        encerradaEm: ENCERRADA,
        agora: seisHorasDepois,
        janelaHoras: 8,
      }),
    ).toBe(true);
  });

  it('o limite é exatamente a janela padrão', () => {
    const noLimite = new Date(ENCERRADA.getTime() + JANELA_EDICAO_HORAS_PADRAO * 3_600_000);

    expect(
      podeCorrigirAgora({ perfil: 'MOTORISTA', encerradaEm: ENCERRADA, agora: noLimite }),
    ).toBe(true);
    expect(
      podeCorrigirAgora({
        perfil: 'MOTORISTA',
        encerradaEm: ENCERRADA,
        agora: new Date(noLimite.getTime() + 1),
      }),
    ).toBe(false);
  });

  it('corrida sem encerramento não é corrigível pelo motorista', () => {
    expect(podeCorrigirAgora({ perfil: 'MOTORISTA', encerradaEm: null, agora: new Date() })).toBe(
      false,
    );
  });
});

describe('validarOdometroDeCorrecao', () => {
  it('aceita valor igual ou maior que o início', () => {
    expect(() => validarOdometroDeCorrecao(160_000, 160_000)).not.toThrow();
    expect(() => validarOdometroDeCorrecao(160_000, 160_045)).not.toThrow();
  });

  it('recusa valor abaixo do início da corrida', () => {
    // Km negativo contaminaria o total da jornada e o consolidado do dia.
    expect(codigoDoErro(() => validarOdometroDeCorrecao(160_000, 159_999))).toBe(
      CodigoErro.ODOMETRO_MENOR_QUE_INICIAL,
    );
  });

  it('recusa valor não inteiro ou negativo', () => {
    expect(codigoDoErro(() => validarOdometroDeCorrecao(100, -1))).toBe(
      CodigoErro.ODOMETRO_INCOERENTE,
    );
    expect(codigoDoErro(() => validarOdometroDeCorrecao(100, 150.5))).toBe(
      CodigoErro.ODOMETRO_INCOERENTE,
    );
  });

  it('não compara quando a corrida não tem odômetro inicial', () => {
    expect(() => validarOdometroDeCorrecao(null, 10)).not.toThrow();
  });
});
