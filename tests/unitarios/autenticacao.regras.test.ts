import { describe, expect, it } from 'vitest';
import {
  aceitouAvisoVigente,
  avaliarTentativaDeLogin,
  destinoAposLogin,
  pendenciaDeUso,
  retornoEhSeguro,
  type UsuarioParaLogin,
} from '@/modulos/autenticacao/autenticacao.regras';
import { esquemaAceitePrivacidade } from '@/modulos/autenticacao/autenticacao.schema';
import { VERSAO_AVISO_PRIVACIDADE } from '@/modulos/privacidade/aviso-privacidade';

const AGORA = new Date('2026-08-23T12:00:00Z');

function usuario(sobrescritas: Partial<UsuarioParaLogin> = {}): UsuarioParaLogin {
  return {
    status: 'ATIVO',
    tentativasLogin: 0,
    bloqueadoAte: null,
    senhaTemporariaExpiraEm: null,
    ...sobrescritas,
  };
}

describe('avaliarTentativaDeLogin (US001)', () => {
  it('autentica usuário ativo com senha correta', () => {
    const decisao = avaliarTentativaDeLogin({
      usuario: usuario(),
      senhaCorreta: true,
      agora: AGORA,
    });

    expect(decisao.tipo).toBe('SUCESSO');
    if (decisao.tipo === 'SUCESSO') {
      expect(decisao.novoEstado).toEqual({ tentativasLogin: 0, bloqueadoAte: null });
    }
  });

  it('zera o contador de tentativas ao autenticar', () => {
    const decisao = avaliarTentativaDeLogin({
      usuario: usuario({ tentativasLogin: 3 }),
      senhaCorreta: true,
      agora: AGORA,
    });

    expect(decisao).toMatchObject({
      tipo: 'SUCESSO',
      novoEstado: { tentativasLogin: 0, bloqueadoAte: null },
    });
  });

  it('não distingue CPF inexistente de senha errada na resposta', () => {
    const inexistente = avaliarTentativaDeLogin({
      usuario: null,
      senhaCorreta: false,
      agora: AGORA,
    });

    expect(inexistente.tipo).toBe('USUARIO_INEXISTENTE');
    // O serviço traduz USUARIO_INEXISTENTE e CREDENCIAIS_INVALIDAS para a mesma
    // mensagem — este teste documenta que a distinção existe só internamente.
  });

  it('incrementa o contador a cada senha errada', () => {
    const decisao = avaliarTentativaDeLogin({
      usuario: usuario({ tentativasLogin: 2 }),
      senhaCorreta: false,
      agora: AGORA,
    });

    expect(decisao).toMatchObject({
      tipo: 'CREDENCIAIS_INVALIDAS',
      novoEstado: { tentativasLogin: 3 },
      bloqueouAgora: false,
    });
  });

  it('sinaliza o bloqueio exatamente na quinta falha (RN003)', () => {
    const decisao = avaliarTentativaDeLogin({
      usuario: usuario({ tentativasLogin: 4 }),
      senhaCorreta: false,
      agora: AGORA,
    });

    expect(decisao.tipo).toBe('CREDENCIAIS_INVALIDAS');
    if (decisao.tipo === 'CREDENCIAIS_INVALIDAS') {
      expect(decisao.bloqueouAgora).toBe(true);
      expect(decisao.novoEstado.bloqueadoAte).not.toBeNull();
    }
  });

  it('barra conta bloqueada ANTES de conferir a senha', () => {
    // Se a senha fosse conferida primeiro, a força bruta continuaria rodando
    // durante o bloqueio.
    const decisao = avaliarTentativaDeLogin({
      usuario: usuario({
        tentativasLogin: 5,
        bloqueadoAte: new Date(AGORA.getTime() + 10 * 60_000),
      }),
      senhaCorreta: true,
      agora: AGORA,
    });

    expect(decisao).toMatchObject({ tipo: 'CONTA_BLOQUEADA', minutosRestantes: 10 });
  });

  it('libera a conta depois de vencido o bloqueio', () => {
    const decisao = avaliarTentativaDeLogin({
      usuario: usuario({
        tentativasLogin: 5,
        bloqueadoAte: new Date(AGORA.getTime() - 1000),
      }),
      senhaCorreta: true,
      agora: AGORA,
    });

    expect(decisao.tipo).toBe('SUCESSO');
  });

  it.each([1000, 0])(
    'sinaliza novo bloqueio por senha errada quando o anterior expirou há %i ms',
    (tempoDecorrido) => {
      const decisao = avaliarTentativaDeLogin({
        usuario: usuario({
          tentativasLogin: 5,
          bloqueadoAte: new Date(AGORA.getTime() - tempoDecorrido),
        }),
        senhaCorreta: false,
        agora: AGORA,
      });

      expect(decisao).toEqual({
        tipo: 'CREDENCIAIS_INVALIDAS',
        novoEstado: {
          tentativasLogin: 6,
          bloqueadoAte: new Date(AGORA.getTime() + 15 * 60_000),
        },
        bloqueouAgora: true,
      });
    },
  );

  it('mantém o bloqueio vigente até um milissegundo antes da expiração', () => {
    const decisao = avaliarTentativaDeLogin({
      usuario: usuario({
        tentativasLogin: 5,
        bloqueadoAte: new Date(AGORA.getTime() + 1),
      }),
      senhaCorreta: false,
      agora: AGORA,
    });

    expect(decisao).toEqual({ tipo: 'CONTA_BLOQUEADA', minutosRestantes: 1 });
  });

  it('revela "conta inativa" apenas depois da senha correta', () => {
    // Antes da senha correta, a resposta é genérica: dizer "conta inativa" a
    // quem não sabe a senha confirmaria que o CPF existe.
    const comSenhaErrada = avaliarTentativaDeLogin({
      usuario: usuario({ status: 'INATIVO' }),
      senhaCorreta: false,
      agora: AGORA,
    });
    expect(comSenhaErrada.tipo).toBe('CREDENCIAIS_INVALIDAS');

    const comSenhaCorreta = avaliarTentativaDeLogin({
      usuario: usuario({ status: 'INATIVO' }),
      senhaCorreta: true,
      agora: AGORA,
    });
    expect(comSenhaCorreta.tipo).toBe('CONTA_INATIVA');
  });

  it('barra usuário bloqueado ou excluído pelo administrador (RN006)', () => {
    for (const status of ['INATIVO', 'BLOQUEADO', 'EXCLUIDO'] as const) {
      const decisao = avaliarTentativaDeLogin({
        usuario: usuario({ status }),
        senhaCorreta: true,
        agora: AGORA,
      });
      expect(decisao.tipo).toBe('CONTA_INATIVA');
    }
  });

  it('recusa senha temporária vencida (RN005)', () => {
    const decisao = avaliarTentativaDeLogin({
      usuario: usuario({ senhaTemporariaExpiraEm: new Date(AGORA.getTime() - 1000) }),
      senhaCorreta: true,
      agora: AGORA,
    });

    expect(decisao.tipo).toBe('SENHA_TEMPORARIA_EXPIRADA');
  });

  it('aceita senha temporária ainda válida — fronteira', () => {
    const decisao = avaliarTentativaDeLogin({
      usuario: usuario({ senhaTemporariaExpiraEm: AGORA }),
      senhaCorreta: true,
      agora: AGORA,
    });

    expect(decisao.tipo).toBe('SUCESSO');
  });
});

describe('destinoAposLogin (doc 09 · F01)', () => {
  it('manda o motorista para a área dele', () => {
    expect(
      destinoAposLogin({ perfil: 'MOTORISTA', deveTrocarSenha: false, aceitouPrivacidade: true }),
    ).toBe('/app');
  });

  it('manda o administrador para o painel', () => {
    expect(
      destinoAposLogin({ perfil: 'ADMIN', deveTrocarSenha: false, aceitouPrivacidade: true }),
    ).toBe('/admin');
  });

  it('troca de senha tem precedência sobre tudo', () => {
    expect(
      destinoAposLogin({ perfil: 'ADMIN', deveTrocarSenha: true, aceitouPrivacidade: false }),
    ).toBe('/trocar-senha');
  });

  it('aviso de privacidade vem antes da área do perfil', () => {
    expect(
      destinoAposLogin({ perfil: 'MOTORISTA', deveTrocarSenha: false, aceitouPrivacidade: false }),
    ).toBe('/privacidade/aceite');
  });
});

describe('aceitouAvisoVigente (RF042)', () => {
  it('quem nunca aceitou precisa aceitar', () => {
    expect(aceitouAvisoVigente([])).toBe(false);
  });

  it('aceite de versão anterior não vale depois que o texto muda', () => {
    expect(aceitouAvisoVigente([{ versaoTexto: '1.0' }])).toBe(false);
  });

  it('vale o aceite da versão vigente, ainda que haja anteriores', () => {
    expect(
      aceitouAvisoVigente([{ versaoTexto: '1.0' }, { versaoTexto: VERSAO_AVISO_PRIVACIDADE }]),
    ).toBe(true);
  });
});

describe('pendenciaDeUso (RF003, RF042)', () => {
  it('senha temporária vem antes de tudo', () => {
    expect(pendenciaDeUso({ deveTrocarSenha: true, aceitouPrivacidade: false })).toBe(
      'TROCAR_SENHA',
    );
  });

  it('com senha definitiva, falta o aceite do aviso', () => {
    expect(pendenciaDeUso({ deveTrocarSenha: false, aceitouPrivacidade: false })).toBe(
      'ACEITAR_PRIVACIDADE',
    );
  });

  it('sem pendência, libera o uso', () => {
    expect(pendenciaDeUso({ deveTrocarSenha: false, aceitouPrivacidade: true })).toBeNull();
  });
});

describe('esquemaAceitePrivacidade (RF042)', () => {
  it('aceita a versão vigente', () => {
    expect(
      esquemaAceitePrivacidade.safeParse({ versaoTexto: VERSAO_AVISO_PRIVACIDADE }).success,
    ).toBe(true);
  });

  it('recusa versão antiga vinda de uma aba aberta antes da troca', () => {
    expect(esquemaAceitePrivacidade.safeParse({ versaoTexto: '1.0' }).success).toBe(false);
  });
});

describe('retornoEhSeguro (doc 17 · open redirect)', () => {
  it('aceita caminho interno', () => {
    expect(retornoEhSeguro('/admin/jornadas')).toBe(true);
  });

  it('recusa URL absoluta', () => {
    expect(retornoEhSeguro('https://site-falso.example')).toBe(false);
  });

  it('recusa caminho protocolo-relativo', () => {
    expect(retornoEhSeguro('//site-falso.example')).toBe(false);
  });

  it('recusa barra invertida, que alguns navegadores tratam como barra', () => {
    expect(retornoEhSeguro('/\\site-falso.example')).toBe(false);
  });

  it('recusa vazio e ausente', () => {
    expect(retornoEhSeguro('')).toBe(false);
    expect(retornoEhSeguro(null)).toBe(false);
    expect(retornoEhSeguro(undefined)).toBe(false);
  });
});
