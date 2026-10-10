import {
  LIMITE_DE_RELATOS_POR_PAGINA,
  ehRuidoDeErro,
  encurtar,
} from '@/modulos/suporte/suporte.regras';

/**
 * Envio do erro relatado pelo aparelho — só no navegador.
 *
 * Cada mensagem vai uma vez por página, e no máximo
 * `LIMITE_DE_RELATOS_POR_PAGINA`: um erro dentro de um laço de renderização
 * dispararia centenas de vezes por segundo. Falhar ao relatar nunca vira outro
 * erro — sem rede, o relato simplesmente se perde.
 */

let versaoAtual: string | null = null;
let relatados = 0;
const jaRelatados = new Set<string>();

export function definirVersaoDoRelato(versao: string | null): void {
  versaoAtual = versao;
}

function mensagemDe(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === 'string') return erro;
  try {
    return JSON.stringify(erro) ?? String(erro);
  } catch {
    return String(erro);
  }
}

export function relatarErro(erro: unknown, arquivo?: string | null): void {
  if (typeof window === 'undefined') return;

  const mensagem = mensagemDe(erro);
  if (ehRuidoDeErro({ mensagem, arquivo, origemDoSite: window.location.origin })) return;
  if (relatados >= LIMITE_DE_RELATOS_POR_PAGINA || jaRelatados.has(mensagem)) return;

  jaRelatados.add(mensagem);
  relatados += 1;

  const pilha = erro instanceof Error && erro.stack ? encurtar(erro.stack, 4000) : undefined;

  void fetch('/api/erros-cliente', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    // Sobrevive à troca de página: o erro que leva o motorista a sair da tela
    // é justamente o que mais interessa.
    keepalive: true,
    body: JSON.stringify({
      mensagem: encurtar(mensagem, 500),
      ...(pilha ? { pilha } : {}),
      caminho: encurtar(window.location.pathname, 200),
      navegador: encurtar(navigator.userAgent, 300),
      ...(versaoAtual ? { versao: versaoAtual } : {}),
      online: navigator.onLine,
    }),
  }).catch(() => undefined);
}
