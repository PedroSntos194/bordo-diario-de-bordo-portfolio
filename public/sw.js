/**
 * Service worker do Bordo (US025 · RF022 · RF044).
 *
 * Ele existe por um motivo só, e é bom deixá-lo explícito: **sem service
 * worker não há modo sem conexão**. As telas do motorista são renderizadas no
 * servidor; com o sinal fora, o navegador não consegue nem carregar o HTML, e
 * toda a fila local do mundo não adiantaria porque não haveria tela para
 * alimentá-la.
 *
 * A estratégia é deliberadamente conservadora:
 *
 * - **Navegação:** rede primeiro. Registro operacional não pode ser servido de
 *   um cache velho fingindo ser o estado atual — foi essa a lição das datas da
 *   Sprint 5, em outra roupagem. Só quando a rede falha é que entra o cache, e
 *   a queda final é a tela de *modo sem conexão*, que anuncia o que é.
 * - **Estático (`/_next/static`):** cache primeiro. São arquivos com hash no
 *   nome: nunca mudam de conteúdo, e buscá-los na rede a cada carga gastaria a
 *   banda do celular do motorista à toa.
 * - **API:** nunca é cacheada. Uma resposta de `/api/*` guardada e devolvida
 *   depois seria dado errado apresentado como certo.
 *
 * Nada aqui envia coisa alguma: quem drena a fila é o aplicativo, em
 * `src/offline/sincronizador.ts`. Background Sync resolveria o caso de o
 * motorista fechar o aplicativo com a fila cheia, mas não existe no iOS — e
 * apoiar a garantia de não perder registro numa API que metade da frota não
 * tem seria pior do que não prometer.
 */

/**
 * Versão do cache. **Mudar aqui é o que descarta o cache antigo**: o
 * `activate` apaga tudo que não começa com este prefixo, e o `install`
 * remonta o casco em seguida.
 *
 * v2 — a US045 passou a guardar `/app`, o manifesto e os ícones, além da tela
 * sem conexão. Um aparelho com o cache v1 continuaria sem a tela inicial
 * guardada até alguém limpar os dados do site à mão.
 *
 * v4 — os ícones passaram a ser os da marca do Bordo. Ficam no cache
 * estático, servido antes da rede: sem trocar a versão, o app instalado
 * continuaria mostrando a van.
 *
 * v5 — descarta páginas que versões anteriores podiam sobrescrever com o
 * login ao seguir um redirecionamento de sessão expirada. A fila de registros
 * fica no IndexedDB e não é afetada por esta troca de cache.
 */
const VERSAO = 'bordo-v5';
const CACHE_ESTATICO = `${VERSAO}-estatico`;
const CACHE_PAGINAS = `${VERSAO}-paginas`;

/** A tela que precisa funcionar sem rede, custe o que custar. */
const ROTA_SEM_CONEXAO = '/app/sem-conexao';

/**
 * O casco guardado na instalação (US045 · RNF021).
 *
 * O critério pede que "a abertura seguinte não dependa de rede para exibir a
 * interface". `/app` entra junto com a tela sem conexão porque é o destino do
 * ícone na tela inicial — instalar o aplicativo e abrir num elevador sem sinal
 * não pode dar erro de navegador.
 */
const ROTAS_DO_CASCO = [ROTA_SEM_CONEXAO, '/app'];

/**
 * Guarda a tela de modo sem conexão **e os scripts de que ela depende**.
 *
 * Os pedaços do Next têm hash no nome, que muda a cada build: não dá para
 * listá-los à mão. A saída é buscar o HTML e extrair dele as URLs de script e
 * folha de estilo — que é exatamente o que o navegador faria em seguida.
 * Guardar só o HTML produziria uma tela em branco no momento em que ela é a
 * única coisa que o motorista tem.
 */
async function guardarCasco() {
  const cache = await caches.open(CACHE_PAGINAS);
  const cacheEstatico = await caches.open(CACHE_ESTATICO);
  const estaticos = new Set();

  for (const rota of ROTAS_DO_CASCO) {
    let resposta;
    try {
      resposta = await fetch(rota, { credentials: 'same-origin' });
    } catch {
      continue;
    }

    // `redirected` é a checagem que falta em quase toda implementação: sem
    // sessão, `/app` responde com um desvio para `/login`, o `fetch` o segue e
    // `ok` fica verdadeiro. Guardar isso deixaria a tela de login gravada sob a
    // chave `/app` — e o motorista veria o login para sempre, sem rede.
    if (!resposta.ok || resposta.redirected) continue;

    const html = await resposta.clone().text();
    await cache.put(rota, resposta);

    const padrao = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;
    let achado;
    while ((achado = padrao.exec(html)) !== null) estaticos.add(achado[1]);
  }

  if (estaticos.size === 0) return;

  // `addAll` é tudo ou nada; um pedaço indisponível não pode impedir os outros
  // de serem guardados.
  await Promise.all(
    [...estaticos].map((url) =>
      fetch(url)
        .then((r) => (r.ok ? cacheEstatico.put(url, r) : undefined))
        .catch(() => undefined),
    ),
  );

  // Ícones e manifesto: o que o sistema operacional pede na tela de abertura do
  // aplicativo instalado, e que não pode depender de rede (US045).
  await Promise.all(
    ['/manifest.webmanifest', '/icons/icone-192.png', '/icons/icone-512.png'].map((url) =>
      fetch(url)
        .then((r) => (r.ok ? cacheEstatico.put(url, r) : undefined))
        .catch(() => undefined),
    ),
  );
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    guardarCasco()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves.filter((chave) => !chave.startsWith(VERSAO)).map((chave) => caches.delete(chave)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Mantém o casco em dia sempre que o aplicativo pedir. */
self.addEventListener('message', (evento) => {
  if (evento.data === 'atualizar-tela-sem-conexao') {
    evento.waitUntil(guardarCasco().catch(() => undefined));
  }
});

function ehEstatico(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
}

async function responderNavegacao(requisicao) {
  let resposta;
  try {
    resposta = await fetch(requisicao);
  } catch {
    const url = new URL(requisicao.url);

    const doCache = await caches.match(url.pathname);
    if (doCache) return doCache;

    const semConexao = await caches.match(ROTA_SEM_CONEXAO);
    if (semConexao) return semConexao;

    // Última linha: nem a tela de modo sem conexão foi guardada. Melhor uma
    // página honesta do que o erro do navegador, que o motorista lê como
    // "o sistema quebrou".
    return new Response(
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Sem conexão · Bordo</title></head><body style="font-family:system-ui;padding:2rem">' +
        '<h1>Sem conexão</h1><p>Não foi possível carregar esta tela. ' +
        'Abra o aplicativo uma vez com internet para que ele funcione offline depois.</p>' +
        '</body></html>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }

  // Só páginas do motorista entram no cache. As telas administrativas não
  // fazem sentido sem rede, e guardá-las levaria dado da frota inteira para
  // o disco de um celular (RN029). Como no casco, um desvio para o login não
  // pode substituir a página guardada sob a chave original de `/app`.
  const url = new URL(requisicao.url);
  if (resposta.ok && !resposta.redirected && url.pathname.startsWith('/app')) {
    try {
      const cache = await caches.open(CACHE_PAGINAS);
      await cache.put(url.pathname, resposta.clone());
    } catch {
      // Falta de espaço ou cache indisponível não é falha de rede: a página
      // atual já chegou e deve continuar sendo exibida.
    }
  }

  return resposta;
}

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;

  if (requisicao.method !== 'GET') return;

  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return;

  // Recarga a quente do desenvolvimento e sondagens do Next passam direto.
  if (url.pathname.includes('hot-update') || url.pathname.startsWith('/_next/webpack')) return;

  // Resposta de API nunca é guardada nem servida do cache.
  if (url.pathname.startsWith('/api/')) return;

  if (requisicao.mode === 'navigate') {
    evento.respondWith(responderNavegacao(requisicao));
    return;
  }

  if (ehEstatico(url)) {
    evento.respondWith(
      caches.match(requisicao).then(
        (guardado) =>
          guardado ??
          fetch(requisicao).then((resposta) => {
            if (resposta.ok) {
              const copia = resposta.clone();
              void caches.open(CACHE_ESTATICO).then((cache) => cache.put(requisicao, copia));
            }
            return resposta;
          }),
      ),
    );
  }
});
