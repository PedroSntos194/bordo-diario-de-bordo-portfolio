import { describe, expect, it } from 'vitest';
import { CodigoErro, ehErroDaAplicacao } from '@/lib/erros';
import {
  CHAVE_RETENCAO_ARQUIVOS,
  CHAVE_RETENCAO_LOCALIZACAO,
  LOTE_DE_EXCLUSAO,
  MAXIMO_POR_EXECUCAO,
  POLITICAS,
  TABELAS_QUE_O_EXPURGO_TOCA,
  dataDeCorte,
  expurgoVazio,
  politicaDe,
  resumirExpurgo,
  validarPrazo,
  type ResultadoDoExpurgo,
} from '@/modulos/retencao/retencao.regras';

/** US044 — prazos, data de corte e o que a rotina relata. */

function resultado(sobrescritas: Partial<ResultadoDoExpurgo> = {}): ResultadoDoExpurgo {
  return {
    localizacoesRemovidas: 0,
    arquivosExpurgados: 0,
    sessoesRemovidas: 0,
    restaram: false,
    ...sobrescritas,
  };
}

function codigoDoErro(executar: () => void): string | null {
  try {
    executar();
    return null;
  } catch (erro) {
    return ehErroDaAplicacao(erro) ? erro.codigo : 'DESCONHECIDO';
  }
}

describe('políticas', () => {
  it('cobre localização e planilhas, com os prazos da RNF007', () => {
    expect(politicaDe(CHAVE_RETENCAO_LOCALIZACAO)?.padraoMeses).toBe(12);
    // Cinco anos para diários e relatórios.
    expect(politicaDe(CHAVE_RETENCAO_ARQUIVOS)?.padraoMeses).toBe(60);
    expect(POLITICAS).toHaveLength(2);
  });

  it('não declara nenhuma política sobre a trilha de auditoria', () => {
    // A trilha é imutável (RN027) e o expurgo dela é procedimento privilegiado,
    // fora do alcance da aplicação. Se um dia alguém acrescentar a chave aqui,
    // este teste avisa antes de o poder de apagar a trilha entrar no sistema.
    expect(POLITICAS.some((politica) => politica.chave.includes('auditoria'))).toBe(false);
    expect(TABELAS_QUE_O_EXPURGO_TOCA).not.toContain('log_auditoria');
  });

  it('não toca em corrida nem jornada — os totais consolidados não podem mudar', () => {
    expect(TABELAS_QUE_O_EXPURGO_TOCA).not.toContain('corrida');
    expect(TABELAS_QUE_O_EXPURGO_TOCA).not.toContain('jornada');
    expect(TABELAS_QUE_O_EXPURGO_TOCA).toContain('ponto_localizacao');
  });
});

describe('validarPrazo', () => {
  it('aceita um valor dentro da faixa e devolve número', () => {
    expect(validarPrazo(CHAVE_RETENCAO_LOCALIZACAO, '18')).toBe(18);
    expect(validarPrazo(CHAVE_RETENCAO_LOCALIZACAO, 24)).toBe(24);
  });

  it('recusa prazo abaixo do mínimo', () => {
    // Prazo curto demais apagaria o rastro antes de a janela de correção do
    // registro fechar.
    expect(codigoDoErro(() => validarPrazo(CHAVE_RETENCAO_LOCALIZACAO, 1))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });

  it('recusa prazo acima do máximo e valor não inteiro', () => {
    expect(codigoDoErro(() => validarPrazo(CHAVE_RETENCAO_LOCALIZACAO, 999))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
    expect(codigoDoErro(() => validarPrazo(CHAVE_RETENCAO_LOCALIZACAO, '12,5'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });

  it('recusa chave desconhecida', () => {
    expect(codigoDoErro(() => validarPrazo('retencao_auditoria_meses', 60))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });

  it('aponta o campo no erro, para a tela destacar', () => {
    try {
      validarPrazo(CHAVE_RETENCAO_LOCALIZACAO, 1);
    } catch (erro) {
      expect(ehErroDaAplicacao(erro) && erro.campos?.[CHAVE_RETENCAO_LOCALIZACAO]).toContain(
        'Entre 3 e 120',
      );
    }
  });
});

describe('dataDeCorte', () => {
  it('recua meses de calendário, não múltiplos de 30 dias', () => {
    // Doze meses a partir de 15 de março tem de cair em 15 de março.
    const corte = dataDeCorte(12, new Date('2026-03-15T10:00:00Z'));
    expect(corte.toISOString().slice(0, 10)).toBe('2025-03-15');
  });

  it('atravessa a virada do ano', () => {
    const corte = dataDeCorte(3, new Date('2026-02-10T00:00:00Z'));
    expect(corte.toISOString().slice(0, 10)).toBe('2025-11-10');
  });

  it('preserva a hora, para o corte ser exato e não do dia inteiro', () => {
    const corte = dataDeCorte(1, new Date('2026-08-28T18:30:00Z'));
    expect(corte.toISOString()).toBe('2026-07-28T18:30:00.000Z');
  });
});

describe('tetos de execução', () => {
  it('o lote cabe dentro do teto por execução', () => {
    // Se o lote fosse maior que o teto, a primeira iteração já o estouraria e a
    // rotina apagaria mais do que o limite anunciado na tela.
    expect(LOTE_DE_EXCLUSAO).toBeLessThanOrEqual(MAXIMO_POR_EXECUCAO);
  });
});

describe('resumirExpurgo', () => {
  it('distingue "rodou e estava limpo" de "não rodou"', () => {
    expect(expurgoVazio(resultado())).toBe(true);
    expect(resumirExpurgo(resultado())).toBe('Nada vencido: nenhum dado foi apagado.');
  });

  it('lista só o que de fato saiu', () => {
    const texto = resumirExpurgo(resultado({ localizacoesRemovidas: 1200, sessoesRemovidas: 3 }));

    expect(texto).toContain('1.200 pontos de GPS');
    expect(texto).toContain('3 sessões expiradas');
    expect(texto).not.toContain('planilha');
  });

  it('concorda em número no singular', () => {
    const texto = resumirExpurgo(
      resultado({ localizacoesRemovidas: 1, arquivosExpurgados: 1, sessoesRemovidas: 1 }),
    );

    expect(texto).toContain('1 ponto de GPS');
    expect(texto).toContain('1 planilha');
    expect(texto).toContain('1 sessão expirada');
  });

  it('avisa quando o teto interrompeu o trabalho', () => {
    // Sem este aviso, alguém concluiria que o expurgo terminou quando não
    // terminou — e o dado vencido continuaria lá sem ninguém saber.
    const texto = resumirExpurgo(resultado({ localizacoesRemovidas: 200_000, restaram: true }));

    expect(texto).toContain('teto por execução foi atingido');
  });
});
