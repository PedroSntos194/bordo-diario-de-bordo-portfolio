import { describe, expect, it } from 'vitest';
import {
  MAX_TENTATIVAS,
  elegivelParaReenvioAutomatico,
  intervaloDeReenvioSegundos,
  podeReenviarManualmente,
  requerAtencao,
} from '@/modulos/notificacao/reenvio.regras';

/** US037 — reenvio de notificações (RN028). */

const AGORA = new Date('2026-08-26T12:00:00Z');

describe('intervaloDeReenvioSegundos', () => {
  it('cresce a cada tentativa: 1, 5 e 25 minutos', () => {
    expect(intervaloDeReenvioSegundos(1)).toBe(60);
    expect(intervaloDeReenvioSegundos(2)).toBe(300);
    expect(intervaloDeReenvioSegundos(3)).toBe(1500);
  });

  it('não encolhe nem estoura fora da faixa de tentativas', () => {
    expect(intervaloDeReenvioSegundos(0)).toBe(60);
    expect(intervaloDeReenvioSegundos(99)).toBe(intervaloDeReenvioSegundos(MAX_TENTATIVAS));
  });
});

describe('requerAtencao', () => {
  it('marca quem esgotou as tentativas automáticas e continua em falha', () => {
    expect(requerAtencao('FALHA', MAX_TENTATIVAS)).toBe(true);
    expect(requerAtencao('FALHA', MAX_TENTATIVAS + 1)).toBe(true);
  });

  it('não marca quem ainda tem tentativa, nem quem já saiu', () => {
    expect(requerAtencao('FALHA', 1)).toBe(false);
    expect(requerAtencao('ENVIADA', 9)).toBe(false);
    expect(requerAtencao('PENDENTE', 9)).toBe(false);
  });
});

describe('podeReenviarManualmente', () => {
  it('libera falha e pendente', () => {
    // O limite de três é para o robô, não para a pessoa: quem clica já sabe que
    // as automáticas falharam e provavelmente corrigiu a causa.
    expect(podeReenviarManualmente('FALHA')).toBe(true);
    expect(podeReenviarManualmente('PENDENTE')).toBe(true);
  });

  it('recusa o que já saiu ou foi cancelado', () => {
    expect(podeReenviarManualmente('ENVIADA')).toBe(false);
    expect(podeReenviarManualmente('CANCELADA')).toBe(false);
  });
});

describe('elegivelParaReenvioAutomatico', () => {
  const base = {
    status: 'FALHA',
    tentativas: 1,
    ultimaTentativaEm: new Date('2026-08-26T11:00:00Z'),
    agora: AGORA,
    servidorEnvia: true,
  };

  it('aceita falha dentro do limite, com a espera cumprida', () => {
    expect(elegivelParaReenvioAutomatico(base)).toBe(true);
  });

  it('recusa quando o servidor não é quem envia', () => {
    // Canal de link: quem dispara é o aplicativo do motorista. Repetir do
    // servidor gastaria as três tentativas sem ninguém ter tentado.
    expect(elegivelParaReenvioAutomatico({ ...base, servidorEnvia: false })).toBe(false);
  });

  it('recusa antes de cumprir a espera crescente', () => {
    // Tentativa 1 espera 1 minuto; 30 segundos não bastam.
    const haMeioMinuto = new Date(AGORA.getTime() - 30_000);

    expect(elegivelParaReenvioAutomatico({ ...base, ultimaTentativaEm: haMeioMinuto })).toBe(false);
  });

  it('recusa depois de esgotar as tentativas', () => {
    expect(elegivelParaReenvioAutomatico({ ...base, tentativas: MAX_TENTATIVAS })).toBe(false);
  });

  it('só age sobre falha', () => {
    expect(elegivelParaReenvioAutomatico({ ...base, status: 'PENDENTE' })).toBe(false);
    expect(elegivelParaReenvioAutomatico({ ...base, status: 'ENVIADA' })).toBe(false);
  });

  it('respeita a espera maior das tentativas seguintes', () => {
    const vinteMinutosAtras = new Date(AGORA.getTime() - 20 * 60_000);

    // 20 min basta para a tentativa 2 (espera de 5), não para a 3 (espera de 25).
    expect(
      elegivelParaReenvioAutomatico({
        ...base,
        tentativas: 2,
        ultimaTentativaEm: vinteMinutosAtras,
      }),
    ).toBe(true);

    // A terceira só é elegível se ainda houver tentativa disponível — com
    // MAX_TENTATIVAS = 3, `tentativas: 2` é a última que o robô executa.
    expect(intervaloDeReenvioSegundos(3)).toBe(1500);
  });
});
