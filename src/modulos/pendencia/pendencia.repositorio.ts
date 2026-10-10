import type { ClientePrisma } from '@/lib/prisma';
import { REFERENCIA_DO_ALERTA } from '@/modulos/pendencia/pendencia.regras';
import { filtroMotoristaEscalado } from '@/modulos/escala/escala.repositorio';

/**
 * Consultas do alerta de pendências (US038 · RF026).
 *
 * Separadas das do painel de propósito. `motoristasSemRegistro`, em
 * `relatorio.repositorio.ts`, existe para **mostrar na tela** e devolve só id e
 * nome; aqui é preciso o **telefone**, porque o destino é uma mensagem. Cada
 * consulta traz o que o seu consumidor usa: um telefone que atravessa a
 * fronteira até o navegador do administrador é dado pessoal circulando à toa
 * (RN029).
 */

/** A data operacional é um `date` puro no banco, sem hora (RN012). */
function comoDataOperacional(dataIso: string): Date {
  return new Date(`${dataIso}T00:00:00Z`);
}

/**
 * Jornadas ainda abertas **até** a data informada.
 *
 * O `lte` e não o `=` é deliberado: um dia esquecido na terça continua sendo
 * pendência na quarta, e é a pior das duas — quem cobra só o dia corrente deixa
 * a jornada antiga aberta para sempre.
 */
export async function jornadasEmAbertoAte(cliente: ClientePrisma, dataIso: string) {
  return cliente.jornada.findMany({
    where: { status: 'ABERTA', data: { lte: comoDataOperacional(dataIso) } },
    select: {
      id: true,
      data: true,
      iniciadaEm: true,
      motorista: { select: { id: true, nome: true, telefone: true, status: true } },
      veiculo: { select: { placa: true } },
      // Distingue "esqueceu de encerrar" de "ainda está rodando". Um `select`
      // aninhado com `take: 1` custa menos que uma segunda consulta por jornada.
      corridas: { where: { status: 'EM_ANDAMENTO' }, select: { id: true }, take: 1 },
    },
    orderBy: [{ data: 'asc' }, { iniciadaEm: 'asc' }],
  });
}

/**
 * Somente motoristas ativos escalados neste dia, sem folga e sem jornada.
 */
export async function motoristasAtivosSemRegistro(cliente: ClientePrisma, dataIso: string) {
  return cliente.usuario.findMany({
    where: {
      ...filtroMotoristaEscalado(dataIso),
      jornadas: { none: { data: comoDataOperacional(dataIso) } },
    },
    select: { id: true, nome: true, telefone: true },
    orderBy: { nome: 'asc' },
  });
}

/**
 * A cobrança deste dia já saiu?
 *
 * Consulta pela `referencia_chave` — a data operacional — e não pelo instante
 * de criação: reprocessar um dia anterior não pode ser confundido com "já
 * cobrei hoje", e uma tentativa repetida às 20h05 precisa reconhecer o que saiu
 * às 20h00.
 */
export async function alertaJaGerado(cliente: ClientePrisma, dataIso: string): Promise<boolean> {
  const quantas = await cliente.notificacao.count({
    where: { referenciaTipo: REFERENCIA_DO_ALERTA, referenciaChave: dataIso },
  });
  return quantas > 0;
}

/** Notificações já emitidas para um dia, para a tela mostrar o que foi cobrado. */
export async function alertasDoDia(cliente: ClientePrisma, dataIso: string) {
  return cliente.notificacao.findMany({
    where: { referenciaTipo: REFERENCIA_DO_ALERTA, referenciaChave: dataIso },
    select: {
      id: true,
      tipo: true,
      status: true,
      destinatarioTelefone: true,
      criadoEm: true,
      destinatario: { select: { id: true, nome: true } },
    },
    orderBy: { criadoEm: 'asc' },
  });
}

export type AlertaEmitido = Awaited<ReturnType<typeof alertasDoDia>>[number];
