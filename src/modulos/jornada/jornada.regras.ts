import { CodigoErro, ErroDeConflito, ErroDeNegocio } from '@/lib/erros';
import { arredondar } from '@/utilitarios/numero';
import { diferencaEmMinutos } from '@/utilitarios/data';

/**
 * Regras da jornada — o "dia" do motorista (doc 06 · RN012 a RN020).
 *
 * Funções puras. Nenhuma delas conhece Prisma ou HTTP: recebem o estado já
 * carregado e devolvem a decisão ou os totais.
 */

/** Divergência acima disso exige confirmação explícita (RN015). Configurável. */
export const TOLERANCIA_ODOMETRO_KM_PADRAO = 500;

export type StatusJornada = 'ABERTA' | 'ENCERRADA' | 'CANCELADA';

// ------------------------------------------------------------------ odômetro

export interface ContextoDeAbertura {
  odometroInformado: number;
  /** Último odômetro conhecido do veículo. */
  odometroAtualDoVeiculo: number;
  confirmaDivergencia: boolean;
  toleranciaKm?: number;
}

/**
 * RN015 e RN020 — o odômetro nunca retrocede, e um salto muito grande é
 * provavelmente erro de digitação.
 *
 * A tolerância não bloqueia: pede confirmação. Bloquear inviabilizaria o caso
 * legítimo de uma van que rodou fora do sistema (manutenção, transferência).
 */
export function validarOdometroDeAbertura(contexto: ContextoDeAbertura): void {
  const { odometroInformado, odometroAtualDoVeiculo, confirmaDivergencia } = contexto;
  const tolerancia = contexto.toleranciaKm ?? TOLERANCIA_ODOMETRO_KM_PADRAO;

  if (!Number.isInteger(odometroInformado) || odometroInformado < 0) {
    throw new ErroDeNegocio(
      CodigoErro.ODOMETRO_INCOERENTE,
      'Informe o odômetro em quilômetros inteiros.',
      { odometroInicial: 'Valor inválido.' },
    );
  }

  if (odometroInformado < odometroAtualDoVeiculo) {
    throw new ErroDeNegocio(
      CodigoErro.ODOMETRO_MENOR_QUE_ULTIMO,
      `O odômetro não pode ser menor que ${odometroAtualDoVeiculo.toLocaleString('pt-BR')} km, último valor registrado para esta van.`,
      { odometroInicial: `Último valor registrado: ${odometroAtualDoVeiculo} km` },
    );
  }

  const diferenca = odometroInformado - odometroAtualDoVeiculo;
  if (diferenca > tolerancia && !confirmaDivergencia) {
    throw new ErroDeNegocio(
      CodigoErro.DIVERGENCIA_ODOMETRO_NAO_CONFIRMADA,
      `A diferença de ${diferenca.toLocaleString('pt-BR')} km é maior que o esperado. Confirme para prosseguir.`,
      { odometroInicial: 'Confirme o valor informado.' },
    );
  }
}

/** RN020 — o odômetro final da jornada precisa fechar com o que foi rodado. */
export function validarOdometroDeEncerramento(
  odometroFinal: number,
  odometroInicialDaJornada: number,
  maiorOdometroRegistradoNasCorridas: number | null,
  odometroAtualDoVeiculo = 0,
): void {
  const piso = Math.max(
    odometroInicialDaJornada,
    maiorOdometroRegistradoNasCorridas ?? 0,
    odometroAtualDoVeiculo,
  );

  if (!Number.isInteger(odometroFinal) || odometroFinal < 0) {
    throw new ErroDeNegocio(
      CodigoErro.ODOMETRO_INCOERENTE,
      'Informe o odômetro em quilômetros inteiros.',
      { odometroFinal: 'Valor inválido.' },
    );
  }

  if (odometroFinal < piso) {
    throw new ErroDeNegocio(
      CodigoErro.ODOMETRO_INCOERENTE,
      `O odômetro final não pode ser menor que ${piso.toLocaleString('pt-BR')} km.`,
      { odometroFinal: `Valor mínimo esperado: ${piso} km` },
    );
  }
}

// ------------------------------------------------------------------ sequência

export interface EstadoDaJornada {
  status: StatusJornada;
  temCorridaEmAndamento: boolean;
}

/** RN014 — corrida só existe dentro de jornada aberta. */
export function exigirJornadaAberta(estado: Pick<EstadoDaJornada, 'status'>): void {
  if (estado.status === 'ABERTA') return;

  if (estado.status === 'ENCERRADA') {
    throw new ErroDeConflito(CodigoErro.JORNADA_JA_ENCERRADA, 'Este dia já foi encerrado.');
  }

  throw new ErroDeConflito(
    CodigoErro.JORNADA_NAO_ABERTA,
    'Inicie seu dia antes de registrar uma corrida.',
  );
}

/** RN014 — não se encerra o dia com corrida aberta. */
export function validarEncerramentoDaJornada(estado: EstadoDaJornada): void {
  if (estado.status !== 'ABERTA') {
    throw new ErroDeConflito(CodigoErro.JORNADA_JA_ENCERRADA, 'Este dia já foi encerrado.');
  }

  if (estado.temCorridaEmAndamento) {
    throw new ErroDeConflito(
      CodigoErro.CORRIDA_EM_ANDAMENTO,
      'Encerre a corrida em andamento antes de finalizar o dia.',
    );
  }
}

// --------------------------------------------------------------------- totais

export interface CorridaConsolidavel {
  kmPercorrido: number | null;
  duracaoMinutos: number | null;
  quantidadePassageiros: number | null;
  status: 'EM_ANDAMENTO' | 'ENCERRADA' | 'CANCELADA';
}

export interface TotaisDaJornada {
  totalCorridas: number;
  kmTotal: number;
  totalPassageiros: number;
  duracaoMinutos: number;
}

/**
 * RN018 — totais são **calculados** pelo sistema, nunca digitados.
 *
 * Corridas canceladas ficam de fora: elas existem para rastreabilidade, não
 * para compor quilometragem. Somar km de corrida cancelada inflaria o relatório
 * de custo por rota, que é justamente uma das razões do projeto.
 */
export function calcularTotaisDaJornada(
  corridas: readonly CorridaConsolidavel[],
  iniciadaEm: Date,
  encerradaEm: Date,
): TotaisDaJornada {
  const consideradas = corridas.filter((corrida) => corrida.status === 'ENCERRADA');

  const kmTotal = consideradas.reduce((soma, corrida) => soma + (corrida.kmPercorrido ?? 0), 0);
  const totalPassageiros = consideradas.reduce(
    (soma, corrida) => soma + (corrida.quantidadePassageiros ?? 0),
    0,
  );

  return {
    totalCorridas: consideradas.length,
    kmTotal: arredondar(kmTotal, 2),
    totalPassageiros,
    duracaoMinutos: Math.max(0, diferencaEmMinutos(iniciadaEm, encerradaEm)),
  };
}

// ------------------------------------------------------------------- veículo

export type StatusVeiculo = 'ATIVO' | 'INATIVO' | 'MANUTENCAO';

/** RN013 — só veículo ativo e livre pode iniciar uma jornada. */
export function validarVeiculoParaJornada(
  status: StatusVeiculo,
  jaEstaEmJornadaAberta: boolean,
): void {
  if (status !== 'ATIVO') {
    throw new ErroDeNegocio(
      CodigoErro.VEICULO_INATIVO,
      'Este veículo não está disponível para uso.',
      { veiculoId: 'Selecione outro veículo.' },
    );
  }

  if (jaEstaEmJornadaAberta) {
    throw new ErroDeConflito(
      CodigoErro.VEICULO_EM_USO,
      'Esta van já está em uma jornada em andamento.',
      { veiculoId: 'Selecione outro veículo.' },
    );
  }
}

// ------------------------------------------------------------ horário do registro

/** Diferença tolerada entre o relógio do celular e o do servidor. */
export const TOLERANCIA_RELOGIO_MS = 2 * 60_000;

/** Até quanto tempo depois um registro feito sem sinal ainda traz o horário do celular. */
export const ATRASO_MAXIMO_DA_SINCRONIZACAO_MS = 48 * 60 * 60_000;

export interface HorarioDoRegistro {
  instante: Date;
  /** O horário veio do celular e deve ser conferido no fechamento. */
  peloAparelho: boolean;
}

/**
 * Qual horário vale para abrir ou encerrar o dia.
 *
 * Online, vale o servidor. Registrado sem sinal, o celular guarda o horário em
 * que o motorista tocou e o envia depois — e é esse que importa para a hora
 * extra: quem abriu o dia às 05:50 sem internet e sincronizou às 07:00 começou
 * às 05:50. Antes, o sistema gravava 07:00.
 *
 * O relógio do celular pode estar errado ou ter sido mudado, então ele só vale
 * dentro de limites — nunca no futuro, no máximo 48 h antes do envio, nunca
 * antes de `minimo` (o encerramento não pode ser anterior à abertura) — e o dia
 * fica marcado para conferência. Fora dos limites vale o servidor, como sempre.
 * Até 2 min de diferença é o mesmo instante, com relógios levemente diferentes.
 */
export function horarioDoRegistro(
  agora: Date,
  ocorridoEmIso: string | undefined,
  minimo?: Date,
): HorarioDoRegistro {
  const servidor = { instante: agora, peloAparelho: false };
  if (!ocorridoEmIso) return servidor;

  const ocorrido = Date.parse(ocorridoEmIso);
  if (!Number.isFinite(ocorrido)) return servidor;

  const diferenca = agora.getTime() - ocorrido;
  if (diferenca < -TOLERANCIA_RELOGIO_MS) return servidor;
  if (diferenca > ATRASO_MAXIMO_DA_SINCRONIZACAO_MS) return servidor;
  if (minimo && ocorrido < minimo.getTime()) return servidor;
  if (Math.abs(diferenca) <= TOLERANCIA_RELOGIO_MS) return servidor;

  return { instante: new Date(ocorrido), peloAparelho: true };
}

// ------------------------------------------------------------------ reabertura

export interface SituacaoParaReabrir {
  status: StatusJornada;
  /** Data operacional da jornada e de hoje (`AAAA-MM-DD`). */
  dataDaJornada: string;
  hoje: string;
  motoristaTemOutroDiaAberto: boolean;
  vanEmUsoPorOutro: boolean;
}

/**
 * Reabrir o dia (caso do motorista que encerrou o dia em vez da corrida, 08/10).
 *
 * Continua valendo uma jornada por motorista por dia (RN012): reabrir devolve
 * o mesmo dia, e as corridas novas entram nele. Só o dia de hoje — reabrir um
 * dia passado não deixaria ninguém voltar ao trabalho, só bagunçaria o
 * fechamento — e só se nem o motorista nem a van já estiverem em outro dia.
 */
export function validarReabertura(situacao: SituacaoParaReabrir): void {
  if (situacao.status !== 'ENCERRADA') {
    throw new ErroDeConflito(
      CodigoErro.JORNADA_NAO_ENCERRADA,
      'Só um dia encerrado pode ser reaberto.',
    );
  }
  if (situacao.dataDaJornada !== situacao.hoje) {
    throw new ErroDeConflito(
      CodigoErro.JORNADA_JA_ENCERRADA,
      'Só o dia de hoje pode ser reaberto. Para corrigir um dia anterior, corrija as corridas.',
    );
  }
  if (situacao.motoristaTemOutroDiaAberto) {
    throw new ErroDeConflito(
      CodigoErro.JORNADA_JA_ABERTA,
      'O motorista já tem um dia em aberto. Encerre esse dia antes.',
    );
  }
  if (situacao.vanEmUsoPorOutro) {
    throw new ErroDeConflito(
      CodigoErro.VEICULO_EM_USO,
      'A van deste dia está em uso por outro motorista agora.',
    );
  }
}
