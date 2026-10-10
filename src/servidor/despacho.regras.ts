/**
 * Quais rotinas agendadas venceram (doc 13 · AD-9 · US033).
 *
 * ## Por que existe
 *
 * O agendador nasceu como processo residente com pg-boss, porque um agendador
 * precisa de um processo **vivo e único**. Em hospedagem sem servidor não há
 * processo vivo: o que existe é um cron que chama uma URL.
 *
 * A tradução não é literal, e é aqui que mora a diferença:
 *
 * 1. **O cron da Vercel dispara em UTC.** Escrever `0 23 * * *` lá agendaria
 *    23h UTC, que são 20h em São Paulo — três horas antes do fechamento. Em vez
 *    de converter à mão na expressão (e errar no dia em que o horário de verão
 *    voltar), o cron passa **de hora em hora** e é esta função que decide se
 *    alguma rotina venceu, usando o fuso da operação.
 *
 * 2. **O horário é configurável em banco** (RF040 · `horario_consolidado`). Uma
 *    expressão de cron é estática e fica no `vercel.json`, que só muda com
 *    deploy. Ler a configuração aqui preserva o requisito: o administrador
 *    continua mudando o fechamento sem depender de quem publica.
 *
 * Função pura: recebe o relógio e a configuração, devolve a lista. Sem banco,
 * sem HTTP e sem `new Date()` interno, como toda regra deste projeto.
 */

export const ROTINAS = [
  'consolidado',
  'pendencias',
  'expurgo',
  'notificacoes',
  'exportacoes',
  'fechamento',
] as const;

export type Rotina = (typeof ROTINAS)[number];

export const ROTULO_DA_ROTINA: Record<Rotina, string> = {
  consolidado: 'Planilha consolidada do dia',
  pendencias: 'Cobrança de pendências',
  expurgo: 'Expurgo por retenção',
  notificacoes: 'Fila de notificações',
  exportacoes: 'Fila de exportações',
  fechamento: 'Fechamento do mês',
};

/**
 * Expurgo: domingo às 3h, fixo.
 *
 * O prazo é que é parâmetro de negócio (RNF007); a janela de manutenção é
 * decisão de operação. Domingo de madrugada é quando a frota não roda — e
 * apagar centenas de milhares de linhas numa terça à tarde atrapalharia quem
 * está registrando.
 */
export const HORA_DO_EXPURGO = 3;
export const DIA_DO_EXPURGO = 0;

/**
 * Fechamento do mês: às 8h do dia em que o ciclo vira (16, por padrão).
 *
 * Não à meia-noite: o turno da noite só termina às 7h, e gerar antes disso
 * deixaria o último dia do ciclo aberto na planilha. O dia vem da configuração
 * `ciclo_dia_inicio`, como o próprio ciclo.
 */
export const HORA_DO_FECHAMENTO = 8;

/**
 * Hora de um `HH:MM` configurado, caindo no padrão quando o valor é inválido.
 *
 * Configuração ruim não pode significar rotina que nunca roda: o mesmo
 * princípio do `cronDoHorario` que isto substitui.
 */
export function horaDoHorario(horario: string, padrao: number): number {
  const casado = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(horario.trim());
  if (!casado) return padrao;
  return Number(casado[1]);
}

export interface RelogioDoDespacho {
  /** Hora local no fuso da operação, 0 a 23. */
  hora: number;
  /** Dia da semana local, 0 é domingo. */
  diaDaSemana: number;
  /** Dia do mês local, 1 a 31. */
  diaDoMes: number;
}

export interface HorariosConfigurados {
  horarioConsolidado: string;
  horarioAlertaPendencia: string;
  /** Dia em que o ciclo do fechamento começa (`ciclo_dia_inicio`). */
  cicloDiaInicio: number;
}

/**
 * As rotinas que devem rodar nesta passagem.
 *
 * `notificacoes` e `exportacoes` rodam **toda** passagem: são filas, e o
 * trabalho delas é olhar se há algo pendente. Sair sem nada a fazer é o
 * resultado normal e não é falha.
 *
 * As outras são de horário. A idempotência não está aqui — está nos casos
 * de uso, que reconhecem o dia já processado pela `referencia_chave` (US038) ou
 * geram um arquivo novo sem sobrescrever o anterior (US033). Por isso uma
 * passagem repetida no mesmo horário é segura, e é o que permite ao cron
 * disparar de hora em hora sem medo.
 */
export function rotinasDevidas(
  relogio: RelogioDoDespacho,
  horarios: HorariosConfigurados,
): Rotina[] {
  const devidas: Rotina[] = ['exportacoes', 'notificacoes'];

  if (relogio.hora === horaDoHorario(horarios.horarioAlertaPendencia, 20)) {
    devidas.push('pendencias');
  }

  // O consolidado vem depois da cobrança quando caem na mesma hora: cobrar
  // pendências de um dia já fechado seria cobrar o que não tem mais conserto.
  if (relogio.hora === horaDoHorario(horarios.horarioConsolidado, 23)) {
    devidas.push('consolidado');
  }

  if (relogio.diaDaSemana === DIA_DO_EXPURGO && relogio.hora === HORA_DO_EXPURGO) {
    devidas.push('expurgo');
  }

  if (relogio.diaDoMes === horarios.cicloDiaInicio && relogio.hora === HORA_DO_FECHAMENTO) {
    devidas.push('fechamento');
  }

  return devidas;
}
