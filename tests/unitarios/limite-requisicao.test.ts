import { beforeEach, describe, expect, it } from 'vitest';
import { consumirLimite, LIMITES, reiniciarLimites } from '@/lib/limite-requisicao';
import { ErroDeLimite } from '@/lib/erros';

const AGORA = Date.now();

describe('consumirLimite (RNF004)', () => {
  beforeEach(() => reiniciarLimites());

  it('permite requisições até o limite', () => {
    for (let tentativa = 1; tentativa <= LIMITES.login.maximo; tentativa += 1) {
      expect(() => consumirLimite('ip:1.2.3.4', LIMITES.login, AGORA)).not.toThrow();
    }
  });

  it('bloqueia a requisição seguinte ao limite', () => {
    for (let tentativa = 1; tentativa <= LIMITES.login.maximo; tentativa += 1) {
      consumirLimite('ip:1.2.3.4', LIMITES.login, AGORA);
    }

    expect(() => consumirLimite('ip:1.2.3.4', LIMITES.login, AGORA)).toThrowError(ErroDeLimite);
  });

  it('informa quantos segundos faltam para liberar', () => {
    for (let tentativa = 1; tentativa <= LIMITES.login.maximo; tentativa += 1) {
      consumirLimite('ip:1.2.3.4', LIMITES.login, AGORA);
    }

    try {
      consumirLimite('ip:1.2.3.4', LIMITES.login, AGORA + 60_000);
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      expect((erro as ErroDeLimite).segundosParaLiberar).toBe(LIMITES.login.janelaSegundos - 60);
    }
  });

  it('libera depois da janela', () => {
    for (let tentativa = 1; tentativa <= LIMITES.login.maximo; tentativa += 1) {
      consumirLimite('ip:1.2.3.4', LIMITES.login, AGORA);
    }

    const depois = AGORA + LIMITES.login.janelaSegundos * 1000 + 1;
    expect(() => consumirLimite('ip:1.2.3.4', LIMITES.login, depois)).not.toThrow();
  });

  it('conta cada chave separadamente', () => {
    for (let tentativa = 1; tentativa <= LIMITES.login.maximo; tentativa += 1) {
      consumirLimite('ip:1.2.3.4', LIMITES.login, AGORA);
    }

    expect(() => consumirLimite('ip:5.6.7.8', LIMITES.login, AGORA)).not.toThrow();
  });

  it('não bloqueia quando o IP é desconhecido', () => {
    // Barrar todo mundo por causa de um proxy mal configurado seria pior do que
    // deixar passar: o bloqueio por CPF (RN003) continua valendo.
    for (let tentativa = 1; tentativa <= LIMITES.login.maximo + 5; tentativa += 1) {
      expect(() => consumirLimite(null, LIMITES.login, AGORA)).not.toThrow();
    }
  });
});
