import { describe, expect, it } from 'vitest';
import {
  chaveDoErro,
  descreverTela,
  ehRuidoDeErro,
  encurtar,
  montarMensagemDeSuporte,
  normalizarMensagemDeErro,
} from '@/modulos/suporte/suporte.regras';
import { lerTema } from '@/utilitarios/tema';

/** "Algo deu errado?" e erros relatados pelo aparelho (suporte ao piloto). */

describe('descreverTela', () => {
  it('traduz o caminho para o nome que o motorista vê', () => {
    expect(descreverTela('/app')).toBe('Meu dia');
    expect(descreverTela('/app/jornada/abrir')).toBe('Iniciar meu dia');
    expect(descreverTela('/app/corrida/3f2a/encerrar')).toBe('Encerrar corrida');
    expect(descreverTela('/app/corrida/3f2a')).toBe('Corrida');
    expect(descreverTela('/admin/escala')).toBe('Área do administrador');
  });

  it('sem correspondência, devolve o caminho', () => {
    expect(descreverTela('/qualquer')).toBe('/qualquer');
  });
});

describe('montarMensagemDeSuporte', () => {
  const BASE = {
    nome: 'Rafael Costa',
    caminho: '/app/corrida/abc',
    // 05:14 em São Paulo.
    instante: new Date('2026-10-02T08:14:00Z'),
    online: false,
    pendentes: 2,
    localizacao: 'negada' as const,
    versao: '28da525',
  };

  it('leva o que quem atende precisa perguntar primeiro', () => {
    const texto = montarMensagemDeSuporte(BASE);

    expect(texto).toContain('Aqui é Rafael Costa');
    expect(texto).toContain('Tela: Corrida');
    expect(texto).toContain('Horário: 02/10/2026 05:14');
    expect(texto).toContain('Internet: sem sinal');
    expect(texto).toContain('Registros esperando envio: 2');
    expect(texto).toContain('Localização: bloqueada no celular');
    expect(texto).toContain('Versão: 28da525');
  });

  it('termina pedindo o relato do motorista', () => {
    expect(montarMensagemDeSuporte(BASE).endsWith('O que aconteceu: ')).toBe(true);
  });

  it('omite o que não deu para ler', () => {
    const texto = montarMensagemDeSuporte({ ...BASE, pendentes: null, versao: null });
    expect(texto).not.toContain('Registros esperando envio');
    expect(texto).not.toContain('Versão');
  });
});

describe('ehRuidoDeErro', () => {
  const SITE = 'https://bordo.exemplo.com.br';

  it('descarta o que não é do sistema', () => {
    expect(ehRuidoDeErro({ mensagem: 'Script error.', origemDoSite: SITE })).toBe(true);
    expect(
      ehRuidoDeErro({
        mensagem: 'ResizeObserver loop completed with undelivered notifications.',
        origemDoSite: SITE,
      }),
    ).toBe(true);
    expect(
      ehRuidoDeErro({
        mensagem: 'x is undefined',
        arquivo: 'chrome-extension://abc/content.js',
        origemDoSite: SITE,
      }),
    ).toBe(true);
    expect(
      ehRuidoDeErro({
        mensagem: 'x is undefined',
        arquivo: 'https://outro-site.com/a.js',
        origemDoSite: SITE,
      }),
    ).toBe(true);
  });

  it('descarta falha de rede: sinal fraco não é defeito', () => {
    expect(ehRuidoDeErro({ mensagem: 'Failed to fetch', origemDoSite: SITE })).toBe(true);
    expect(ehRuidoDeErro({ mensagem: 'Load failed', origemDoSite: SITE })).toBe(true);
  });

  it('mantém o erro do próprio sistema', () => {
    expect(
      ehRuidoDeErro({
        mensagem: "Cannot read properties of undefined (reading 'placa')",
        arquivo: `${SITE}/_next/static/chunks/app.js`,
        origemDoSite: SITE,
      }),
    ).toBe(false);
    expect(ehRuidoDeErro({ mensagem: 'Algo quebrou', origemDoSite: SITE })).toBe(false);
  });
});

describe('chaveDoErro', () => {
  it('o mesmo defeito com identificadores diferentes dá a mesma chave', () => {
    const um = chaveDoErro(
      '2026-10-02',
      'Corrida 3f2a1c4e-0000-4000-8000-000000000001 não encontrada',
    );
    const outro = chaveDoErro(
      '2026-10-02',
      'Corrida 9b1c2d3e-0000-4000-8000-000000000002 não encontrada',
    );
    expect(um).toBe(outro);
  });

  it('muda de um dia para o outro: um aviso por defeito por dia', () => {
    expect(chaveDoErro('2026-10-02', 'Algo quebrou')).not.toBe(
      chaveDoErro('2026-10-03', 'Algo quebrou'),
    );
  });

  it('cabe na coluna de referência (60 caracteres)', () => {
    expect(chaveDoErro('2026-10-02', 'x'.repeat(500)).length).toBeLessThanOrEqual(60);
  });
});

describe('normalizarMensagemDeErro e encurtar', () => {
  it('troca números por # e junta espaços', () => {
    expect(normalizarMensagemDeErro('  Linha 42,   coluna 7 ')).toBe('Linha #, coluna #');
  });

  it('encurta com reticências só quando passa do limite', () => {
    expect(encurtar('abc', 5)).toBe('abc');
    expect(encurtar('abcdefgh', 5)).toBe('abcd…');
  });
});

describe('lerTema', () => {
  it('aceita só os três temas e cai no escuro de sempre', () => {
    expect(lerTema('claro')).toBe('claro');
    expect(lerTema('sistema')).toBe('sistema');
    expect(lerTema('escuro')).toBe('escuro');
    // Quem nunca escolheu continua vendo a tela como no lançamento.
    expect(lerTema(undefined)).toBe('escuro');
    expect(lerTema('roxo')).toBe('escuro');
  });
});
