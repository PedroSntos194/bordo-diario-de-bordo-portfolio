import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { aplicarMensagensEmPortugues } from '@/lib/validacao';
import {
  esquemaDia,
  esquemaResumoDoDia,
  esquemaListarCorridas,
  esquemaListarJornadas,
} from '@/modulos/relatorio/relatorio.schema';
import { dataOperacional } from '@/utilitarios/data';

beforeAll(() => aplicarMensagensEmPortugues());

function erros(resultado: z.SafeParseReturnType<unknown, unknown>): Record<string, string> {
  if (resultado.success) return {};
  const campos: Record<string, string> = {};
  for (const problema of resultado.error.issues) {
    campos[problema.path.join('.') || 'geral'] ??= problema.message;
  }
  return campos;
}

describe('esquemaDia (US026, US030)', () => {
  it('usa o dia de hoje quando nada é informado', () => {
    const resultado = esquemaDia.safeParse({});

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.data).toBe(dataOperacional());
  });

  it('aceita uma data explícita', () => {
    const resultado = esquemaDia.safeParse({ data: '2026-08-01' });
    if (resultado.success) expect(resultado.data.data).toBe('2026-08-01');
  });

  it('recusa formato inválido', () => {
    expect(erros(esquemaDia.safeParse({ data: '01/08/2026' })).data).toBe('Data inválida.');
  });
});

describe('esquemaResumoDoDia', () => {
  it('aceita consultar um motorista numa data histórica', () => {
    const entrada = { data: '2026-08-01', motoristaId: '10000000-0000-4000-8000-000000000001' };
    expect(esquemaResumoDoDia.parse(entrada)).toEqual(entrada);
  });

  it('recusa um identificador de motorista inválido e datas inexistentes', () => {
    expect(esquemaResumoDoDia.safeParse({ motoristaId: 'qualquer-pessoa' }).success).toBe(false);
    expect(esquemaResumoDoDia.safeParse({ data: '2026-02-30' }).success).toBe(false);
  });

  it('mantém a consulta da frota quando nenhum motorista é escolhido', () => {
    expect(esquemaResumoDoDia.parse({ data: '2026-10-07' })).toEqual({ data: '2026-10-07' });
  });
});

describe('período das consultas (US027)', () => {
  it('aceita consulta sem período', () => {
    expect(esquemaListarJornadas.safeParse({}).success).toBe(true);
  });

  it('recusa data final anterior à inicial', () => {
    const campos = erros(
      esquemaListarJornadas.safeParse({ dataInicio: '2026-08-20', dataFim: '2026-08-10' }),
    );
    expect(campos.dataFim).toBe('A data final não pode ser anterior à inicial.');
  });

  it('aceita exatamente 12 meses — fronteira', () => {
    const resultado = esquemaListarJornadas.safeParse({
      dataInicio: '2026-01-01',
      dataFim: '2026-12-31',
    });
    expect(resultado.success).toBe(true);
  });

  it('recusa período maior que 12 meses', () => {
    // Protege contra a consulta acidental que varre anos e trava a tela.
    const campos = erros(
      esquemaListarJornadas.safeParse({ dataInicio: '2024-01-01', dataFim: '2026-12-31' }),
    );
    expect(campos.dataFim).toBe('Selecione um período de no máximo 12 meses.');
  });

  it('a mesma regra vale para corridas', () => {
    const campos = erros(
      esquemaListarCorridas.safeParse({ dataInicio: '2020-01-01', dataFim: '2026-12-31' }),
    );
    expect(campos.dataFim).toBe('Selecione um período de no máximo 12 meses.');
  });

  it('um único dia é período válido', () => {
    expect(
      esquemaListarCorridas.safeParse({ dataInicio: '2026-08-23', dataFim: '2026-08-23' }).success,
    ).toBe(true);
  });
});

describe('ordenação das listagens', () => {
  it('aplica os padrões', () => {
    const resultado = esquemaListarJornadas.safeParse({});
    if (resultado.success) {
      // Jornada mais recente primeiro: é o que o administrador quer ver ao abrir.
      expect(resultado.data).toMatchObject({ ordenar: 'data', direcao: 'desc', pagina: 1 });
    }
  });

  it('recusa coluna fora da lista permitida', () => {
    // Sem lista branca, `ordenar` viraria injeção no `orderBy` do Prisma.
    expect(esquemaListarJornadas.safeParse({ ordenar: 'observacoes' }).success).toBe(false);
    expect(esquemaListarCorridas.safeParse({ ordenar: 'motivoCancelamento' }).success).toBe(false);
  });

  it('recusa status fora do domínio', () => {
    expect(esquemaListarJornadas.safeParse({ status: 'PAUSADA' }).success).toBe(false);
    expect(esquemaListarCorridas.safeParse({ status: 'PAUSADA' }).success).toBe(false);
  });
});
