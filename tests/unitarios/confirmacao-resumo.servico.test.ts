import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatusJornada, StatusNotificacao } from '@prisma/client';
import type { UsuarioAutenticado } from '@/lib/sessao';
import { CodigoErro } from '@/lib/erros';

const simulacoes = vi.hoisted(() => ({
  sessao: vi.fn<() => Promise<UsuarioAutenticado | null>>(),
  auditar: vi.fn(),
  enviar: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    jornada: { findUnique: vi.fn() },
    notificacao: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));

// Wrapper, autorização, schemas, serviço e repositórios executam código real.
vi.mock('@/lib/sessao', () => ({ obterUsuarioDaSessao: simulacoes.sessao }));
vi.mock('@/lib/prisma', () => ({ prisma: simulacoes.prisma }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/modulos/auditoria/auditoria.servico', () => ({
  registrarAuditoria: simulacoes.auditar,
}));
vi.mock('@/modulos/notificacao/whatsapp', () => ({
  notificadorWhatsApp: { canal: 'link', enviar: simulacoes.enviar },
}));

import { confirmarEnvioDoResumo } from '@/modulos/notificacao/notificacao.servico';

const MOTORISTA = '10000000-0000-4000-8000-000000000001';
const OUTRO = '10000000-0000-4000-8000-000000000002';
const JORNADA = '10000000-0000-4000-8000-000000000003';
const NOTIFICACAO = '10000000-0000-4000-8000-000000000004';

function usuario(id = MOTORISTA, perfil: 'MOTORISTA' | 'ADMIN' = 'MOTORISTA') {
  return {
    id,
    perfil,
    nome: 'Motorista',
    cpf: '',
    deveTrocarSenha: false,
    aceitouPrivacidade: true,
  } satisfies UsuarioAutenticado;
}

let jornadaAtual: { id: string; motoristaId: string; status: StatusJornada };
let notificacaoAtual: {
  id: string;
  status: StatusNotificacao;
  tipo: string;
  canal: string;
  referenciaTipo: string | null;
  referenciaId: string | null;
  destinatarioTelefone: string;
  enviadaEm: Date | null;
  ultimoErro: string | null;
};

beforeEach(() => {
  vi.resetAllMocks();
  jornadaAtual = { id: JORNADA, motoristaId: MOTORISTA, status: 'ENCERRADA' };
  notificacaoAtual = {
    id: NOTIFICACAO,
    status: 'PENDENTE',
    tipo: 'RESUMO_DIA',
    canal: 'WHATSAPP',
    referenciaTipo: 'jornada',
    referenciaId: JORNADA,
    destinatarioTelefone: '+5511988887777',
    enviadaEm: null,
    ultimoErro: null,
  };
  simulacoes.sessao.mockResolvedValue(usuario());
  simulacoes.prisma.$transaction.mockImplementation(async (executar) =>
    executar(simulacoes.prisma),
  );
  simulacoes.prisma.jornada.findUnique.mockImplementation(async () => ({ ...jornadaAtual }));
  simulacoes.prisma.notificacao.findUnique.mockImplementation(async () => ({
    ...notificacaoAtual,
  }));
  simulacoes.prisma.notificacao.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.id !== notificacaoAtual.id || !where.status.in.includes(notificacaoAtual.status)) {
      return { count: 0 };
    }
    Object.assign(notificacaoAtual, data);
    return { count: 1 };
  });
});

function confirmar() {
  return confirmarEnvioDoResumo({ notificacaoId: NOTIFICACAO });
}

function semGravacao() {
  expect(simulacoes.prisma.notificacao.updateMany).not.toHaveBeenCalled();
  expect(simulacoes.auditar).not.toHaveBeenCalled();
  expect(simulacoes.enviar).not.toHaveBeenCalled();
}

describe('confirmação do resumo do dia', () => {
  it('exige sessão antes de consultar ou alterar o resumo', async () => {
    simulacoes.sessao.mockResolvedValue(null);

    expect(await confirmar()).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.NAO_AUTENTICADO },
    });
    expect(simulacoes.prisma.notificacao.findUnique).not.toHaveBeenCalled();
    semGravacao();
  });

  it('valida o identificador com o schema real', async () => {
    expect(await confirmarEnvioDoResumo({ notificacaoId: 'invalido' })).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.DADOS_INVALIDOS },
    });
    expect(simulacoes.prisma.notificacao.findUnique).not.toHaveBeenCalled();
    semGravacao();
  });

  it('impede uma aba antiga de confirmar resumo cancelado, mesmo após novo fechamento', async () => {
    notificacaoAtual.status = 'CANCELADA';

    expect(await confirmar()).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.CONFLITO },
    });
    expect(notificacaoAtual.status).toBe('CANCELADA');
    semGravacao();
  });

  it.each(['PENDENTE', 'ENVIADA'] as const)(
    'recusa resumo %s enquanto a jornada estiver aberta',
    async (status) => {
      notificacaoAtual.status = status;
      jornadaAtual.status = 'ABERTA';

      expect(await confirmar()).toMatchObject({
        sucesso: false,
        erro: { codigo: CodigoErro.JORNADA_NAO_ENCERRADA },
      });
      semGravacao();
    },
  );

  it.each(['PENDENTE', 'FALHA'] as const)(
    'confirma resumo %s válido com auditoria',
    async (status) => {
      notificacaoAtual.status = status;
      notificacaoAtual.ultimoErro = status === 'FALHA' ? 'Envio anterior falhou.' : null;

      expect(await confirmar()).toEqual({ sucesso: true, dados: { ok: true } });
      expect(notificacaoAtual).toMatchObject({
        status: 'ENVIADA',
        enviadaEm: expect.any(Date),
        ultimoErro: null,
      });
      expect(simulacoes.prisma.notificacao.updateMany).toHaveBeenCalledExactlyOnceWith({
        where: { id: NOTIFICACAO, status: { in: ['PENDENTE', 'FALHA'] } },
        data: { status: 'ENVIADA', enviadaEm: notificacaoAtual.enviadaEm, ultimoErro: null },
      });
      expect(simulacoes.auditar).toHaveBeenCalledExactlyOnceWith(
        simulacoes.prisma,
        expect.objectContaining({
          usuarioId: MOTORISTA,
          acao: 'ATUALIZAR',
          entidade: 'notificacao',
          entidadeId: NOTIFICACAO,
          valorAnterior: { status },
          valorNovo: { status: 'ENVIADA', enviadaEm: notificacaoAtual.enviadaEm },
        }),
      );
      expect(simulacoes.enviar).not.toHaveBeenCalled();
    },
  );

  it('repetição pelo dono retorna sucesso sem nova gravação ou auditoria', async () => {
    notificacaoAtual.status = 'ENVIADA';
    const envioAnterior = new Date('2026-10-08T11:51:00Z');
    notificacaoAtual.enviadaEm = envioAnterior;

    expect(await confirmar()).toEqual({ sucesso: true, dados: { ok: true } });
    expect(simulacoes.prisma.jornada.findUnique).toHaveBeenCalledOnce();
    expect(notificacaoAtual.enviadaEm).toBe(envioAnterior);
    semGravacao();
  });

  it.each(['PENDENTE', 'ENVIADA', 'CANCELADA'] as const)(
    'recusa outro motorista antes de confirmar ou retornar sucesso para resumo %s',
    async (status) => {
      simulacoes.sessao.mockResolvedValue(usuario(OUTRO));
      notificacaoAtual.status = status;

      expect(await confirmar()).toMatchObject({
        sucesso: false,
        erro: { codigo: CodigoErro.NAO_ENCONTRADO },
      });
      semGravacao();
    },
  );

  it('permite que a administração confirme resumo válido de um motorista', async () => {
    simulacoes.sessao.mockResolvedValue(usuario(OUTRO, 'ADMIN'));

    expect(await confirmar()).toEqual({ sucesso: true, dados: { ok: true } });
    expect(notificacaoAtual.status).toBe('ENVIADA');
    expect(simulacoes.auditar).toHaveBeenCalledOnce();
  });

  it('recusa notificação sem jornada e não deixa a administração confirmar outro tipo', async () => {
    notificacaoAtual.referenciaId = null;

    expect(await confirmar()).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.NAO_ENCONTRADO },
    });
    simulacoes.sessao.mockResolvedValue(usuario(OUTRO, 'ADMIN'));
    notificacaoAtual.referenciaId = JORNADA;
    notificacaoAtual.tipo = 'PENDENCIA';
    expect(await confirmar()).toMatchObject({
      sucesso: false,
      erro: { codigo: CodigoErro.NAO_ENCONTRADO },
    });
    semGravacao();
  });

  it.each(['CANCELADA', 'ENVIADA'] as const)(
    'preserva alteração concorrente para %s sem sobrescrever ou registrar auditoria falsa',
    async (status) => {
      // A confirmação já leu PENDENTE; outra transação altera a notificação
      // antes da escrita. O repositório real deve aplicar seu filtro de status.
      simulacoes.prisma.jornada.findUnique.mockImplementationOnce(async () => {
        notificacaoAtual.status = status;
        return { ...jornadaAtual };
      });

      expect(await confirmar()).toMatchObject({
        sucesso: false,
        erro: { codigo: CodigoErro.CONFLITO },
      });
      expect(notificacaoAtual.status).toBe(status);
      expect(notificacaoAtual.enviadaEm).toBeNull();
      expect(simulacoes.prisma.notificacao.updateMany).toHaveBeenCalledOnce();
      expect(simulacoes.auditar).not.toHaveBeenCalled();
    },
  );
});
