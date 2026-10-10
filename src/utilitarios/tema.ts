/**
 * Tema da tela: escuro, claro ou o mesmo do aparelho.
 *
 * A escolha fica num cookie, e não só no navegador, porque o servidor precisa
 * dela para desenhar a página já no tema certo — sem isso a tela piscaria do
 * escuro para o claro a cada abertura.
 *
 * O padrão continua **escuro**: foi assim que o sistema estreou, e ninguém deve encontrar a tela diferente sem ter
 * escolhido. O claro existe para quem dirige no sol, onde a tela escura reflete
 * mais e se lê pior.
 */

export const TEMAS = ['escuro', 'claro', 'sistema'] as const;
export type Tema = (typeof TEMAS)[number];

export const COOKIE_DO_TEMA = 'bordo_tema';
export const TEMA_PADRAO: Tema = 'escuro';

export const ROTULO_DO_TEMA: Record<Tema, string> = {
  escuro: 'Escura',
  claro: 'Clara',
  sistema: 'Igual ao celular',
};

/** Cor da barra do navegador e do sistema, igual ao `--color-fundo` de cada tema. */
export const COR_DA_BARRA = { escuro: '#0f1115', claro: '#ffffff' } as const;

export function lerTema(valor: string | null | undefined): Tema {
  return (TEMAS as readonly string[]).includes(valor ?? '') ? (valor as Tema) : TEMA_PADRAO;
}
