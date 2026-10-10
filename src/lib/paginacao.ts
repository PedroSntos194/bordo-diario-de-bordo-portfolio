import { z } from 'zod';

/**
 * Paginação (RNF012).
 *
 * Nenhum endpoint de listagem pode devolver coleção inteira: com 60 usuários
 * isso passa despercebido, com 12 meses de corridas derruba a tela. O limite é
 * aplicado aqui, uma vez, e não na disciplina de cada consulta.
 */

export const TAMANHO_PADRAO = 20;
export const TAMANHO_MAXIMO = 100;

export const esquemaPaginacao = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamanho: z.coerce.number().int().min(1).max(TAMANHO_MAXIMO).default(TAMANHO_PADRAO),
});

export type Paginacao = z.infer<typeof esquemaPaginacao>;

export interface DadosPaginados<T> {
  dados: T[];
  paginacao: {
    pagina: number;
    tamanho: number;
    total: number;
    totalPaginas: number;
  };
}

/** Converte página/tamanho em `skip`/`take` para o Prisma. */
export function paraIntervalo(paginacao: Paginacao): { skip: number; take: number } {
  return {
    skip: (paginacao.pagina - 1) * paginacao.tamanho,
    take: paginacao.tamanho,
  };
}

export function montarPagina<T>(
  dados: T[],
  total: number,
  paginacao: Paginacao,
): DadosPaginados<T> {
  return {
    dados,
    paginacao: {
      pagina: paginacao.pagina,
      tamanho: paginacao.tamanho,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / paginacao.tamanho)),
    },
  };
}

/**
 * Lê a paginação dos parâmetros da URL, ignorando valores inválidos em vez de
 * recusar a requisição: `?pagina=abc` deve mostrar a primeira página, não uma
 * tela de erro.
 */
export function lerPaginacao(parametros: Record<string, string | undefined>): Paginacao {
  const analise = esquemaPaginacao.safeParse({
    pagina: parametros.pagina,
    tamanho: parametros.tamanho,
  });

  return analise.success ? analise.data : { pagina: 1, tamanho: TAMANHO_PADRAO };
}
