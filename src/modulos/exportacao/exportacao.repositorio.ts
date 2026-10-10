import type { Prisma, StatusTarefa, TipoExportacao } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';

/**
 * Fila e histórico das exportações em segundo plano (US031 · RF031).
 *
 * Único arquivo do módulo que fala Prisma — o serviço continua consultando os
 * registros a exportar pelos repositórios de jornada e corrida, que já sabem
 * montar aqueles filtros.
 */

export interface NovaTarefaDeExportacao {
  tipo: TipoExportacao;
  filtros: Prisma.InputJsonValue;
  linhasPrevistas: number;
  solicitadoPor: string;
}

export async function criarTarefa(cliente: ClientePrisma, dados: NovaTarefaDeExportacao) {
  return cliente.tarefaExportacao.create({
    data: {
      tipo: dados.tipo,
      filtros: dados.filtros,
      linhasPrevistas: dados.linhasPrevistas,
      solicitadoPor: dados.solicitadoPor,
      status: 'PENDENTE',
    },
    select: { id: true, criadoEm: true },
  });
}

const CAMPOS_DA_TAREFA = {
  id: true,
  tipo: true,
  filtros: true,
  status: true,
  linhasPrevistas: true,
  linhasGeradas: true,
  arquivoId: true,
  solicitadoPor: true,
  tentativas: true,
  erro: true,
  iniciadaEm: true,
  concluidaEm: true,
  criadoEm: true,
} satisfies Prisma.TarefaExportacaoSelect;

export async function buscarTarefaPorId(cliente: ClientePrisma, id: string) {
  return cliente.tarefaExportacao.findUnique({
    where: { id },
    select: {
      ...CAMPOS_DA_TAREFA,
      arquivo: { select: { id: true, nomeOriginal: true, tamanhoBytes: true } },
      solicitante: { select: { id: true, nome: true, perfil: true, status: true } },
    },
  });
}

export type TarefaComSolicitante = NonNullable<Awaited<ReturnType<typeof buscarTarefaPorId>>>;

/** Tarefas de um solicitante, da mais recente para a mais antiga. */
export async function tarefasDoSolicitante(
  cliente: ClientePrisma,
  solicitadoPor: string,
  limite: number,
) {
  return cliente.tarefaExportacao.findMany({
    where: { solicitadoPor },
    select: {
      ...CAMPOS_DA_TAREFA,
      arquivo: { select: { id: true, nomeOriginal: true, tamanhoBytes: true } },
    },
    orderBy: { criadoEm: 'desc' },
    take: limite,
  });
}

export type TarefaDaListagem = Awaited<ReturnType<typeof tarefasDoSolicitante>>[number];

export async function contarTarefasNaFila(
  cliente: ClientePrisma,
  solicitadoPor: string,
): Promise<number> {
  return cliente.tarefaExportacao.count({
    where: { solicitadoPor, status: { in: ['PENDENTE', 'PROCESSANDO'] } },
  });
}

/** Identificadores das tarefas à espera, em ordem de chegada. */
export async function tarefasPendentes(cliente: ClientePrisma, limite: number): Promise<string[]> {
  const tarefas = await cliente.tarefaExportacao.findMany({
    where: { status: 'PENDENTE' },
    select: { id: true },
    orderBy: { criadoEm: 'asc' },
    take: limite,
  });

  return tarefas.map((tarefa) => tarefa.id);
}

/**
 * Reclama a tarefa para este processo, se ela ainda estiver livre.
 *
 * A condição `status: 'PENDENTE'` **dentro** do `updateMany` é o que torna a
 * reclamação atômica: dois agendadores rodando ao mesmo tempo — o que acontece
 * durante um deploy, com o contêiner novo já de pé e o antigo ainda drenando —
 * disputam a mesma linha, e o PostgreSQL deixa exatamente um passar. Ler e
 * depois atualizar deixaria os dois gerando a mesma planilha.
 *
 * Devolve `false` quando alguém chegou antes, e aí não há nada a fazer.
 */
export async function reclamarTarefa(cliente: ClientePrisma, id: string): Promise<boolean> {
  const { count } = await cliente.tarefaExportacao.updateMany({
    where: { id, status: 'PENDENTE' },
    data: { status: 'PROCESSANDO', iniciadaEm: new Date(), tentativas: { increment: 1 } },
  });

  return count === 1;
}

export async function concluirTarefa(
  cliente: ClientePrisma,
  id: string,
  dados: { arquivoId: string; linhasGeradas: number },
): Promise<void> {
  await cliente.tarefaExportacao.update({
    where: { id },
    data: {
      status: 'CONCLUIDA',
      arquivoId: dados.arquivoId,
      linhasGeradas: dados.linhasGeradas,
      concluidaEm: new Date(),
      erro: null,
    },
  });
}

/**
 * Registra a falha e decide o destino da tarefa.
 *
 * `PENDENTE` de novo significa nova tentativa na próxima passagem; `FALHA` é o
 * fim da linha. O motivo é gravado nos dois casos — numa tentativa intermediária
 * ele é o que explica, depois, por que a planilha demorou.
 */
export async function registrarFalhaDaTarefa(
  cliente: ClientePrisma,
  id: string,
  dados: { erro: string; status: Extract<StatusTarefa, 'PENDENTE' | 'FALHA'> },
): Promise<void> {
  await cliente.tarefaExportacao.update({
    where: { id },
    data: {
      status: dados.status,
      erro: dados.erro,
      concluidaEm: dados.status === 'FALHA' ? new Date() : null,
    },
  });
}

/**
 * Devolve à fila as tarefas que um processo interrompido deixou em
 * `PROCESSANDO`.
 *
 * Sem isto, um agendador morto no meio da geração — reinício de contêiner,
 * `SIGKILL`, queda da máquina — deixa a tarefa presa nesse estado para sempre,
 * e a tela do solicitante fica dizendo "gerando" indefinidamente sobre um
 * trabalho que ninguém está fazendo.
 *
 * O corte por tempo é o que separa "abandonada" de "em andamento agora": só
 * volta para a fila o que começou há mais tempo do que qualquer geração
 * plausível leva.
 */
export async function devolverTarefasAbandonadas(
  cliente: ClientePrisma,
  anteriorA: Date,
): Promise<number> {
  const { count } = await cliente.tarefaExportacao.updateMany({
    where: { status: 'PROCESSANDO', iniciadaEm: { lt: anteriorA } },
    data: { status: 'PENDENTE', erro: 'A geração anterior foi interrompida.' },
  });

  return count;
}
