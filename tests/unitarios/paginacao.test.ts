import { describe, expect, it } from 'vitest';
import {
  TAMANHO_MAXIMO,
  TAMANHO_PADRAO,
  lerPaginacao,
  montarPagina,
  paraIntervalo,
} from '@/lib/paginacao';

describe('lerPaginacao (RNF012)', () => {
  it('usa os valores padrão quando nada é informado', () => {
    expect(lerPaginacao({})).toEqual({ pagina: 1, tamanho: TAMANHO_PADRAO });
  });

  it('converte texto da URL em número', () => {
    expect(lerPaginacao({ pagina: '3', tamanho: '50' })).toEqual({ pagina: 3, tamanho: 50 });
  });

  it('ignora valor inválido em vez de recusar a requisição', () => {
    // `?pagina=abc` deve mostrar a primeira página, não uma tela de erro.
    expect(lerPaginacao({ pagina: 'abc' })).toEqual({ pagina: 1, tamanho: TAMANHO_PADRAO });
    expect(lerPaginacao({ pagina: '0' })).toEqual({ pagina: 1, tamanho: TAMANHO_PADRAO });
    expect(lerPaginacao({ pagina: '-5' })).toEqual({ pagina: 1, tamanho: TAMANHO_PADRAO });
  });

  it('não deixa o cliente pedir mais que o teto', () => {
    expect(lerPaginacao({ tamanho: String(TAMANHO_MAXIMO + 1) })).toEqual({
      pagina: 1,
      tamanho: TAMANHO_PADRAO,
    });
  });

  it('aceita exatamente o teto — fronteira', () => {
    expect(lerPaginacao({ tamanho: String(TAMANHO_MAXIMO) }).tamanho).toBe(TAMANHO_MAXIMO);
  });
});

describe('paraIntervalo', () => {
  it('traduz página para deslocamento', () => {
    expect(paraIntervalo({ pagina: 1, tamanho: 20 })).toEqual({ skip: 0, take: 20 });
    expect(paraIntervalo({ pagina: 3, tamanho: 20 })).toEqual({ skip: 40, take: 20 });
  });
});

describe('montarPagina', () => {
  it('calcula o total de páginas', () => {
    const resultado = montarPagina([1, 2, 3], 143, { pagina: 1, tamanho: 20 });
    expect(resultado.paginacao).toEqual({ pagina: 1, tamanho: 20, total: 143, totalPaginas: 8 });
  });

  it('devolve ao menos uma página quando não há resultados', () => {
    // Zero páginas quebraria a exibição "página 1 de 0".
    const resultado = montarPagina([], 0, { pagina: 1, tamanho: 20 });
    expect(resultado.paginacao.totalPaginas).toBe(1);
    expect(resultado.dados).toEqual([]);
  });

  it('não arredonda para baixo a última página parcial', () => {
    expect(montarPagina([], 21, { pagina: 1, tamanho: 20 }).paginacao.totalPaginas).toBe(2);
  });
});
