import type { CanalNotificacao, Prisma, StatusNotificacao, TipoNotificacao } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';

/** Acesso a dados das notificações (RF025, RF027 · RN028). */

export interface NovaNotificacao {
  canal: CanalNotificacao;
  tipo: TipoNotificacao;
  destinatarioUsuarioId: string | null;
  destinatarioTelefone: string | null;
  conteudo: string;
  arquivoId: string | null;
  referenciaTipo: string | null;
  referenciaId: string | null;
  /**
   * Referência que **não é um uuid**: hoje a data operacional do alerta de
   * pendências (US038). É por ela que a rotina reconhece o dia que já cobrou.
   */
  referenciaChave: string | null;
  status: StatusNotificacao;
  enviadaEm: Date | null;
  ultimoErro: string | null;
}

export async function registrarNotificacao(
  cliente: ClientePrisma,
  dados: NovaNotificacao,
): Promise<{ id: string }> {
  return cliente.notificacao.create({
    data: { ...dados, tentativas: 1 },
    select: { id: true },
  });
}

/**
 * Marca o envio como concluído (RF025).
 *
 * Na abordagem V-05a a confirmação vem do **motorista**, depois de ele voltar
 * do WhatsApp: o servidor não tem como saber sozinho se a mensagem saiu. Por
 * isso a notificação nasce `PENDENTE` e só vira `ENVIADA` por este caminho.
 */
export async function marcarComoEnviada(
  cliente: ClientePrisma,
  id: string,
  enviadaEm: Date,
): Promise<boolean> {
  // O resumo pode ter sido cancelado pela reabertura depois da leitura feita
  // pelo serviço. A condição na escrita impede que uma aba antiga o restaure.
  const { count } = await cliente.notificacao.updateMany({
    where: { id, status: { in: ['PENDENTE', 'FALHA'] } },
    data: { status: 'ENVIADA', enviadaEm, ultimoErro: null },
  });
  return count === 1;
}

export async function buscarNotificacaoPorId(cliente: ClientePrisma, id: string) {
  return cliente.notificacao.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      tipo: true,
      canal: true,
      referenciaTipo: true,
      referenciaId: true,
      destinatarioTelefone: true,
    },
  });
}

/** Notificações já registradas para uma jornada — evita duplicar o envio. */
export async function notificacoesDaJornada(cliente: ClientePrisma, jornadaId: string) {
  return cliente.notificacao.findMany({
    where: { referenciaTipo: 'jornada', referenciaId: jornadaId, tipo: 'RESUMO_DIA' },
    select: { id: true, status: true, destinatarioTelefone: true, enviadaEm: true },
    orderBy: { criadoEm: 'desc' },
  });
}

export interface FiltrosDeNotificacao {
  status?: StatusNotificacao;
  skip: number;
  take: number;
}

export async function listarNotificacoes(cliente: ClientePrisma, filtros: FiltrosDeNotificacao) {
  const where: Prisma.NotificacaoWhereInput = filtros.status ? { status: filtros.status } : {};

  const [notificacoes, total] = await Promise.all([
    cliente.notificacao.findMany({
      where,
      select: {
        id: true,
        canal: true,
        tipo: true,
        status: true,
        destinatarioTelefone: true,
        tentativas: true,
        ultimoErro: true,
        enviadaEm: true,
        criadoEm: true,
        destinatario: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
      skip: filtros.skip,
      take: filtros.take,
    }),
    cliente.notificacao.count({ where }),
  ]);

  return { notificacoes, total };
}

/** Telefones dos administradores ativos — destino padrão do resumo (V-15). */
export async function administradoresParaNotificar(cliente: ClientePrisma) {
  return cliente.usuario.findMany({
    where: { perfil: 'ADMIN', status: 'ATIVO' },
    select: { id: true, nome: true, telefone: true },
    orderBy: { nome: 'asc' },
  });
}

/** Notificações que falharam e ainda têm tentativa automática disponível (US037). */
export async function falhasReenviaveis(cliente: ClientePrisma, maxTentativas: number) {
  return cliente.notificacao.findMany({
    where: { status: 'FALHA', tentativas: { lt: maxTentativas } },
    select: {
      id: true,
      canal: true,
      tipo: true,
      status: true,
      tentativas: true,
      conteudo: true,
      destinatarioTelefone: true,
      referenciaTipo: true,
      referenciaId: true,
      atualizadoEm: true,
    },
    orderBy: { atualizadoEm: 'asc' },
    take: 50,
  });
}

export type FalhaReenviavel = Awaited<ReturnType<typeof falhasReenviaveis>>[number];

/** Registra o resultado de uma tentativa de envio. */
export async function registrarTentativa(
  cliente: ClientePrisma,
  id: string,
  resultado: { sucesso: boolean; erro?: string | null },
): Promise<void> {
  await cliente.notificacao.update({
    where: { id },
    data: {
      tentativas: { increment: 1 },
      status: resultado.sucesso ? 'ENVIADA' : 'FALHA',
      enviadaEm: resultado.sucesso ? new Date() : null,
      ultimoErro: resultado.sucesso ? null : (resultado.erro ?? 'Falha desconhecida.'),
    },
  });
}

/** Quantas notificações esgotaram as tentativas — sinal do painel (US037). */
export async function contarQueRequeremAtencao(
  cliente: ClientePrisma,
  maxTentativas: number,
): Promise<number> {
  return cliente.notificacao.count({
    where: { status: 'FALHA', tentativas: { gte: maxTentativas } },
  });
}

/** Conteúdo e destino de uma notificação, para tentar o envio. */
export async function buscarParaEnvio(cliente: ClientePrisma, id: string) {
  return cliente.notificacao.findUnique({
    where: { id },
    select: { id: true, conteudo: true, destinatarioTelefone: true },
  });
}

/**
 * Cancela o resumo já mandado de um dia reaberto: os números dele mudaram, e
 * deixá-lo como "enviado" esconderia do motorista o envio do resumo novo.
 */
export async function cancelarResumosDaJornada(
  cliente: ClientePrisma,
  jornadaId: string,
): Promise<number> {
  const { count } = await cliente.notificacao.updateMany({
    where: {
      referenciaTipo: 'jornada',
      referenciaId: jornadaId,
      tipo: 'RESUMO_DIA',
      status: { not: 'CANCELADA' },
    },
    data: { status: 'CANCELADA' },
  });
  return count;
}
