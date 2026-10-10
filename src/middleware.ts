import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proteção de rota e Content Security Policy (doc 13 · RF041 · RNF003).
 *
 * O middleware roda no Edge Runtime, **sem acesso ao banco**: aqui só é possível
 * verificar a presença do cookie de sessão. A validação real — sessão existente,
 * não expirada, usuário ativo, perfil correto — acontece no servidor, nos
 * layouts e nas ações (`exigirPerfil`, `exigirEscopoDoRegistro`).
 *
 * Essa divisão é intencional e não é um enfraquecimento: quem tiver um cookie
 * inválido passa por aqui e é barrado logo em seguida, com 401 ou 403. O ganho
 * é evitar renderizar a árvore inteira para quem sequer tem sessão.
 *
 * ---
 *
 * A **CSP é montada aqui, e não em `next.config.ts`**, por um motivo concreto:
 * ela precisa de um `nonce` novo a cada requisição, e cabeçalho estático não
 * tem como gerar isso.
 *
 * A primeira versão usava `script-src 'self'` fixo. Isso bloqueava os scripts
 * inline que o Next injeta para hidratar o React — a página era renderizada
 * pelo servidor e aparecia normalmente, mas **nenhum botão do sistema
 * funcionava**. É uma falha silenciosa: não há erro na tela, só uma interface
 * inerte. O nonce resolve sem precisar liberar `'unsafe-inline'`, que anularia
 * boa parte da proteção contra XSS.
 */

const NOME_COOKIE_SESSAO = 'bordo_sessao';

/**
 * Rotas que dispensam **cookie de sessão**.
 *
 * "Pública" aqui significa "não exige sessão de usuário", não "aberta". O caso
 * que deixa isso claro é `/api/cron`: quem a chama é o cron da hospedagem, que
 * não tem sessão nenhuma — e ela é protegida por um segredo em
 * `Authorization: Bearer`, conferido em tempo constante pelo próprio handler
 * (ver `app/api/cron/route.ts`).
 *
 * Deixá-la fora desta lista fazia o middleware responder 401 antes de o
 * handler existir, e o cron nunca rodaria. Descoberto chamando a URL — não
 * aparece em teste unitário nem no build.
 */
const ROTAS_PUBLICAS = ['/login', '/api/auth/login', '/api/health', '/api/cron'];

/** Arquivos e rotas internas que o middleware não deve interceptar. */
const PREFIXOS_IGNORADOS = ['/_next', '/favicon.ico', '/icons', '/manifest.webmanifest'];

/** Arquivos estáticos necessários à instalação antes do login. */
const ARQUIVOS_PUBLICOS = new Set(['/sw.js']);

function gerarNonce(): string {
  // `Buffer` não existe no Edge Runtime; `btoa` e `crypto` existem.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function montarPolitica(nonce: string, emDesenvolvimento: boolean): string {
  return [
    "default-src 'self'",
    // `strict-dynamic` faz os scripts carregados pelos scripts com nonce serem
    // confiados por herança — é o que permite ao Next buscar seus próprios
    // pedaços sem liberar host algum.
    // Em desenvolvimento o `unsafe-eval` é inevitável: a recarga a quente do
    // Next avalia código dinamicamente. Ele não vai para produção.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${emDesenvolvimento ? " 'unsafe-eval'" : ''}`,
    // O Next inlineia estilos críticos; não há nonce para eles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    // Os tiles do mapa precisam estar **aqui**, não só em `img-src`.
    //
    // O MapLibre não usa `<img>`: ele busca cada tile pela Fetch API para poder
    // manipular o bitmap. Quem governa isso é `connect-src`. Liberar o host
    // apenas em `img-src` faz o mapa subir, desenhar marcadores e ficar com o
    // fundo cinza — falha silenciosa, do mesmo tipo que a CSP da Sprint 0
    // produziu ao bloquear a hidratação.
    `connect-src 'self' https://nominatim.openstreetmap.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org${emDesenvolvimento ? ' ws: wss:' : ''}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // O MapLibre instancia workers a partir de blob:.
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
  ].join('; ');
}

export function middleware(requisicao: NextRequest): NextResponse {
  const { pathname } = requisicao.nextUrl;

  if (
    ARQUIVOS_PUBLICOS.has(pathname) ||
    PREFIXOS_IGNORADOS.some((prefixo) => pathname.startsWith(prefixo))
  ) {
    return NextResponse.next();
  }

  const nonce = gerarNonce();
  const politica = montarPolitica(nonce, process.env.NODE_ENV === 'development');

  /**
   * O nonce viaja em dois lugares: no cabeçalho da **requisição**, de onde o
   * Next o lê para carimbar as próprias tags `<script>`, e no cabeçalho da
   * **resposta**, que é o que o navegador aplica. Faltando um dos dois, a
   * página volta a ficar inerte.
   */
  const cabecalhos = new Headers(requisicao.headers);
  cabecalhos.set('x-nonce', nonce);
  cabecalhos.set('content-security-policy', politica);

  const comPolitica = (resposta: NextResponse): NextResponse => {
    resposta.headers.set('content-security-policy', politica);
    return resposta;
  };

  const seguir = (): NextResponse =>
    comPolitica(NextResponse.next({ request: { headers: cabecalhos } }));

  const temSessao = Boolean(requisicao.cookies.get(NOME_COOKIE_SESSAO)?.value);
  const ehRotaPublica =
    ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`)) ||
    pathname === '/ajuda-acesso';

  if (ehRotaPublica) {
    // Quem já tem sessão válida sai do login pela própria página, que confere
    // no banco. Aqui não dá: o middleware só vê que o cookie **existe**. Com a
    // sessão vencida ou encerrada, mandar o login para `/` fazia `/` devolver
    // para o login, e o navegador desistia com "redirecionamentos demais" —
    // qualquer um cuja sessão vencesse ficava sem conseguir entrar.
    return seguir();
  }

  if (!temSessao) {
    // Rotas de API respondem 401; telas redirecionam preservando o destino.
    if (pathname.startsWith('/api/')) {
      return comPolitica(
        NextResponse.json(
          { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Faça login para continuar.' } },
          { status: 401 },
        ),
      );
    }

    const destino = new URL('/login', requisicao.url);
    // Apenas caminhos internos, para não virar open redirect (doc 17).
    if (pathname.startsWith('/') && !pathname.startsWith('//')) {
      destino.searchParams.set('retorno', pathname);
    }
    return comPolitica(NextResponse.redirect(destino));
  }

  return seguir();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
