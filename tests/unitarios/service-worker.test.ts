import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const CODIGO_WORKER = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const ORIGEM = 'https://bordo.test';

interface EventoWorker {
  request?: { url: string; method: string; mode: string };
  respondWith: (resposta: Promise<Response>) => void;
  waitUntil: (trabalho: Promise<unknown>) => void;
}

/** Executa o worker real, isolando rede e Cache Storage sem acessar serviço algum. */
function ambienteWorker() {
  const armazenamentos = new Map<string, Map<string, Response>>();
  const ouvintes = new Map<string, (evento: EventoWorker) => void>();
  const fetch = vi.fn<(requisicao: unknown) => Promise<Response>>();
  const put = vi.fn(
    async (armazenamento: Map<string, Response>, chave: string, valor: Response) => {
      armazenamento.set(chave, valor.clone());
    },
  );
  const caches = {
    open: vi.fn(async (nome: string) => {
      let armazenamento = armazenamentos.get(nome);
      if (!armazenamento) {
        armazenamento = new Map();
        armazenamentos.set(nome, armazenamento);
      }
      const registros = armazenamento;
      return {
        put: (chave: string, valor: Response) => put(registros, chave, valor),
      };
    }),
    match: vi.fn(async (chave: string) => {
      for (const armazenamento of armazenamentos.values()) {
        const resposta = armazenamento.get(chave);
        if (resposta) return resposta.clone();
      }
      return undefined;
    }),
    keys: vi.fn(async () => [...armazenamentos.keys()]),
    delete: vi.fn(async (nome: string) => armazenamentos.delete(nome)),
  };
  const contexto = createContext({
    URL,
    Response,
    fetch,
    caches,
    self: {
      location: { origin: ORIGEM },
      addEventListener: (tipo: string, ouvinte: (evento: EventoWorker) => void) => {
        ouvintes.set(tipo, ouvinte);
      },
      clients: { claim: vi.fn(async () => undefined) },
      skipWaiting: vi.fn(async () => undefined),
    },
  });
  runInContext(CODIGO_WORKER, contexto);

  async function navegar(caminho: string): Promise<Response> {
    let pendente: Promise<Response> | undefined;
    ouvintes.get('fetch')?.({
      request: { url: `${ORIGEM}${caminho}`, method: 'GET', mode: 'navigate' },
      respondWith: (resposta) => {
        pendente = resposta;
      },
      waitUntil: () => undefined,
    });
    if (!pendente) throw new Error('O worker não respondeu à navegação.');
    return pendente;
  }

  async function ativar(): Promise<void> {
    let pendente: Promise<unknown> | undefined;
    ouvintes.get('activate')?.({
      respondWith: () => undefined,
      waitUntil: (trabalho) => {
        pendente = trabalho;
      },
    });
    if (!pendente) throw new Error('O worker não aguardou a ativação.');
    await pendente;
  }

  return { armazenamentos, caches, fetch, put, navegar, ativar };
}

describe('service worker: navegação do motorista', () => {
  it('preserva a página offline ao seguir /app para o login por sessão expirada', async () => {
    const ambiente = ambienteWorker();
    const login = new Response('<html>Login</html>', { status: 200 });
    Object.defineProperty(login, 'redirected', { value: true });
    Object.defineProperty(login, 'url', { value: `${ORIGEM}/login?retorno=%2Fapp` });
    ambiente.armazenamentos.set('bordo-v5-paginas', new Map([['/app', new Response('Meu dia')]]));
    ambiente.fetch.mockResolvedValueOnce(login).mockRejectedValueOnce(new TypeError('Sem rede'));

    expect(await (await ambiente.navegar('/app')).text()).toBe('<html>Login</html>');
    expect(ambiente.put).not.toHaveBeenCalled();
    expect(await (await ambiente.navegar('/app')).text()).toBe('Meu dia');
  });

  it('guarda a página do motorista para a abertura seguinte sem rede', async () => {
    const ambiente = ambienteWorker();
    ambiente.fetch
      .mockResolvedValueOnce(new Response('Corrida em andamento'))
      .mockRejectedValueOnce(new TypeError('Sem rede'));

    expect(await (await ambiente.navegar('/app')).text()).toBe('Corrida em andamento');
    expect(await (await ambiente.navegar('/app')).text()).toBe('Corrida em andamento');
  });

  it('devolve a resposta atual da rede quando a gravação no cache falha', async () => {
    const ambiente = ambienteWorker();
    ambiente.armazenamentos.set(
      'bordo-v5-paginas',
      new Map([['/app', new Response('Página antiga')]]),
    );
    ambiente.fetch.mockResolvedValueOnce(new Response('Página atual'));
    ambiente.put.mockRejectedValueOnce(new Error('QuotaExceededError'));

    expect(await (await ambiente.navegar('/app')).text()).toBe('Página atual');
    expect(ambiente.caches.match).not.toHaveBeenCalled();
  });

  it('descarta caches antigos que podem conter login na chave /app', async () => {
    const ambiente = ambienteWorker();
    ambiente.armazenamentos.set('bordo-v4-paginas', new Map([['/app', new Response('Login')]]));
    ambiente.armazenamentos.set('bordo-v4-estatico', new Map());
    ambiente.armazenamentos.set('bordo-v5-paginas', new Map([['/app', new Response('Meu dia')]]));

    await ambiente.ativar();

    expect([...ambiente.armazenamentos.keys()]).toEqual(['bordo-v5-paginas']);
    expect(await (await ambiente.caches.match('/app'))?.text()).toBe('Meu dia');
  });
});
