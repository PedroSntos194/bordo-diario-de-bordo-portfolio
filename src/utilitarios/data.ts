/**
 * Datas e horas (RNF023).
 *
 * Regra do projeto: **instantes são gravados em UTC**, a apresentação e a
 * "data operacional" usam o fuso da operação (America/Sao_Paulo).
 *
 * Isso importa mais do que parece aqui: a jornada é única por motorista e por
 * **data** (RN012). Uma corrida encerrada às 23h50 e outra às 00h10 pertencem a
 * dias diferentes — e é o fuso local, não o UTC, que decide isso. Calcular a
 * data operacional em UTC colocaria toda corrida após as 21h no dia seguinte.
 */

export const FUSO_OPERACAO = 'America/Sao_Paulo';

const formatadorPartes = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_OPERACAO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

interface PartesLocais {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

function partesNoFusoOperacao(instante: Date): PartesLocais {
  const partes = formatadorPartes.formatToParts(instante);
  const buscar = (tipo: Intl.DateTimeFormatPartTypes): number =>
    Number(partes.find((parte) => parte.type === tipo)?.value ?? '0');

  return {
    ano: buscar('year'),
    mes: buscar('month'),
    dia: buscar('day'),
    // Em formato 24h o Intl pode devolver "24" para meia-noite.
    hora: buscar('hour') % 24,
    minuto: buscar('minute'),
    segundo: buscar('second'),
  };
}

/** Deslocamento do fuso, em minutos, no instante informado. */
function deslocamentoEmMinutos(instante: Date): number {
  const { ano, mes, dia, hora, minuto, segundo } = partesNoFusoOperacao(instante);
  const comoSeFosseUtc = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);
  return (comoSeFosseUtc - instante.getTime()) / 60_000;
}

/**
 * Hora e minuto de um instante, no fuso da operação.
 *
 * Existe para o despacho das rotinas agendadas (doc 13 · AD-9). Na Vercel o
 * cron dispara em **UTC**, e "23h para a empresa" é 23h em São Paulo — quem
 * decide se a rotina venceu é esta função, não a expressão do cron.
 */
export function horaNoFusoOperacao(instante: Date = new Date()): {
  hora: number;
  minuto: number;
} {
  const { hora, minuto } = partesNoFusoOperacao(instante);
  return { hora, minuto };
}

/**
 * Dia da semana no fuso da operação — 0 é domingo, como em `Date.getUTCDay`.
 *
 * Calculado a partir da data operacional, ao meio-dia UTC: ao meio-dia nenhum
 * fuso do Brasil muda de dia, então o valor não depende do deslocamento.
 */
export function diaDaSemanaOperacional(instante: Date = new Date()): number {
  return new Date(`${dataOperacional(instante)}T12:00:00Z`).getUTCDay();
}

/**
 * Data operacional (`AAAA-MM-DD`) de um instante, no fuso da operação.
 * É a chave usada em `jornada.data`.
 */
export function dataOperacional(instante: Date = new Date()): string {
  const { ano, mes, dia } = partesNoFusoOperacao(instante);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Converte uma hora local do fuso da operação para o instante UTC correspondente.
 *
 * A conversão é feita em duas passadas porque o deslocamento depende do próprio
 * instante: a primeira estimativa pode cair do lado errado de uma mudança de
 * horário de verão, e a segunda corrige.
 */
export function deHoraLocalParaUtc(
  ano: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
  segundo = 0,
): Date {
  const estimativa = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);
  const primeiroDeslocamento = deslocamentoEmMinutos(new Date(estimativa));
  const ajustado = estimativa - primeiroDeslocamento * 60_000;
  const segundoDeslocamento = deslocamentoEmMinutos(new Date(ajustado));

  return new Date(estimativa - segundoDeslocamento * 60_000);
}

/** Primeiro instante (00:00 local) de uma data operacional `AAAA-MM-DD`. */
export function inicioDoDia(dataIso: string): Date {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return deHoraLocalParaUtc(ano ?? 1970, mes ?? 1, dia ?? 1, 0, 0, 0);
}

/** Último instante (23:59:59 local) de uma data operacional `AAAA-MM-DD`. */
export function fimDoDia(dataIso: string): Date {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return deHoraLocalParaUtc(ano ?? 1970, mes ?? 1, dia ?? 1, 23, 59, 59);
}

/**
 * Formata uma **data operacional** — a coluna `date` do banco, sem hora.
 *
 * Precisa existir separada de `formatarData`: o Prisma devolve colunas `date`
 * como meia-noite **UTC**, e passá-las pelo conversor de fuso as joga para as
 * 21h do dia anterior em São Paulo. O resultado é a data aparecendo um dia
 * antes na tela — foi exatamente o que aconteceu na Sprint 5.
 *
 * Aqui os componentes são lidos em UTC justamente porque não há hora: o valor
 * já *é* o dia, e não um instante que precise ser convertido.
 */
export function formatarDataOperacional(data: Date | string): string {
  if (typeof data === 'string') {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

/**
 * Projeta um **instante** para o "relógio de parede" do fuso da operação,
 * devolvendo um `Date` cujos componentes **UTC** são a hora local.
 *
 * Serve a um consumidor só, e é bom que fique explícito qual: o Excel. O
 * ExcelJS converte `Date` para número de série com `getTime()` puro — ou seja,
 * **sempre em UTC**. Entregar a ele o instante cru faria uma corrida iniciada
 * às 07:15 em São Paulo aparecer como 10:15 na planilha.
 *
 * O resultado **não é o mesmo instante** e não deve ser gravado, comparado nem
 * devolvido por API: é um valor de apresentação, com a mesma natureza de uma
 * string formatada. Daí o nome dizer "para planilha" — a função existe para ser
 * difícil de usar por engano em outro lugar.
 *
 * Parente próximo de `formatarDataOperacional`: as duas existem porque data,
 * instante e hora local são três coisas diferentes, e tratá-las como uma só foi
 * o defeito da Sprint 5.
 */
export function comoRelogioLocalParaPlanilha(instante: Date): Date {
  const { ano, mes, dia, hora, minuto, segundo } = partesNoFusoOperacao(instante);
  return new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo));
}

/**
 * Converte uma data operacional `AAAA-MM-DD` no `Date` que o Excel entende
 * como aquele dia: meia-noite **UTC**, que é exatamente como a coluna `date`
 * volta do Prisma. Passar por fuso aqui adiantaria ou atrasaria o dia.
 */
export function comoDataParaPlanilha(data: Date | string): Date {
  if (typeof data === 'string') return new Date(`${data}T00:00:00Z`);
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), 0, 0, 0));
}

/** `AAAA-MM-DD` a partir de uma coluna `date`, sem conversão de fuso. */
export function comoDataIso(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${data.getUTCFullYear()}-${mes}-${dia}`;
}

/** `23/08/2026` — para **instantes** (`timestamptz`), convertendo o fuso. */
export function formatarData(instante: Date): string {
  const { ano, mes, dia } = partesNoFusoOperacao(instante);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

/** `07:15` */
export function formatarHora(instante: Date): string {
  const { hora, minuto } = partesNoFusoOperacao(instante);
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

/** `23/08/2026 07:15` */
export function formatarDataHora(instante: Date): string {
  return `${formatarData(instante)} ${formatarHora(instante)}`;
}

/** Diferença em minutos inteiros, arredondada para baixo. */
export function diferencaEmMinutos(inicio: Date, fim: Date): number {
  return Math.floor((fim.getTime() - inicio.getTime()) / 60_000);
}

/** `1h 23min` · `45min` · `0min` */
export function formatarDuracao(minutos: number): string {
  if (minutos < 0) return '0min';
  const horas = Math.floor(minutos / 60);
  const restante = minutos % 60;
  if (horas === 0) return `${restante}min`;
  if (restante === 0) return `${horas}h`;
  return `${horas}h ${restante}min`;
}

/** Quantidade de dias entre duas datas operacionais, inclusive as pontas. */
export function diasNoPeriodo(dataInicio: string, dataFim: string): number {
  const inicio = inicioDoDia(dataInicio).getTime();
  const fim = inicioDoDia(dataFim).getTime();
  return Math.floor((fim - inicio) / 86_400_000) + 1;
}

/** Soma dias a uma data operacional, devolvendo `AAAA-MM-DD`. */
export function somarDias(dataIso: string, dias: number): string {
  const base = inicioDoDia(dataIso);
  return dataOperacional(new Date(base.getTime() + dias * 86_400_000));
}
