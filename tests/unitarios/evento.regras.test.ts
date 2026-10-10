import { describe, expect, it } from 'vitest';
import { CodigoErro } from '@/lib/erros';
import {
  JANELA_DESFAZER_MINUTOS,
  podeDesfazer,
  validarCorridaParaEvento,
  validarDesfazer,
  validarIdentificacaoDaParada,
  validarPontoDaRota,
  validarTipoManual,
} from '@/modulos/evento/evento.regras';

/** US021 — paradas e eventos da corrida. */

const AGORA = new Date('2026-08-26T14:00:00Z');

function codigoDoErro(acao: () => void): string {
  try {
    acao();
  } catch (erro) {
    return (erro as { codigo: string }).codigo;
  }
  throw new Error('esperava um erro, não houve');
}

describe('podeDesfazer', () => {
  it('permite dentro da janela de 2 minutos', () => {
    expect(podeDesfazer(new Date('2026-08-26T14:00:00Z'), AGORA)).toBe(true);
    expect(podeDesfazer(new Date('2026-08-26T13:59:00Z'), AGORA)).toBe(true);
    expect(podeDesfazer(new Date('2026-08-26T13:58:00Z'), AGORA)).toBe(true);
  });

  it('recusa depois da janela', () => {
    expect(podeDesfazer(new Date('2026-08-26T13:57:59Z'), AGORA)).toBe(false);
    expect(podeDesfazer(new Date('2026-08-26T13:00:00Z'), AGORA)).toBe(false);
  });

  it('recusa evento no futuro', () => {
    // Relógio de dispositivo adiantado não pode abrir uma janela maior do que a
    // combinada — o horário de referência é sempre o do servidor.
    expect(podeDesfazer(new Date('2026-08-26T14:05:00Z'), AGORA)).toBe(false);
  });

  it('a janela é a constante declarada, não um número solto', () => {
    const limite = new Date(AGORA.getTime() - JANELA_DESFAZER_MINUTOS * 60_000);

    expect(podeDesfazer(limite, AGORA)).toBe(true);
    expect(podeDesfazer(new Date(limite.getTime() - 1), AGORA)).toBe(false);
  });
});

describe('validarDesfazer', () => {
  it('não reclama dentro da janela', () => {
    expect(() => validarDesfazer(new Date('2026-08-26T13:59:00Z'), AGORA)).not.toThrow();
  });

  it('recusa fora da janela apontando o caminho da correção', () => {
    expect(codigoDoErro(() => validarDesfazer(new Date('2026-08-26T12:00:00Z'), AGORA))).toBe(
      CodigoErro.FORA_DA_JANELA_DE_EDICAO,
    );
  });
});

describe('validarTipoManual', () => {
  it('aceita os tipos que o motorista registra', () => {
    expect(() => validarTipoManual('CHEGADA')).not.toThrow();
    expect(() => validarTipoManual('SAIDA')).not.toThrow();
    expect(() => validarTipoManual('EMBARQUE')).not.toThrow();
    expect(() => validarTipoManual('DESEMBARQUE')).not.toThrow();
  });

  it('recusa início e fim, que a corrida deriva sozinha', () => {
    // Aceitá-los permitiria uma corrida com dois inícios, ou um fim antes do
    // encerramento — estados que nenhum relatório saberia interpretar.
    expect(codigoDoErro(() => validarTipoManual('INICIO'))).toBe(CodigoErro.DADOS_INVALIDOS);
    expect(codigoDoErro(() => validarTipoManual('FIM'))).toBe(CodigoErro.DADOS_INVALIDOS);
  });
});

describe('validarCorridaParaEvento', () => {
  it('aceita corrida em andamento', () => {
    expect(() => validarCorridaParaEvento('EM_ANDAMENTO')).not.toThrow();
  });

  it('recusa corrida encerrada ou cancelada', () => {
    // Depois de encerrada os totais já podem ter entrado no resumo do dia
    // (RN017); uma parada nova não corresponderia a número nenhum publicado.
    expect(codigoDoErro(() => validarCorridaParaEvento('ENCERRADA'))).toBe(
      CodigoErro.CORRIDA_JA_ENCERRADA,
    );
    expect(codigoDoErro(() => validarCorridaParaEvento('CANCELADA'))).toBe(
      CodigoErro.CORRIDA_JA_ENCERRADA,
    );
  });
});

describe('validarIdentificacaoDaParada', () => {
  it('dispensa nome quando há ponto cadastrado', () => {
    expect(() =>
      validarIdentificacaoDaParada({ pontoParadaId: 'ponto-1', descricao: null }),
    ).not.toThrow();
  });

  it('aceita nome livre na corrida avulsa', () => {
    expect(() =>
      validarIdentificacaoDaParada({ pontoParadaId: null, descricao: 'Portaria 2' }),
    ).not.toThrow();
  });

  it('recusa parada sem ponto e sem nome', () => {
    expect(
      codigoDoErro(() => validarIdentificacaoDaParada({ pontoParadaId: null, descricao: null })),
    ).toBe(CodigoErro.DADOS_INVALIDOS);
    expect(
      codigoDoErro(() => validarIdentificacaoDaParada({ pontoParadaId: null, descricao: '   ' })),
    ).toBe(CodigoErro.DADOS_INVALIDOS);
  });
});

describe('validarPontoDaRota', () => {
  it('aceita ponto da própria rota', () => {
    expect(() =>
      validarPontoDaRota({ pontoParadaId: 'p1', rotaDoPonto: 'r1', rotaDaCorrida: 'r1' }),
    ).not.toThrow();
  });

  it('recusa ponto de outra rota', () => {
    // Sem isto o relatório de destinos atendidos mentiria em silêncio.
    expect(
      codigoDoErro(() =>
        validarPontoDaRota({ pontoParadaId: 'p1', rotaDoPonto: 'r2', rotaDaCorrida: 'r1' }),
      ),
    ).toBe(CodigoErro.DADOS_INVALIDOS);
  });

  it('recusa ponto cadastrado em corrida avulsa', () => {
    expect(
      codigoDoErro(() =>
        validarPontoDaRota({ pontoParadaId: 'p1', rotaDoPonto: 'r1', rotaDaCorrida: null }),
      ),
    ).toBe(CodigoErro.DADOS_INVALIDOS);
  });

  it('ignora a verificação quando não há ponto', () => {
    expect(() =>
      validarPontoDaRota({ pontoParadaId: null, rotaDoPonto: null, rotaDaCorrida: 'r1' }),
    ).not.toThrow();
  });
});
