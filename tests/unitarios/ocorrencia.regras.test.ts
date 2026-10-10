import { describe, expect, it } from 'vitest';
import { CodigoErro } from '@/lib/erros';
import {
  ROTULO_DA_OCORRENCIA,
  TIPOS_DE_OCORRENCIA,
  ehGrave,
  validarJornadaParaOcorrencia,
  validarVinculo,
} from '@/modulos/ocorrencia/ocorrencia.regras';

/** US023 — ocorrências (RN023). */

function codigoDoErro(acao: () => void): string {
  try {
    acao();
  } catch (erro) {
    return (erro as { codigo: string }).codigo;
  }
  throw new Error('esperava um erro, não houve');
}

describe('tipos de ocorrência', () => {
  it('cobre os seis tipos previstos no critério de aceitação', () => {
    expect(TIPOS_DE_OCORRENCIA).toEqual([
      'ATRASO',
      'PANE',
      'ACIDENTE',
      'DESVIO',
      'PASSAGEIRO',
      'OUTRO',
    ]);
  });

  it('tem rótulo legível para todos', () => {
    for (const tipo of TIPOS_DE_OCORRENCIA) {
      expect(ROTULO_DA_OCORRENCIA[tipo]).toBeTruthy();
    }
  });
});

describe('ehGrave', () => {
  it('destaca o que tira a van de operação hoje', () => {
    expect(ehGrave('ACIDENTE')).toBe(true);
    expect(ehGrave('PANE')).toBe(true);
  });

  it('não destaca o que é apenas registro', () => {
    expect(ehGrave('ATRASO')).toBe(false);
    expect(ehGrave('DESVIO')).toBe(false);
    expect(ehGrave('PASSAGEIRO')).toBe(false);
    expect(ehGrave('OUTRO')).toBe(false);
  });

  it('não quebra com valor desconhecido', () => {
    expect(ehGrave('QUALQUER_COISA')).toBe(false);
  });
});

describe('validarVinculo', () => {
  it('aceita ocorrência sem corrida', () => {
    expect(() =>
      validarVinculo({ jornadaId: 'j1', corridaId: null, jornadaDaCorrida: null }),
    ).not.toThrow();
  });

  it('aceita corrida da mesma jornada', () => {
    expect(() =>
      validarVinculo({ jornadaId: 'j1', corridaId: 'c1', jornadaDaCorrida: 'j1' }),
    ).not.toThrow();
  });

  it('recusa corrida de outra jornada', () => {
    // Um identificador trocado penduraria o relato de um motorista na corrida
    // de outro, e o relatório do dia mentiria sem mostrar erro.
    expect(
      codigoDoErro(() =>
        validarVinculo({ jornadaId: 'j1', corridaId: 'c1', jornadaDaCorrida: 'j2' }),
      ),
    ).toBe(CodigoErro.DADOS_INVALIDOS);
  });
});

describe('validarJornadaParaOcorrencia', () => {
  it('aceita jornada aberta e encerrada', () => {
    // Encerrada também: o motorista costuma lembrar do problema depois de
    // fechar o dia, e RN023 garante que o relato não mexe em nada.
    expect(() => validarJornadaParaOcorrencia('ABERTA')).not.toThrow();
    expect(() => validarJornadaParaOcorrencia('ENCERRADA')).not.toThrow();
  });

  it('recusa jornada cancelada', () => {
    // Dia cancelado não aconteceu; o relato ficaria invisível em todo relatório.
    expect(codigoDoErro(() => validarJornadaParaOcorrencia('CANCELADA'))).toBe(
      CodigoErro.JORNADA_NAO_ABERTA,
    );
  });
});
