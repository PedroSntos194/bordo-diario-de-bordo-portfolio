import { describe, expect, it } from 'vitest';
import type { ClientePrisma } from '@/lib/prisma';
import { motoristasAtivosSemRegistro } from '@/modulos/pendencia/pendencia.repositorio';
import { indicadoresDoDia, motoristasSemRegistro } from '@/modulos/relatorio/relatorio.repositorio';

/** Executa os filtros reais contra uma operação de exemplo, sem tocar um banco externo. */
function corresponde(objeto: Record<string, unknown>, filtro: Record<string, unknown>): boolean {
  return Object.entries(filtro).every(([chave, esperado]) => {
    const valor = objeto[chave];
    if (esperado instanceof Date)
      return valor instanceof Date && valor.getTime() === esperado.getTime();
    if (esperado && typeof esperado === 'object') {
      const criterio = esperado as Record<string, unknown>;
      if ('some' in criterio)
        return (
          Array.isArray(valor) &&
          valor.some((item) => corresponde(item, criterio.some as Record<string, unknown>))
        );
      if ('none' in criterio)
        return (
          Array.isArray(valor) &&
          !valor.some((item) => corresponde(item, criterio.none as Record<string, unknown>))
        );
      return (
        valor !== null &&
        typeof valor === 'object' &&
        corresponde(valor as Record<string, unknown>, criterio)
      );
    }
    return valor === esperado;
  });
}

const data = new Date('2026-10-01T00:00:00Z');
const outroDia = new Date('2026-09-30T00:00:00Z');
const usuario = (id: string, extras: Record<string, unknown> = {}) => ({
  id,
  nome: id,
  telefone: '11999999999',
  perfil: 'MOTORISTA',
  status: 'ATIVO',
  escalas: [{ data }],
  jornadas: [],
  folgas: [],
  ...extras,
});

function bancoDeExemplo() {
  const pessoas = [
    usuario('escalado-sem-registro'),
    usuario('dois-turnos', { escalas: [{ data }, { data }] }),
    usuario('nao-escalado', { escalas: [] }),
    usuario('escala-de-ontem', { escalas: [{ data: outroDia }] }),
    usuario('de-folga', { folgas: [{ data, ativa: true }] }),
    usuario('folga-removida', { folgas: [{ data, ativa: false }] }),
    usuario('folga-de-ontem', { folgas: [{ data: outroDia, ativa: true }] }),
    usuario('ja-iniciou', { jornadas: [{ data }] }),
    usuario('inativo', { status: 'INATIVO' }),
    usuario('administrador', { perfil: 'ADMIN' }),
  ];
  const usuarioRepositorio = {
    findMany: async ({
      where,
      select,
    }: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    }) =>
      pessoas
        .filter((pessoa) => corresponde(pessoa, where))
        .map((pessoa) =>
          Object.fromEntries(
            Object.keys(select).map((chave) => [chave, pessoa[chave as keyof typeof pessoa]]),
          ),
        ),
    count: async ({ where }: { where: Record<string, unknown> }) =>
      pessoas.filter((pessoa) => corresponde(pessoa, where)).length,
  };
  return {
    usuario: usuarioRepositorio,
    jornada: { count: async () => 0, findMany: async () => [] },
    corrida: { count: async () => 0, aggregate: async () => ({ _sum: { kmPercorrido: 0 } }) },
    ocorrencia: { count: async () => 0 },
  } as unknown as ClientePrisma;
}

describe('pendências conforme escala e folga', () => {
  it('cobra apenas os escalados ativos sem jornada, respeitando a data e a folga', async () => {
    const pendentes = await motoristasAtivosSemRegistro(bancoDeExemplo(), '2026-10-01');
    expect(pendentes.map((pessoa) => pessoa.id)).toEqual([
      'escalado-sem-registro',
      'dois-turnos',
      'folga-removida',
      'folga-de-ontem',
    ]);
  });

  it('mostra no painel a mesma lista e quantidade que a rotina de cobrança', async () => {
    const banco = bancoDeExemplo();
    const [cobranca, lista, indicadores] = await Promise.all([
      motoristasAtivosSemRegistro(banco, '2026-10-01'),
      motoristasSemRegistro(banco, '2026-10-01'),
      indicadoresDoDia(banco, '2026-10-01'),
    ]);
    expect(lista.map((pessoa) => pessoa.id)).toEqual(cobranca.map((pessoa) => pessoa.id));
    expect(indicadores.motoristasSemRegistro).toBe(cobranca.length);
    expect(lista.every((pessoa) => !('telefone' in pessoa))).toBe(true);
  });

  it('um dia sem escala não cobra os demais motoristas ativos', async () => {
    expect(await motoristasAtivosSemRegistro(bancoDeExemplo(), '2026-10-02')).toEqual([]);
  });
});
