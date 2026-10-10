import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { aplicarMensagensEmPortugues } from '@/lib/validacao';
import { exigirJornadaAbertaParaCorrida } from '@/modulos/corrida/corrida.regras';
import {
  esquemaEncerrarCorrida,
  esquemaEncerrarJornada,
  esquemaIniciarCorrida,
  esquemaLocalizacao,
} from '@/modulos/corrida/corrida.schema';
import { CodigoErro, type ErroDaAplicacao } from '@/lib/erros';

beforeAll(() => aplicarMensagensEmPortugues());

function erros(resultado: z.SafeParseReturnType<unknown, unknown>): Record<string, string> {
  if (resultado.success) return {};
  const campos: Record<string, string> = {};
  for (const problema of resultado.error.issues) {
    campos[problema.path.join('.') || 'geral'] ??= problema.message;
  }
  return campos;
}

const ROTA = '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607';
const CORRIDA = '8a7b6c5d-4e3f-4a2b-9c8d-7e6f5a4b3c2d';

describe('exigirJornadaAbertaParaCorrida (RN014)', () => {
  it('passa com jornada aberta', () => {
    expect(() => exigirJornadaAbertaParaCorrida(true)).not.toThrow();
  });

  it('orienta a abrir o dia quando não há jornada', () => {
    try {
      exigirJornadaAbertaParaCorrida(false);
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      const falha = erro as ErroDaAplicacao;
      expect(falha.codigo).toBe(CodigoErro.JORNADA_NAO_ABERTA);
      // A mensagem precisa apontar o caminho de saída, não só recusar.
      expect(falha.message).toContain('Inicie seu dia');
    }
  });
});

describe('esquemaIniciarCorrida (US018)', () => {
  it('aceita corrida por rota cadastrada', () => {
    expect(esquemaIniciarCorrida.safeParse({ rotaId: ROTA }).success).toBe(true);
  });

  it('aceita corrida avulsa com origem e destino', () => {
    const resultado = esquemaIniciarCorrida.safeParse({
      origemDescricao: 'Terminal Centro',
      destinoDescricao: 'Planta Industrial',
    });
    expect(resultado.success).toBe(true);
  });

  it('recusa corrida sem rota e sem origem/destino', () => {
    const campos = erros(esquemaIniciarCorrida.safeParse({}));
    expect(campos.rotaId).toBe('Escolha uma rota ou informe origem e destino.');
  });

  it('recusa corrida avulsa pela metade', () => {
    const campos = erros(esquemaIniciarCorrida.safeParse({ origemDescricao: 'Terminal Centro' }));
    expect(campos.rotaId).toBeDefined();
  });

  it('aceita ausência de localização — GPS negado não bloqueia (RN022)', () => {
    const resultado = esquemaIniciarCorrida.safeParse({ rotaId: ROTA });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.localizacao).toBeUndefined();
  });
});

describe('esquemaLocalizacao (US020)', () => {
  it('aceita coordenada com precisão', () => {
    const resultado = esquemaLocalizacao.safeParse({
      latitude: -23.5505,
      longitude: -46.6333,
      precisaoMetros: 12.4,
      capturadoEm: '2026-08-23T12:00:00.000Z',
    });
    expect(resultado.success).toBe(true);
  });

  it('aceita precisão desconhecida', () => {
    expect(
      esquemaLocalizacao.safeParse({ latitude: -23.55, longitude: -46.63, precisaoMetros: null })
        .success,
    ).toBe(true);
  });

  it('recusa coordenada fora da faixa', () => {
    expect(esquemaLocalizacao.safeParse({ latitude: 91, longitude: 0 }).success).toBe(false);
    expect(esquemaLocalizacao.safeParse({ latitude: 0, longitude: -181 }).success).toBe(false);
  });
});

describe('esquemaEncerrarCorrida (US019)', () => {
  const VALIDO = { id: CORRIDA, odometroFinal: '84347' };

  it('converte o odômetro digitado', () => {
    const resultado = esquemaEncerrarCorrida.safeParse(VALIDO);
    if (resultado.success) expect(resultado.data.odometroFinal).toBe(84347);
  });

  it('recusa odômetro fracionário', () => {
    const campos = erros(esquemaEncerrarCorrida.safeParse({ ...VALIDO, odometroFinal: '84347,5' }));
    expect(campos.odometroFinal).toBeDefined();
  });

  it('passageiros é opcional', () => {
    expect(esquemaEncerrarCorrida.safeParse(VALIDO).success).toBe(true);
  });

  it('recusa passageiros fracionário', () => {
    const campos = erros(
      esquemaEncerrarCorrida.safeParse({ ...VALIDO, quantidadePassageiros: '12.5' }),
    );
    expect(campos.quantidadePassageiros).toBe('Informe um número inteiro de passageiros.');
  });

  it('a confirmação de excesso começa falsa', () => {
    // Confirmar precisa ser ação explícita do motorista (RN016).
    const resultado = esquemaEncerrarCorrida.safeParse(VALIDO);
    if (resultado.success) expect(resultado.data.confirmaExcessoPassageiros).toBe(false);
  });
});

describe('esquemaEncerrarJornada (US017)', () => {
  it('exige o odômetro final com mensagem específica', () => {
    // A mensagem do campo tem precedência sobre a genérica do mapa global, e
    // aqui isso é desejável: ela já diz em que unidade o valor é esperado.
    const campos = erros(esquemaEncerrarJornada.safeParse({}));
    expect(campos.odometroFinal).toBe('Informe o odômetro em quilômetros.');
  });

  it('aceita observação vazia', () => {
    const resultado = esquemaEncerrarJornada.safeParse({ odometroFinal: '84512', observacoes: '' });
    expect(resultado.success).toBe(true);
  });

  it('não aceita totais vindos do cliente — são calculados (RN018)', () => {
    const resultado = esquemaEncerrarJornada.safeParse({
      odometroFinal: '84512',
      kmTotal: '9999',
      totalCorridas: '99',
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect('kmTotal' in resultado.data).toBe(false);
      expect('totalCorridas' in resultado.data).toBe(false);
    }
  });
});
