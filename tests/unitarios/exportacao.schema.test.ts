import { describe, expect, it } from 'vitest';
import { esquemaExportar } from '@/modulos/exportacao/exportacao.schema';

/**
 * US032 — "a exportação respeita exatamente os filtros aplicados na tela".
 *
 * A garantia é estrutural: o esquema da exportação reaproveita os mesmos campos
 * de filtro da listagem (`FILTROS_DE_JORNADA`, `FILTROS_DE_CORRIDA`). Estes
 * testes travam essa reutilização — se alguém duplicar os filtros em vez de
 * reusá-los, os limites abaixo param de valer juntos.
 */
describe('esquemaExportar', () => {
  it('aceita uma exportação de jornadas com o período da tela', () => {
    const analise = esquemaExportar.safeParse({
      tipo: 'JORNADAS',
      filtros: { dataInicio: '2026-08-01', dataFim: '2026-08-31', status: 'ENCERRADA' },
    });

    expect(analise.success).toBe(true);
  });

  it('herda o limite de 12 meses da listagem', () => {
    const analise = esquemaExportar.safeParse({
      tipo: 'JORNADAS',
      filtros: { dataInicio: '2024-01-01', dataFim: '2026-08-31' },
    });

    expect(analise.success).toBe(false);
  });

  it('herda a recusa de período invertido', () => {
    const analise = esquemaExportar.safeParse({
      tipo: 'CORRIDAS',
      filtros: { dataInicio: '2026-08-31', dataFim: '2026-08-01' },
    });

    expect(analise.success).toBe(false);
  });

  it('recusa filtro que não pertence ao relatório', () => {
    // `rotaId` existe em corridas, não em jornadas. Sem a união discriminada o
    // valor seria aceito e ignorado em silêncio — e a aba de identificação
    // anunciaria um filtro que não foi aplicado.
    const analise = esquemaExportar.safeParse({
      tipo: 'JORNADAS',
      filtros: { rotaId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
    });

    expect(analise.success).toBe(false);
  });

  it('aceita o mesmo filtro no relatório a que ele pertence', () => {
    const analise = esquemaExportar.safeParse({
      tipo: 'CORRIDAS',
      filtros: { rotaId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
    });

    expect(analise.success).toBe(true);
  });

  it('exporta o dia corrente quando o resumo vem sem data', () => {
    const analise = esquemaExportar.safeParse({ tipo: 'RESUMO_DIA', filtros: {} });

    expect(analise.success).toBe(true);
    if (analise.success && analise.data.tipo === 'RESUMO_DIA') {
      expect(analise.data.filtros.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('preserva o motorista escolhido no diário exportado', () => {
    const filtros = { data: '2026-10-07', motoristaId: '10000000-0000-4000-8000-000000000001' };
    expect(esquemaExportar.parse({ tipo: 'RESUMO_DIA', filtros })).toEqual({
      tipo: 'RESUMO_DIA',
      filtros,
    });
  });

  it('recusa motorista inválido ou filtro de outro relatório no diário', () => {
    expect(
      esquemaExportar.safeParse({ tipo: 'RESUMO_DIA', filtros: { motoristaId: 'invalido' } })
        .success,
    ).toBe(false);
    expect(
      esquemaExportar.safeParse({
        tipo: 'RESUMO_DIA',
        filtros: { veiculoId: '10000000-0000-4000-8000-000000000001' },
      }).success,
    ).toBe(false);
  });

  it('recusa um tipo de relatório desconhecido', () => {
    expect(esquemaExportar.safeParse({ tipo: 'FOLHA_DE_PONTO', filtros: {} }).success).toBe(false);
  });
});
