import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { chaveDeCacheGeografica } from '@/utilitarios/geo';

/**
 * Busca de endereço e geocodificação reversa (RF012, RF034).
 *
 * Executa **no servidor**, nunca no navegador. Três motivos:
 *
 * 1. A política de uso do Nominatim exige um `User-Agent` identificável, que o
 *    navegador não deixa definir;
 * 2. evita depender do CORS de um serviço de terceiros;
 * 3. permite cachear entre usuários — sessenta pessoas procurando o mesmo
 *    terminal fazem uma consulta, não sessenta.
 *
 * Falha aqui nunca é fatal: quem não achou o endereço digita a coordenada à mão
 * ou clica no mapa (RNF015).
 */

export interface LocalEncontrado {
  nome: string;
  latitude: number;
  longitude: number;
}

interface EntradaDeCache<T> {
  valor: T;
  expiraEm: number;
}

const HORAS = 60 * 60 * 1000;
const cacheDeBusca = new Map<string, EntradaDeCache<LocalEncontrado[]>>();
const cacheReverso = new Map<string, EntradaDeCache<string | null>>();

/** Endereço muda pouco; 24 h de cache é conservador e já evita quase toda repetição. */
const VALIDADE_DO_CACHE = 24 * HORAS;
const TEMPO_LIMITE_MS = 5000;

function lerCache<T>(cache: Map<string, EntradaDeCache<T>>, chave: string): T | undefined {
  const entrada = cache.get(chave);
  if (!entrada) return undefined;
  if (entrada.expiraEm <= Date.now()) {
    cache.delete(chave);
    return undefined;
  }
  return entrada.valor;
}

function gravarCache<T>(cache: Map<string, EntradaDeCache<T>>, chave: string, valor: T): void {
  // Teto simples de memória: o conjunto de endereços do cliente é pequeno.
  if (cache.size > 500) cache.clear();
  cache.set(chave, { valor, expiraEm: Date.now() + VALIDADE_DO_CACHE });
}

async function consultar(url: URL): Promise<unknown | null> {
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(url, {
      signal: controlador.signal,
      headers: {
        // Exigido pela política de uso do Nominatim.
        'User-Agent': `Bordo/1.0 (${env.APP_URL})`,
        'Accept-Language': 'pt-BR',
      },
    });

    if (!resposta.ok) {
      logger.warn('geocodificacao.resposta_invalida', { status: resposta.status });
      return null;
    }

    return await resposta.json();
  } catch (erro) {
    logger.warn('geocodificacao.indisponivel', {
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });
    return null;
  } finally {
    clearTimeout(limite);
  }
}

/** Busca por texto. Devolve lista vazia quando não encontra ou o serviço falha. */
export async function buscarEndereco(termo: string): Promise<LocalEncontrado[]> {
  const consulta = termo.trim();
  if (consulta.length < 3) return [];

  const chave = consulta.toLowerCase();
  const emCache = lerCache(cacheDeBusca, chave);
  if (emCache) return emCache;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', consulta);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'br');

  const dados = await consultar(url);
  if (!Array.isArray(dados)) return [];

  const locais = dados
    .map((item): LocalEncontrado | null => {
      const registro = item as Record<string, unknown>;
      const latitude = Number(registro.lat);
      const longitude = Number(registro.lon);
      const nome = typeof registro.display_name === 'string' ? registro.display_name : null;

      if (!nome || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { nome, latitude, longitude };
    })
    .filter((local): local is LocalEncontrado => local !== null);

  gravarCache(cacheDeBusca, chave, locais);
  return locais;
}

/** Coordenada → endereço aproximado. `null` quando indisponível. */
export async function enderecoDaCoordenada(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const chave = chaveDeCacheGeografica({ latitude, longitude });
  const emCache = lerCache(cacheReverso, chave);
  if (emCache !== undefined) return emCache;

  const url = new URL(env.GEOCODIFICACAO_URL);
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');

  const dados = await consultar(url);
  const registro = dados as Record<string, unknown> | null;
  const endereco =
    registro && typeof registro.display_name === 'string' ? registro.display_name : null;

  gravarCache(cacheReverso, chave, endereco);
  return endereco;
}
