import { beforeEach, describe, expect, it, vi } from 'vitest';

const exemplo = vi.hoisted(() => {
  const usuario = { id: '10000000-0000-4000-8000-000000000001', perfil: 'MOTORISTA' };
  const jornadas = [
    { id: 'minha-jornada', motoristaId: usuario.id, data: new Date('2026-10-01T00:00:00Z') },
    {
      id: 'outro-motorista',
      motoristaId: '10000000-0000-4000-8000-000000000002',
      data: new Date('2026-10-01T00:00:00Z'),
    },
    { id: 'meu-outro-dia', motoristaId: usuario.id, data: new Date('2026-09-30T00:00:00Z') },
  ];
  const tx = {
    jornada: {
      findMany: async ({ where }: { where: { data: Date; motoristaId?: string } }) =>
        jornadas.filter(
          (jornada) =>
            jornada.data.getTime() === where.data.getTime() &&
            (!where.motoristaId || jornada.motoristaId === where.motoristaId),
        ),
    },
  };
  return { usuario, tx };
});

// O contexto de sessão é injetado; o serviço e sua consulta reais continuam executando.
vi.mock('@/lib/acao-segura', () => ({
  definirAcao:
    (configuracao: {
      esquema: { parse: (entrada: unknown) => unknown };
      executar: (entrada: unknown, contexto: unknown) => Promise<unknown>;
    }) =>
    async (entrada: unknown) => ({
      sucesso: true,
      dados: await configuracao.executar(configuracao.esquema.parse(entrada), exemplo),
    }),
}));

import { meuResumoDoDia } from '@/modulos/relatorio/relatorio.servico';
import { esquemaDia } from '@/modulos/relatorio/relatorio.schema';
import { esquemaRegistrarFolga } from '@/modulos/escala/escala.schema';

beforeEach(() => {
  exemplo.usuario.perfil = 'MOTORISTA';
});

describe('histórico pessoal', () => {
  it('usa o usuário da sessão e não aceita trocar de motorista pela entrada', async () => {
    const resultado = await meuResumoDoDia({
      data: '2026-10-01',
      motoristaId: '10000000-0000-4000-8000-000000000002',
    });
    if (!resultado.sucesso) throw new Error('Consulta falhou');
    expect(resultado.dados.jornadas.map((jornada) => jornada.id)).toEqual(['minha-jornada']);
  });

  it('também mantém o histórico pessoal do administrador separado dos relatórios da frota', async () => {
    exemplo.usuario.perfil = 'ADMIN';
    const resultado = await meuResumoDoDia({ data: '2026-09-30' });
    if (!resultado.sucesso) throw new Error('Consulta falhou');
    expect(resultado.dados.jornadas.map((jornada) => jornada.id)).toEqual(['meu-outro-dia']);
  });

  it('recusa datas impossíveis em histórico e folga', () => {
    expect(esquemaDia.safeParse({ data: '2026-02-30' }).success).toBe(false);
    expect(
      esquemaRegistrarFolga.safeParse({ data: '2026-02-30', motoristaId: exemplo.usuario.id })
        .success,
    ).toBe(false);
    expect(esquemaDia.safeParse({ data: '2028-02-29' }).success).toBe(true);
  });
});
