import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodigoErro } from '@/lib/erros';
import type { UsuarioAutenticado } from '@/lib/sessao';
import type { DadosDoMotorista } from '@/modulos/acompanhamento/acompanhamento.regras';
import { VERSAO_AVISO_PRIVACIDADE } from '@/modulos/privacidade/aviso-privacidade';

const simulacoes = vi.hoisted(() => ({
  sessao: vi.fn<() => Promise<UsuarioAutenticado | null>>(),
  consultar: vi.fn<(cliente: unknown, data: string) => Promise<DadosDoMotorista[]>>(),
  prisma: { $transaction: vi.fn() },
}));

// definirAcao e exigirPerfil são os reais: só as fronteiras externas são simuladas.
vi.mock('@/lib/sessao', () => ({ obterUsuarioDaSessao: simulacoes.sessao }));
vi.mock('@/lib/prisma', () => ({ prisma: simulacoes.prisma }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/modulos/acompanhamento/acompanhamento.repositorio', () => ({
  consultarMotoristas: simulacoes.consultar,
}));

import { painelDeMotoristas } from '@/modulos/acompanhamento/acompanhamento.servico';

const AGORA = new Date('2026-10-05T02:30:00Z');
const DIA_LOCAL = '2026-10-04';

function usuario(alteracoes: Partial<UsuarioAutenticado> = {}): UsuarioAutenticado {
  return {
    id: 'administrador',
    nome: 'Administrador de teste',
    cpf: '',
    perfil: 'ADMIN',
    deveTrocarSenha: false,
    aceitouPrivacidade: true,
    ...alteracoes,
  };
}

function motorista(alteracoes: Partial<DadosDoMotorista> = {}): DadosDoMotorista {
  return {
    id: 'motorista-1',
    nome: 'José de teste',
    status: 'ATIVO',
    ultimoLoginEm: new Date('2026-10-01T10:00:00Z'),
    deveTrocarSenha: false,
    senhaTemporariaExpiraEm: null,
    bloqueadoAte: null,
    versoesAceitas: [VERSAO_AVISO_PRIVACIDADE],
    escalado: false,
    deFolga: false,
    primeiraJornadaEm: new Date('2026-10-01T10:00:00Z'),
    possuiCorridaConcluida: true,
    jornadaDoDia: null,
    jornadaAnteriorAberta: null,
    ...alteracoes,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  simulacoes.sessao.mockReset().mockResolvedValue(usuario());
  simulacoes.consultar.mockReset().mockResolvedValue([]);
  simulacoes.prisma.$transaction.mockReset();
});

afterEach(() => vi.useRealTimers());

describe('painelDeMotoristas: autorização real antes da consulta', () => {
  it('permite ADMIN e executa uma leitura sem abrir transação', async () => {
    const resultado = await painelDeMotoristas({ data: DIA_LOCAL });
    expect(resultado).toMatchObject({ sucesso: true, dados: { data: DIA_LOCAL, motoristas: [] } });
    expect(simulacoes.consultar).toHaveBeenCalledExactlyOnceWith(simulacoes.prisma, DIA_LOCAL);
    expect(simulacoes.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recusa MOTORISTA antes de consultar qualquer motorista', async () => {
    simulacoes.sessao.mockResolvedValue(usuario({ perfil: 'MOTORISTA' }));
    const resultado = await painelDeMotoristas({ data: DIA_LOCAL });
    expect(resultado).toMatchObject({ sucesso: false, erro: { codigo: CodigoErro.SEM_PERMISSAO } });
    expect(simulacoes.consultar).not.toHaveBeenCalled();
  });

  it('recusa ausência de sessão antes da consulta', async () => {
    simulacoes.sessao.mockResolvedValue(null);
    const resultado = await painelDeMotoristas({ data: DIA_LOCAL });
    expect(resultado).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.NAO_AUTENTICADO },
    });
    expect(simulacoes.consultar).not.toHaveBeenCalled();
  });

  it.each([{ deveTrocarSenha: true }, { aceitouPrivacidade: false }])(
    'recusa ADMIN com pendência %j antes da consulta',
    async (pendencia) => {
      simulacoes.sessao.mockResolvedValue(usuario(pendencia));
      expect(await painelDeMotoristas({ data: DIA_LOCAL })).toMatchObject({
        sucesso: false,
        erro: { codigo: CodigoErro.SEM_PERMISSAO },
      });
      expect(simulacoes.consultar).not.toHaveBeenCalled();
    },
  );

  it('recusa data inexistente antes de consultar o banco', async () => {
    expect(await painelDeMotoristas({ data: '2026-02-30' })).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.DADOS_INVALIDOS, campos: { data: expect.any(String) } },
    });
    expect(simulacoes.consultar).not.toHaveBeenCalled();
  });
});

describe('painelDeMotoristas: data operacional e filtros', () => {
  it.each([
    ['2026-10-05T02:59:59Z', '2026-10-04'],
    ['2026-10-05T03:00:00Z', '2026-10-05'],
  ])('o dia padrão de %s usa São Paulo: %s', async (instante, data) => {
    vi.setSystemTime(new Date(instante));
    const resultado = await painelDeMotoristas({});
    expect(resultado).toMatchObject({ sucesso: true, dados: { data } });
    expect(simulacoes.consultar).toHaveBeenCalledExactlyOnceWith(simulacoes.prisma, data);
  });

  it('consulta a operação histórica e mantém a classificação de acesso atual', async () => {
    simulacoes.consultar.mockResolvedValue([
      motorista({ bloqueadoAte: new Date(AGORA.getTime() + 60_000) }),
    ]);
    const resultado = await painelDeMotoristas({ data: '2026-09-25' });
    expect(simulacoes.consultar).toHaveBeenCalledExactlyOnceWith(simulacoes.prisma, '2026-09-25');
    expect(resultado).toMatchObject({
      sucesso: true,
      dados: { consultadoEm: AGORA, motoristas: [{ acesso: 'BLOQUEIO_TEMPORARIO' }] },
    });
  });

  it('filtra a lista por nome e atenção mantendo indicadores sobre todos os motoristas', async () => {
    simulacoes.consultar.mockResolvedValue([
      motorista(),
      motorista({ id: 'ajuda', nome: 'José que precisa de ajuda', ultimoLoginEm: null }),
      motorista({ id: 'outro', nome: 'Maria de teste' }),
    ]);
    const resultado = await painelDeMotoristas({ busca: '  JOSE  ', atencao: 'atencao' });
    expect(resultado.sucesso).toBe(true);
    if (!resultado.sucesso) return;
    expect(resultado.dados.motoristas.map((item) => item.id)).toEqual(['ajuda']);
    expect(resultado.dados.resumo).toMatchObject({
      total: 3,
      precisamAtencao: 1,
      nuncaEntraram: 1,
    });
  });
});
