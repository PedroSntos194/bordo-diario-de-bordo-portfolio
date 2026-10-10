import { Prisma } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';

/**
 * Agregação de corridas por dimensão (US031 · RF031 · RN008).
 *
 * **SQL bruto, e de propósito.** O `groupBy` do Prisma só agrupa por colunas da
 * própria tabela, e as dimensões que interessam — motorista e veículo — vivem
 * na jornada. As alternativas seriam trazer todas as corridas do período para a
 * aplicação e somar em JavaScript (um ano de operação são dezenas de milhares
 * de linhas viajando à toa) ou criar colunas redundantes na corrida.
 *
 * Agregar no banco mantém a resposta em milissegundos independentemente do
 * volume — é o que dispensa o processamento em segundo plano previsto para o
 * relatório: não há 5.000 linhas para exibir, há no máximo uma por motorista.
 */

export type Agrupamento = 'motorista' | 'veiculo' | 'rota';

export interface LinhaDoRelatorio {
  chave: string;
  rotulo: string;
  detalhe: string | null;
  corridas: number;
  kmTotal: number;
  duracaoMinutos: number;
  passageiros: number;
  diasComOperacao: number;
}

/**
 * As três consultas são escritas por extenso, e não montadas por concatenação.
 *
 * Interpolar nome de tabela ou de coluna numa string é o caminho mais curto
 * para injeção de SQL (doc 17). O agrupamento é um valor fechado, então três
 * consultas fixas custam algumas linhas a mais e eliminam a classe inteira de
 * problema.
 */
export async function agregarPorDimensao(
  cliente: ClientePrisma,
  agrupamento: Agrupamento,
  dataInicio: Date,
  dataFim: Date,
): Promise<LinhaDoRelatorio[]> {
  if (agrupamento === 'motorista') {
    return cliente.$queryRaw<LinhaDoRelatorio[]>`
      SELECT
        u.id::text                                        AS "chave",
        u.nome                                            AS "rotulo",
        NULL::text                                        AS "detalhe",
        COUNT(c.id)::int                                  AS "corridas",
        COALESCE(SUM(c.km_percorrido), 0)::float          AS "kmTotal",
        COALESCE(SUM(c.duracao_minutos), 0)::int          AS "duracaoMinutos",
        COALESCE(SUM(c.quantidade_passageiros), 0)::int   AS "passageiros",
        COUNT(DISTINCT j.data)::int                       AS "diasComOperacao"
      FROM corrida c
      JOIN jornada j ON j.id = c.jornada_id
      JOIN usuario u ON u.id = j.motorista_id
      WHERE c.status = 'ENCERRADA' AND j.data BETWEEN ${dataInicio} AND ${dataFim}
      GROUP BY u.id, u.nome
      ORDER BY "kmTotal" DESC`;
  }

  if (agrupamento === 'veiculo') {
    return cliente.$queryRaw<LinhaDoRelatorio[]>`
      SELECT
        v.id::text                                        AS "chave",
        v.placa                                           AS "rotulo",
        v.modelo                                          AS "detalhe",
        COUNT(c.id)::int                                  AS "corridas",
        COALESCE(SUM(c.km_percorrido), 0)::float          AS "kmTotal",
        COALESCE(SUM(c.duracao_minutos), 0)::int          AS "duracaoMinutos",
        COALESCE(SUM(c.quantidade_passageiros), 0)::int   AS "passageiros",
        COUNT(DISTINCT j.data)::int                       AS "diasComOperacao"
      FROM corrida c
      JOIN jornada j ON j.id = c.jornada_id
      JOIN veiculo v ON v.id = j.veiculo_id
      WHERE c.status = 'ENCERRADA' AND j.data BETWEEN ${dataInicio} AND ${dataFim}
      GROUP BY v.id, v.placa, v.modelo
      ORDER BY "kmTotal" DESC`;
  }

  /**
   * Rota tem um caso que os outros dois não têm: **corrida avulsa**, sem rota
   * cadastrada. `LEFT JOIN` com rótulo de reserva mantém esse km no relatório —
   * excluí-lo faria a soma por rota não bater com o total da frota, e alguém
   * gastaria uma tarde procurando o erro.
   */
  return cliente.$queryRaw<LinhaDoRelatorio[]>`
    SELECT
      COALESCE(r.id::text, 'avulsa')                    AS "chave",
      COALESCE(r.nome, 'Corridas avulsas')              AS "rotulo",
      r.codigo                                          AS "detalhe",
      COUNT(c.id)::int                                  AS "corridas",
      COALESCE(SUM(c.km_percorrido), 0)::float          AS "kmTotal",
      COALESCE(SUM(c.duracao_minutos), 0)::int          AS "duracaoMinutos",
      COALESCE(SUM(c.quantidade_passageiros), 0)::int   AS "passageiros",
      COUNT(DISTINCT j.data)::int                       AS "diasComOperacao"
    FROM corrida c
    JOIN jornada j ON j.id = c.jornada_id
    LEFT JOIN rota r ON r.id = c.rota_id
    WHERE c.status = 'ENCERRADA' AND j.data BETWEEN ${dataInicio} AND ${dataFim}
    GROUP BY r.id, r.nome, r.codigo
    ORDER BY "kmTotal" DESC`;
}

/** Totais da frota no período, para a linha de fechamento do relatório. */
export async function totaisDoPeriodo(
  cliente: ClientePrisma,
  dataInicio: Date,
  dataFim: Date,
): Promise<{
  corridas: number;
  kmTotal: number;
  duracaoMinutos: number;
  passageiros: number;
  diasComOperacao: number;
}> {
  const linhas = await cliente.$queryRaw<
    {
      corridas: number;
      kmTotal: number;
      duracaoMinutos: number;
      passageiros: number;
      diasComOperacao: number;
    }[]
  >(Prisma.sql`
    SELECT
      COUNT(c.id)::int                                  AS "corridas",
      COALESCE(SUM(c.km_percorrido), 0)::float          AS "kmTotal",
      COALESCE(SUM(c.duracao_minutos), 0)::int          AS "duracaoMinutos",
      COALESCE(SUM(c.quantidade_passageiros), 0)::int   AS "passageiros",
      COUNT(DISTINCT j.data)::int                       AS "diasComOperacao"
    FROM corrida c
    JOIN jornada j ON j.id = c.jornada_id
    WHERE c.status = 'ENCERRADA' AND j.data BETWEEN ${dataInicio} AND ${dataFim}`);

  return (
    linhas[0] ?? {
      corridas: 0,
      kmTotal: 0,
      duracaoMinutos: 0,
      passageiros: 0,
      diasComOperacao: 0,
    }
  );
}
