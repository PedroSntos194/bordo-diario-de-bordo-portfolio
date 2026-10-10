import { ErroDeLimite } from '@/lib/erros';

/**
 * Limitador de requisições em memória (RNF004).
 *
 * Janela deslizante simples, por chave. Cobre o caso que importa aqui: força
 * bruta contra o login vinda de um mesmo endereço.
 *
 * **Limitação conhecida e aceita:** o estado vive no processo. Com mais de uma
 * instância da aplicação, cada uma conta separadamente. Para 60 usuários numa
 * instância única isso basta, e a proteção durável contra força bruta é o
 * bloqueio por CPF (RN003), que vive no banco e independe disto. Se um dia
 * houver mais de uma instância, a substituição natural é mover o contador para
 * o PostgreSQL — a interface abaixo não muda.
 */

interface Janela {
  contagem: number;
  reiniciaEm: number;
}

const janelas = new Map<string, Janela>();

/** Remove janelas vencidas para o mapa não crescer indefinidamente. */
function limpar(agora: number): void {
  for (const [chave, janela] of janelas) {
    if (janela.reiniciaEm <= agora) janelas.delete(chave);
  }
}

export interface Limite {
  /** Requisições permitidas dentro da janela. */
  maximo: number;
  /** Duração da janela, em segundos. */
  janelaSegundos: number;
}

export const LIMITES = {
  /** Doc 16 — 10 tentativas por IP a cada 15 minutos. */
  login: { maximo: 10, janelaSegundos: 15 * 60 },
  mutacao: { maximo: 120, janelaSegundos: 60 },
  exportacao: { maximo: 10, janelaSegundos: 60 * 60 },
} as const satisfies Record<string, Limite>;

/**
 * Consome uma unidade do limite. Lança `ErroDeLimite` (429) quando estourar.
 *
 * Chave `null` (IP desconhecido) não é bloqueada: preferimos deixar passar a
 * barrar todo mundo por trás de um proxy mal configurado — o bloqueio por CPF
 * continua valendo nesse caso.
 */
export function consumirLimite(
  identificador: string | null,
  limite: Limite,
  agora: number = Date.now(),
): void {
  if (!identificador) return;

  limpar(agora);

  const janela = janelas.get(identificador);

  if (!janela || janela.reiniciaEm <= agora) {
    janelas.set(identificador, {
      contagem: 1,
      reiniciaEm: agora + limite.janelaSegundos * 1000,
    });
    return;
  }

  janela.contagem += 1;

  if (janela.contagem > limite.maximo) {
    const segundos = Math.max(1, Math.ceil((janela.reiniciaEm - agora) / 1000));
    throw new ErroDeLimite(segundos);
  }
}

/** Usado em teste para isolar cenários. */
export function reiniciarLimites(): void {
  janelas.clear();
}
