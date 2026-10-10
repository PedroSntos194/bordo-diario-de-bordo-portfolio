import { describe, expect, it } from 'vitest';
import {
  POLITICA_BLOQUEIO,
  aplicarFalhaDeLogin,
  contaEstaBloqueada,
  expiracaoDaSenhaTemporaria,
  limparTentativas,
  minutosRestantesDeBloqueio,
  podeAutenticar,
  problemasDaSenha,
  senhaTemporariaExpirou,
  validarAcaoAdministrativa,
  validarCpf,
  validarSenha,
} from '@/modulos/usuario/usuario.regras';
import { CodigoErro, ErroDeConflito, ErroDeNegocio } from '@/lib/erros';

const AGORA = new Date('2026-08-23T12:00:00Z');
const CONTEXTO = { cpf: '52998224725', matricula: 'M-1234' };

describe('validarCpf (RN002)', () => {
  it('devolve apenas os dígitos de um CPF válido', () => {
    expect(validarCpf('529.982.247-25')).toBe('52998224725');
  });

  it('recusa CPF inválido com código próprio', () => {
    expect(() => validarCpf('52998224726')).toThrowError(ErroDeNegocio);
    try {
      validarCpf('11111111111');
    } catch (erro) {
      expect((erro as ErroDeNegocio).codigo).toBe(CodigoErro.CPF_INVALIDO);
    }
  });
});

describe('problemasDaSenha (RN004)', () => {
  it('aceita senha que atende à política', () => {
    expect(problemasDaSenha('bordo2026', CONTEXTO)).toEqual([]);
  });

  it('acusa todos os problemas de uma vez', () => {
    const problemas = problemasDaSenha('abc', CONTEXTO);
    expect(problemas).toHaveLength(2); // curta e sem número
    expect(problemas[0]).toContain('8 caracteres');
  });

  it('exige letra e número', () => {
    expect(problemasDaSenha('12345678', CONTEXTO)).toContain(
      'A senha precisa conter ao menos uma letra.',
    );
    expect(problemasDaSenha('abcdefgh', CONTEXTO)).toContain(
      'A senha precisa conter ao menos um número.',
    );
  });

  it('recusa senha igual ao CPF, com ou sem máscara', () => {
    expect(problemasDaSenha('52998224725', CONTEXTO)).toContain(
      'A senha não pode ser igual ao seu CPF.',
    );
    expect(problemasDaSenha('529.982.247-25', CONTEXTO)).toContain(
      'A senha não pode ser igual ao seu CPF.',
    );
  });

  it('recusa senha igual à matrícula', () => {
    expect(problemasDaSenha('M-1234', CONTEXTO)).toContain(
      'A senha não pode ser igual à sua matrícula.',
    );
  });

  it('recusa repetição da senha anterior', () => {
    const problemas = problemasDaSenha('bordo2026', { ...CONTEXTO, igualASenhaAnterior: true });
    expect(problemas).toContain('A nova senha não pode ser igual à anterior.');
  });

  it('aceita exatamente 8 caracteres — fronteira', () => {
    expect(problemasDaSenha('bordo123', CONTEXTO)).toEqual([]);
    expect(problemasDaSenha('bord123', CONTEXTO)).not.toEqual([]);
  });
});

describe('validarSenha', () => {
  it('usa código SENHA_REPETIDA quando o problema é a repetição', () => {
    try {
      validarSenha('bordo2026', { ...CONTEXTO, igualASenhaAnterior: true });
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      expect((erro as ErroDeNegocio).codigo).toBe(CodigoErro.SENHA_REPETIDA);
    }
  });

  it('usa código SENHA_FRACA nos demais casos', () => {
    try {
      validarSenha('abc', CONTEXTO);
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      expect((erro as ErroDeNegocio).codigo).toBe(CodigoErro.SENHA_FRACA);
    }
  });

  it('não lança para senha válida', () => {
    expect(() => validarSenha('bordo2026', CONTEXTO)).not.toThrow();
  });
});

describe('senha temporária (RN005)', () => {
  it('expira 72 horas após a emissão', () => {
    const expiracao = expiracaoDaSenhaTemporaria(AGORA);
    expect(expiracao.toISOString()).toBe('2026-08-26T12:00:00.000Z');
  });

  it('reconhece a expiração', () => {
    const expiracao = expiracaoDaSenhaTemporaria(AGORA);
    expect(senhaTemporariaExpirou(expiracao, new Date('2026-08-26T11:59:00Z'))).toBe(false);
    expect(senhaTemporariaExpirou(expiracao, new Date('2026-08-26T12:00:01Z'))).toBe(true);
  });

  it('senha permanente nunca expira', () => {
    expect(senhaTemporariaExpirou(null, AGORA)).toBe(false);
  });
});

describe('bloqueio por tentativas (RN003)', () => {
  it('bloqueia exatamente na quinta falha', () => {
    let estado = { tentativasLogin: 0, bloqueadoAte: null as Date | null };

    for (let tentativa = 1; tentativa < POLITICA_BLOQUEIO.tentativasMaximas; tentativa += 1) {
      estado = aplicarFalhaDeLogin(estado, AGORA);
      expect(estado.bloqueadoAte).toBeNull();
    }

    estado = aplicarFalhaDeLogin(estado, AGORA);
    expect(estado.tentativasLogin).toBe(5);
    expect(estado.bloqueadoAte).not.toBeNull();
    expect(contaEstaBloqueada(estado, AGORA)).toBe(true);
  });

  it('não estende a janela com novas tentativas durante o bloqueio', () => {
    const bloqueadoAte = new Date(AGORA.getTime() + 10 * 60_000);
    const estado = aplicarFalhaDeLogin({ tentativasLogin: 5, bloqueadoAte }, AGORA);

    expect(estado.bloqueadoAte).toBe(bloqueadoAte);
    expect(estado.tentativasLogin).toBe(6);
  });

  it('libera após o prazo', () => {
    const estado = {
      tentativasLogin: 5,
      bloqueadoAte: new Date(AGORA.getTime() + 15 * 60_000),
    };
    expect(contaEstaBloqueada(estado, new Date(AGORA.getTime() + 16 * 60_000))).toBe(false);
  });

  it('informa os minutos restantes, arredondando para cima', () => {
    const estado = {
      tentativasLogin: 5,
      bloqueadoAte: new Date(AGORA.getTime() + 90_000),
    };
    expect(minutosRestantesDeBloqueio(estado, AGORA)).toBe(2);
    expect(minutosRestantesDeBloqueio({ tentativasLogin: 0, bloqueadoAte: null }, AGORA)).toBe(0);
  });

  it('login bem-sucedido zera o contador', () => {
    expect(limparTentativas()).toEqual({ tentativasLogin: 0, bloqueadoAte: null });
  });
});

describe('podeAutenticar (RN006)', () => {
  it('permite apenas usuário ativo', () => {
    expect(podeAutenticar('ATIVO')).toBe(true);
    expect(podeAutenticar('INATIVO')).toBe(false);
    expect(podeAutenticar('BLOQUEADO')).toBe(false);
    expect(podeAutenticar('EXCLUIDO')).toBe(false);
  });
});

describe('validarAcaoAdministrativa (RN010, RN011)', () => {
  const base = {
    idAlvo: 'usuario-1',
    perfilAlvo: 'MOTORISTA' as const,
    idExecutor: 'admin-1',
    administradoresAtivos: 3,
  };

  it('permite ação normal sobre outro usuário', () => {
    expect(() => validarAcaoAdministrativa(base)).not.toThrow();
  });

  it('proíbe ação sobre a própria conta', () => {
    try {
      validarAcaoAdministrativa({ ...base, idAlvo: 'admin-1' });
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      expect((erro as ErroDeConflito).codigo).toBe(CodigoErro.ACAO_SOBRE_PROPRIA_CONTA);
    }
  });

  it('protege o último administrador ativo', () => {
    try {
      validarAcaoAdministrativa({
        ...base,
        perfilAlvo: 'ADMIN',
        administradoresAtivos: 1,
      });
      expect.unreachable('deveria ter lançado');
    } catch (erro) {
      expect((erro as ErroDeConflito).codigo).toBe(CodigoErro.ULTIMO_ADMINISTRADOR);
    }
  });

  it('permite remover um administrador quando há outros', () => {
    expect(() =>
      validarAcaoAdministrativa({ ...base, perfilAlvo: 'ADMIN', administradoresAtivos: 2 }),
    ).not.toThrow();
  });
});
