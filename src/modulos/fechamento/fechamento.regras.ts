import {
  dataOperacional,
  deHoraLocalParaUtc,
  formatarDataOperacional,
  formatarHora,
  somarDias,
} from '@/utilitarios/data';

/**
 * Regras do fechamento mensal (observações do cliente de 07/10/2026).
 *
 * Duas contas sobre os mesmos registros, para destinatários diferentes:
 *
 * - **Pagamento dos motoristas:** a diária de hora extra (um valor por dia, não
 *   por hora) e o km excedente do dia.
 * - **Boletim de medição:** o que a empresa cobra de cada cliente por van —
 *   dias normais, km excedido e extras de sábado, domingo e feriado.
 *
 * Tudo aqui é puro: instantes, feriados e tarifas entram por parâmetro. Os
 * valores vêm de Configurações e do contrato da van; nenhum está fixo no código.
 * Dinheiro é calculado em centavos e só vira reais no fim, para a soma de
 * muitas linhas não acumular erro de arredondamento.
 */

// ------------------------------------------------------------ ciclo

export interface Ciclo {
  /** Primeiro dia, inclusive (`AAAA-MM-DD`). */
  inicio: string;
  /** Último dia, inclusive. */
  fim: string;
}

function partesDaData(dataIso: string): [number, number, number] {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return [ano ?? 1970, mes ?? 1, dia ?? 1];
}

function montarData(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * O ciclo que contém a data: do `diaInicio` até a véspera dele no mês seguinte.
 * Com 16, 07/10 está no ciclo de 16/09 a 15/10, e 16/10 abre o de 16/10 a 15/11.
 */
export function cicloQueContem(dataIso: string, diaInicio: number): Ciclo {
  const [ano, mes, dia] = partesDaData(dataIso);
  const [anoInicio, mesInicio] =
    dia >= diaInicio ? [ano, mes] : mes === 1 ? [ano - 1, 12] : [ano, mes - 1];
  const inicio = montarData(anoInicio, mesInicio, diaInicio);
  const [anoSeguinte, mesSeguinte] =
    mesInicio === 12 ? [anoInicio + 1, 1] : [anoInicio, mesInicio + 1];
  const fim = somarDias(montarData(anoSeguinte, mesSeguinte, diaInicio), -1);
  return { inicio, fim };
}

export function cicloAnterior(ciclo: Ciclo, diaInicio: number): Ciclo {
  return cicloQueContem(somarDias(ciclo.inicio, -1), diaInicio);
}

export function datasDoCiclo(ciclo: Ciclo): string[] {
  const datas: string[] = [];
  for (let data = ciclo.inicio; data <= ciclo.fim; data = somarDias(data, 1)) datas.push(data);
  return datas;
}

export function rotuloDoCiclo(ciclo: Ciclo): string {
  return `${formatarDataOperacional(ciclo.inicio)} a ${formatarDataOperacional(ciclo.fim)}`;
}

// ------------------------------------------------------------ tipo de dia

export type TipoDeDia = 'NORMAL' | 'EXTRA';

export function diaDaSemana(dataIso: string): number {
  return new Date(`${dataIso}T12:00:00Z`).getUTCDay();
}

/** Sábado, domingo e feriado cadastrado são "extra" (S/D/F); o resto é normal. */
export function tipoDoDia(dataIso: string, feriados: ReadonlySet<string>): TipoDeDia {
  const semana = diaDaSemana(dataIso);
  return semana === 0 || semana === 6 || feriados.has(dataIso) ? 'EXTRA' : 'NORMAL';
}

// ------------------------------------------------------------ hora extra

export interface RegrasDeHoraExtra {
  limiteEntrada: string;
  saidaSegQui: string;
  saidaSexDom: string;
  saidaFeriado: string;
  noturnoInicio: string;
  noturnoFim: string;
  exigeAmbas: boolean;
  /** Valor da diária, em reais. */
  valorDiaria: number;
}

/** Horário de saída de referência do turno de dia. */
export function saidaDeReferencia(
  dataIso: string,
  feriados: ReadonlySet<string>,
  regras: RegrasDeHoraExtra,
): string {
  if (feriados.has(dataIso)) return regras.saidaFeriado;
  const semana = diaDaSemana(dataIso);
  // Domingo (0), sexta (5) e sábado (6) saem mais cedo.
  return semana === 0 || semana >= 5 ? regras.saidaSexDom : regras.saidaSegQui;
}

function instanteLocal(dataIso: string, horario: string): Date {
  const [ano, mes, dia] = partesDaData(dataIso);
  const [hora, minuto] = horario.split(':').map(Number);
  return deHoraLocalParaUtc(ano, mes, dia, hora ?? 0, minuto ?? 0);
}

function minutosEntre(de: Date, ate: Date): number {
  return Math.max(0, Math.floor((ate.getTime() - de.getTime()) / 60_000));
}

export interface DiaParaHoraExtra {
  data: string;
  iniciadaEm: Date;
  encerradaEm: Date | null;
  /** Escalado no turno da noite: a referência é 18h às 7h do dia seguinte. */
  noturno: boolean;
  inicioPeloAparelho: boolean;
  fimPeloAparelho: boolean;
}

export interface AvaliacaoDeHoraExtra {
  referenciaEntrada: string;
  referenciaSaida: string;
  entrada: string;
  saida: string | null;
  minutosAntes: number;
  minutosDepois: number;
  temDiaria: boolean;
  /** Em reais. */
  valor: number;
  /** O dia ainda está aberto: a saída não é conhecida. */
  pendente: boolean;
  /** Motivos para a administração conferir este dia antes de pagar. */
  conferir: string[];
}

/**
 * A diária de hora extra de um dia.
 *
 * Conta por dia, não por minuto: quem entrou antes do limite ou saiu depois do
 * horário recebe uma diária (ou, se `exigeAmbas`, só quem fez as duas coisas).
 * Os minutos ficam na planilha para conferência, mas não multiplicam o valor.
 *
 * Dia ainda aberto não tem saída conhecida: fica pendente, e só já conta a
 * diária se a entrada antecipada bastar sozinha. Dia encerrado depois da meia-
 * noite seguinte — o esquecido aberto — vai para conferência, porque o horário
 * do encerramento não é o do fim real do trabalho.
 */
export function avaliarHoraExtra(
  dia: DiaParaHoraExtra,
  feriados: ReadonlySet<string>,
  regras: RegrasDeHoraExtra,
): AvaliacaoDeHoraExtra {
  const referenciaEntrada = dia.noturno ? regras.noturnoInicio : regras.limiteEntrada;
  const referenciaSaida = dia.noturno
    ? regras.noturnoFim
    : saidaDeReferencia(dia.data, feriados, regras);
  const dataDaSaida = dia.noturno ? somarDias(dia.data, 1) : dia.data;

  const minutosAntes = minutosEntre(dia.iniciadaEm, instanteLocal(dia.data, referenciaEntrada));
  const minutosDepois = dia.encerradaEm
    ? minutosEntre(instanteLocal(dataDaSaida, referenciaSaida), dia.encerradaEm)
    : 0;

  const pendente = dia.encerradaEm === null;
  const entrouCedo = minutosAntes > 0;
  const saiuTarde = minutosDepois > 0;
  const temDiaria = regras.exigeAmbas ? entrouCedo && saiuTarde : entrouCedo || saiuTarde;

  const conferir: string[] = [];
  if (dia.inicioPeloAparelho) conferir.push('início pelo horário do celular');
  if (dia.fimPeloAparelho) conferir.push('fim pelo horário do celular');
  if (pendente) conferir.push('dia ainda aberto');
  if (dia.encerradaEm && dataOperacional(dia.encerradaEm) > dataDaSaida) {
    conferir.push(
      `encerrado só em ${formatarDataOperacional(dataOperacional(dia.encerradaEm))} às ` +
        `${formatarHora(dia.encerradaEm)}`,
    );
  }

  return {
    referenciaEntrada,
    referenciaSaida,
    entrada: formatarHora(dia.iniciadaEm),
    saida: dia.encerradaEm ? formatarHora(dia.encerradaEm) : null,
    minutosAntes,
    minutosDepois,
    temDiaria,
    valor: temDiaria ? regras.valorDiaria : 0,
    pendente,
    conferir,
  };
}

// ------------------------------------------------------------ km excedente

/**
 * Km do dia pela diferença dos odômetros, menos o rodado entre uma corrida e
 * outra (`kmEntreCorridas`); nulo enquanto o dia não fecha.
 */
export function kmDoDia(
  odometroInicial: number,
  odometroFinal: number | null,
  descontar = 0,
): number | null {
  if (odometroFinal === null) return null;
  return Math.max(0, odometroFinal - odometroInicial - descontar);
}

export interface TrechoDaCorrida {
  odometroInicial: number | null;
  odometroFinal: number | null;
}

/**
 * Km que a van rodou entre o fim de uma corrida e o início da seguinte.
 *
 * Cada corrida começa no odômetro em que a anterior terminou, então esse
 * intervalo só aparece quando o fim de uma corrida é corrigido para baixo
 * depois de a seguinte começar — o motorista tinha lançado nela um km que não
 * era do serviço — ou quando outro dia mexeu no odômetro da van no meio deste.
 * Km fora das corridas não conta no fechamento (cliente, 09/10/2026).
 *
 * Recebe só as corridas encerradas; as sem odômetro ficam de fora.
 */
export function kmEntreCorridas(corridas: readonly TrechoDaCorrida[]): number {
  const trechos = corridas
    .flatMap(({ odometroInicial: inicio, odometroFinal: fim }) =>
      inicio === null || fim === null ? [] : [{ inicio, fim }],
    )
    .sort((a, b) => a.inicio - b.inicio);

  let total = 0;
  let anterior: { inicio: number; fim: number } | null = null;
  for (const trecho of trechos) {
    if (anterior) total += Math.max(0, trecho.inicio - anterior.fim);
    anterior = trecho;
  }
  return total;
}

export function kmExcedente(km: number | null, limite: number): number {
  return km === null ? 0 : Math.max(0, km - limite);
}

// ------------------------------------------------------------ dinheiro

export function emCentavos(reais: number): number {
  return Math.round(reais * 100);
}

export function emReais(centavos: number): number {
  return Math.round(centavos) / 100;
}

// ------------------------------------------------------------ pagamento dos motoristas

export interface LinhaDoMotorista {
  motoristaId: string;
  motorista: string;
  data: string;
  placa: string;
  noturno: boolean;
  horaExtra: AvaliacaoDeHoraExtra;
  km: number | null;
  kmExcedente: number;
  /** Em reais. */
  valorKm: number;
}

export interface ResumoDoMotorista {
  motoristaId: string;
  motorista: string;
  dias: number;
  diarias: number;
  valorHoraExtra: number;
  kmExcedente: number;
  valorKm: number;
  total: number;
  /** Dias com algo a conferir antes de pagar. */
  diasParaConferir: number;
}

export interface RegrasDeKm {
  limiteDia: number;
  /** Em reais, por km acima do limite. */
  valorPorKm: number;
}

/** Um dia de trabalho como o fechamento o recebe: já com o km, nulo se aberto. */
export interface DiaDoMotorista extends DiaParaHoraExtra {
  motoristaId: string;
  motorista: string;
  placa: string;
  km: number | null;
}

/**
 * Junta as jornadas do mesmo motorista no mesmo dia — manhã e tarde, troca de
 * van. A diária é uma por dia e o limite de km vale para o dia, não para cada
 * jornada: sem juntar, quem abriu duas jornadas receberia duas diárias.
 *
 * O dia começa na primeira entrada e termina na última saída, e fica aberto se
 * alguma jornada ainda estiver.
 */
export function juntarDiasDoMotorista(jornadas: readonly DiaDoMotorista[]): DiaDoMotorista[] {
  const porChave = new Map<string, DiaDoMotorista>();

  for (const jornada of jornadas) {
    const chave = `${jornada.motoristaId}|${jornada.data}`;
    const atual = porChave.get(chave);
    if (!atual) {
      porChave.set(chave, { ...jornada });
      continue;
    }
    const placas = new Set([...atual.placa.split(' / '), jornada.placa]);
    porChave.set(chave, {
      ...atual,
      placa: [...placas].join(' / '),
      iniciadaEm: jornada.iniciadaEm < atual.iniciadaEm ? jornada.iniciadaEm : atual.iniciadaEm,
      encerradaEm:
        atual.encerradaEm === null || jornada.encerradaEm === null
          ? null
          : jornada.encerradaEm > atual.encerradaEm
            ? jornada.encerradaEm
            : atual.encerradaEm,
      noturno: atual.noturno || jornada.noturno,
      inicioPeloAparelho: atual.inicioPeloAparelho || jornada.inicioPeloAparelho,
      fimPeloAparelho: atual.fimPeloAparelho || jornada.fimPeloAparelho,
      km: atual.km === null || jornada.km === null ? null : atual.km + jornada.km,
    });
  }

  return [...porChave.values()].sort(
    (a, b) => a.data.localeCompare(b.data) || a.motorista.localeCompare(b.motorista, 'pt-BR'),
  );
}

export function montarLinhaDoMotorista(
  dia: DiaDoMotorista,
  feriados: ReadonlySet<string>,
  regrasHoraExtra: RegrasDeHoraExtra,
  regrasKm: RegrasDeKm,
): LinhaDoMotorista {
  const km = dia.km;
  const excedente = kmExcedente(km, regrasKm.limiteDia);
  return {
    motoristaId: dia.motoristaId,
    motorista: dia.motorista,
    data: dia.data,
    placa: dia.placa,
    noturno: dia.noturno,
    horaExtra: avaliarHoraExtra(dia, feriados, regrasHoraExtra),
    km,
    kmExcedente: excedente,
    valorKm: emReais(excedente * emCentavos(regrasKm.valorPorKm)),
  };
}

export function resumirPorMotorista(linhas: readonly LinhaDoMotorista[]): ResumoDoMotorista[] {
  const porMotorista = new Map<
    string,
    ResumoDoMotorista & { centavosHe: number; centavosKm: number }
  >();

  for (const linha of linhas) {
    const atual = porMotorista.get(linha.motoristaId) ?? {
      motoristaId: linha.motoristaId,
      motorista: linha.motorista,
      dias: 0,
      diarias: 0,
      valorHoraExtra: 0,
      kmExcedente: 0,
      valorKm: 0,
      total: 0,
      diasParaConferir: 0,
      centavosHe: 0,
      centavosKm: 0,
    };
    atual.dias += 1;
    if (linha.horaExtra.temDiaria) atual.diarias += 1;
    atual.centavosHe += emCentavos(linha.horaExtra.valor);
    atual.kmExcedente += linha.kmExcedente;
    atual.centavosKm += emCentavos(linha.valorKm);
    if (linha.horaExtra.conferir.length > 0) atual.diasParaConferir += 1;
    porMotorista.set(linha.motoristaId, atual);
  }

  return [...porMotorista.values()]
    .map(({ centavosHe, centavosKm, ...resumo }) => ({
      ...resumo,
      valorHoraExtra: emReais(centavosHe),
      valorKm: emReais(centavosKm),
      total: emReais(centavosHe + centavosKm),
    }))
    .sort((a, b) => a.motorista.localeCompare(b.motorista, 'pt-BR'));
}

// ------------------------------------------------------------ boletim de medição

export type CategoriaDaMedicao = 'ONIBUS' | 'VAN_DIURNA' | 'VAN_NOTURNA';

export const ROTULO_DA_CATEGORIA: Record<CategoriaDaMedicao, string> = {
  ONIBUS: 'Ônibus',
  VAN_DIURNA: 'Van diurna',
  VAN_NOTURNA: 'Van noturna',
};

export interface ContratoDaVan {
  veiculoId: string;
  placa: string;
  cliente: string | null;
  categoria: CategoriaDaMedicao | null;
  /** Em reais; nulos quando o contrato não foi preenchido. */
  valorMensal: number | null;
  valorKmExcedido: number | null;
  valorDiaExtra: number | null;
  limiteKmDia: number | null;
  linhaOrigem: string | null;
  linhaDestino: string | null;
}

export interface MedicaoDaVan {
  contrato: ContratoDaVan;
  /** Dias trabalhados por tipo, em ordem. */
  diasNormais: string[];
  diasExtras: string[];
  /** Km excedido de cada dia trabalhado (só os que passaram do limite). */
  kmExcedidoPorDia: Record<string, number>;
  kmExcedido: number;
  /** Valor do dia normal, em reais, com todas as casas — como no boletim atual. */
  valorDia: number | null;
  valorNormal: number;
  valorKm: number;
  valorExtra: number;
  total: number;
  /** Motoristas que trabalharam na van no período, do mais frequente ao menos. */
  motoristas: string[];
  pendencias: string[];
}

export interface DiaDaVan {
  data: string;
  motorista: string;
  /** Nulo enquanto o dia não fecha. */
  km: number | null;
}

/**
 * A medição de uma van no ciclo.
 *
 * Dia trabalhado é dia com jornada na van; sábado, domingo e feriado vão para
 * "extra". O valor do dia normal é o mensal dividido pelo divisor (22 no boletim
 * atual). Contrato incompleto não zera nada em silêncio: a van entra com o que
 * dá para medir e a falta vai para `pendencias`.
 */
export function medirVan(
  contrato: ContratoDaVan,
  dias: readonly DiaDaVan[],
  feriados: ReadonlySet<string>,
  divisor: number,
  limitePadraoKm: number,
): MedicaoDaVan {
  const porData = new Map<string, number | null>();
  const vezesPorMotorista = new Map<string, number>();
  const pendencias: string[] = [];

  for (const dia of dias) {
    const anterior = porData.get(dia.data);
    // Duas jornadas no mesmo dia (manhã e tarde): os km se somam.
    porData.set(
      dia.data,
      anterior === undefined
        ? dia.km
        : anterior === null || dia.km === null
          ? null
          : anterior + dia.km,
    );
    vezesPorMotorista.set(dia.motorista, (vezesPorMotorista.get(dia.motorista) ?? 0) + 1);
  }

  const trabalhados = [...porData.keys()].sort();
  const diasNormais = trabalhados.filter((data) => tipoDoDia(data, feriados) === 'NORMAL');
  const diasExtras = trabalhados.filter((data) => tipoDoDia(data, feriados) === 'EXTRA');

  const limite = contrato.limiteKmDia ?? limitePadraoKm;
  const kmExcedidoPorDia: Record<string, number> = {};
  for (const data of trabalhados) {
    const km = porData.get(data) ?? null;
    if (km === null) {
      pendencias.push(`dia ${formatarDataOperacional(data)} ainda aberto: km desconhecido`);
      continue;
    }
    const excedido = kmExcedente(km, limite);
    if (excedido > 0) kmExcedidoPorDia[data] = excedido;
  }
  const kmExcedido = Object.values(kmExcedidoPorDia).reduce((soma, km) => soma + km, 0);

  if (!contrato.cliente) pendencias.push('sem cliente no contrato');
  if (contrato.valorMensal === null) pendencias.push('sem valor mensal');
  if (contrato.valorKmExcedido === null && kmExcedido > 0)
    pendencias.push('sem valor do km excedido');
  if (contrato.valorDiaExtra === null && diasExtras.length > 0)
    pendencias.push('sem valor do dia extra');

  const centavosNormal =
    contrato.valorMensal === null
      ? 0
      : Math.round((emCentavos(contrato.valorMensal) * diasNormais.length) / divisor);
  const centavosKm =
    contrato.valorKmExcedido === null ? 0 : kmExcedido * emCentavos(contrato.valorKmExcedido);
  const centavosExtra =
    contrato.valorDiaExtra === null ? 0 : diasExtras.length * emCentavos(contrato.valorDiaExtra);

  return {
    contrato,
    diasNormais,
    diasExtras,
    kmExcedidoPorDia,
    kmExcedido,
    valorDia: contrato.valorMensal === null ? null : contrato.valorMensal / divisor,
    valorNormal: emReais(centavosNormal),
    valorKm: emReais(centavosKm),
    valorExtra: emReais(centavosExtra),
    total: emReais(centavosNormal + centavosKm + centavosExtra),
    motoristas: [...vezesPorMotorista.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .map(([nome]) => nome),
    pendencias,
  };
}

export interface LinhaDoResumoDaMedicao {
  categoria: CategoriaDaMedicao | 'SEM_CATEGORIA';
  quantidade: number;
  diasNormais: number;
  valorNormal: number;
  kmExcedido: number;
  valorKm: number;
  diasExtras: number;
  valorExtra: number;
  total: number;
}

export interface ResumoDaMedicao {
  porCategoria: LinhaDoResumoDaMedicao[];
  totalVeiculos: number;
  totalPedagios: number;
  totalGeral: number;
}

/** O quadro do fim do boletim: totais por categoria, pedágios e total geral. */
export function resumirMedicao(
  vans: readonly MedicaoDaVan[],
  totalPedagios: number,
): ResumoDaMedicao {
  const ordem: (CategoriaDaMedicao | 'SEM_CATEGORIA')[] = [
    'ONIBUS',
    'VAN_DIURNA',
    'VAN_NOTURNA',
    'SEM_CATEGORIA',
  ];
  const porCategoria = ordem
    .map((categoria) => {
      const daCategoria = vans.filter(
        (van) => (van.contrato.categoria ?? 'SEM_CATEGORIA') === categoria,
      );
      const soma = (f: (van: MedicaoDaVan) => number) =>
        daCategoria.reduce((total, van) => total + f(van), 0);
      return {
        categoria,
        quantidade: daCategoria.length,
        diasNormais: soma((van) => van.diasNormais.length),
        valorNormal: emReais(soma((van) => emCentavos(van.valorNormal))),
        kmExcedido: soma((van) => van.kmExcedido),
        valorKm: emReais(soma((van) => emCentavos(van.valorKm))),
        diasExtras: soma((van) => van.diasExtras.length),
        valorExtra: emReais(soma((van) => emCentavos(van.valorExtra))),
        total: emReais(soma((van) => emCentavos(van.total))),
      };
    })
    .filter((linha) => linha.quantidade > 0);

  const totalVeiculos = emReais(vans.reduce((soma, van) => soma + emCentavos(van.total), 0));
  return {
    porCategoria,
    totalVeiculos,
    totalPedagios,
    totalGeral: emReais(emCentavos(totalVeiculos) + emCentavos(totalPedagios)),
  };
}
