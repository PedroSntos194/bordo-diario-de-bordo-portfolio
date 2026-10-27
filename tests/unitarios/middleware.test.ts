import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';

const ORIGEM = 'https://bordo.test';
const ARQUIVOS_PUBLICOS = ['/sw.js'];

describe('middleware: acesso antes do login', () => {
  it('recebe visitantes na apresentação e preserva o encaminhamento de quem tem sessão', () => {
    const visitante = middleware(new NextRequest(`${ORIGEM}/`));
    expect(visitante.status).toBe(307);
    expect(visitante.headers.get('location')).toBe(`${ORIGEM}/apresentacao`);
    expect(visitante.headers.get('content-security-policy')).toContain("default-src 'self'");

    const comSessao = middleware(
      new NextRequest(`${ORIGEM}/`, { headers: { cookie: 'bordo_sessao=exemplo' } }),
    );
    expect(comSessao.headers.get('x-middleware-next')).toBe('1');
    expect(comSessao.headers.get('location')).toBeNull();
  });

  it.each(['/apresentacao', '/apresentacao/admin-painel.png'])(
    'abre a apresentação %s sem sessão e mantém a CSP',
    (caminho) => {
      const resposta = middleware(new NextRequest(`${ORIGEM}${caminho}`));

      expect(resposta.headers.get('x-middleware-next')).toBe('1');
      expect(resposta.headers.get('location')).toBeNull();
      expect(resposta.headers.get('content-security-policy')).toContain(
        "script-src 'self' 'nonce-",
      );
    },
  );

  it('abre a ajuda de acesso sem sessão, com a política para os scripts da tela', () => {
    const resposta = middleware(new NextRequest(`${ORIGEM}/ajuda-acesso`));

    expect(resposta.headers.get('x-middleware-next')).toBe('1');
    expect(resposta.headers.get('location')).toBeNull();
    expect(resposta.headers.get('content-security-policy')).toContain("script-src 'self' 'nonce-");
  });

  it.each(ARQUIVOS_PUBLICOS)('libera %s sem cookie de sessão', (caminho) => {
    const resposta = middleware(new NextRequest(`${ORIGEM}${caminho}`));

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('x-middleware-next')).toBe('1');
    expect(resposta.headers.get('location')).toBeNull();
  });

  it('libera a atualização do worker com parâmetros e a consulta HEAD dos guias', () => {
    for (const caminho of ARQUIVOS_PUBLICOS) {
      const resposta = middleware(
        new NextRequest(`${ORIGEM}${caminho}?versao=2026`, { method: 'HEAD' }),
      );

      expect(resposta.headers.get('x-middleware-next')).toBe('1');
      expect(resposta.headers.get('location')).toBeNull();
    }
  });

  it.each([
    '/app',
    '/apresentacao-privada',
    '/admin/usuarios',
    '/admin/motoristas',
    '/admin/ajuda',
    '/app/aprender',
    '/ajuda-acesso/privado',
    '/guias',
    '/guias/relatorio.pdf',
    '/guias/guia-motoristas-bordo.pdf',
    '/guias/guia-motoristas-bordo.pdf/privado',
    '/guias/guia-motoristas-bordo.pdf.bak',
    '/sw.js/privado',
    '/sw.js.bak',
  ])('mantém o redirecionamento de %s sem sessão', (caminho) => {
    const resposta = middleware(new NextRequest(`${ORIGEM}${caminho}`));
    const destino = new URL(resposta.headers.get('location') ?? '');

    expect(resposta.status).toBe(307);
    expect(destino.origin).toBe(ORIGEM);
    expect(destino.pathname).toBe('/login');
    expect(destino.searchParams.get('retorno')).toBe(caminho);
    expect(resposta.headers.get('content-security-policy')).toContain("default-src 'self'");
  });

  it.each(['/api/jornadas', '/api/sw.js', '/api/guias/guia-motoristas-bordo.pdf'])(
    'mantém o 401 de %s sem sessão',
    async (caminho) => {
      const resposta = middleware(new NextRequest(`${ORIGEM}${caminho}`));

      expect(resposta.status).toBe(401);
      expect(resposta.headers.get('location')).toBeNull();
      expect(await resposta.json()).toEqual({
        erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Faça login para continuar.' },
      });
      expect(resposta.headers.get('content-security-policy')).toContain("default-src 'self'");
    },
  );
});
