import { CodigoErro, ErroDeConflito, ErroDeNegocio, ErroDePermissao } from '@/lib/erros';
import { diferencaEmMinutos } from '@/utilitarios/data';
import { arredondar } from '@/utilitarios/numero';

/**
 * Regras da corrida (doc 06 · RN014 a RN020) e da janela de correção (RN019).
 */

/** Janela padrão de correção pelo motorista, em horas (RN019 · V-13). */
export const JANELA_EDICAO_HORAS_PADRAO = 12;

/** Mínimo exigido na justificativa de correção (RN019). */
export const TAMANHO_MINIMO_JUSTIFICATIVA = 10;

export type StatusCorrida = 'EM_ANDAMENTO' | 'ENCERRADA' | 'CANCELADA';

// -------------------------------------------------------------------- início

/** RN020 — a próxima viagem não volta ao odômetro anterior a um dia reaberto. */
export function odometroParaProximaCorrida(
  odometroInicialDaJornada: number,
  maiorOdometroDasCorridas: number | null,
  odometroAtualDoVeiculo: number,
): number {
  return Math.max(odometroInicialDaJornada, maiorOdometroDasCorridas ?? 0, odometroAtualDoVeiculo);
}

export interface ContextoDeInicio {
  temCorridaEmAndamento: boolean;
  rotaId: string | null;
  origemDescricao: string | null;
  destinoDescricao: string | null;
  rotaEstaAtiva: boolean | null;
}

/**
 * RN014 — corrida só existe dentro de jornada aberta.
 *
 * Separada de `validarInicioDeCorrida` porque a mensagem precisa ser diferente:
 * aqui o caminho de saída é abrir o dia, não encerrar outra corrida.
 */
export function exigirJornadaAbertaParaCorrida(temJornadaAberta: boolean): void {
  if (temJornadaAberta) return;

  throw new ErroDeConflito(
    CodigoErro.JORNADA_NAO_ABERTA,
    'Inicie seu dia antes de registrar uma corrida.',
  );
}

/**
 * RN014, RN021 — uma corrida por vez, e origem/destino obrigatórios quando não
 * há rota cadastrada (corrida avulsa).
 */
export function validarInicioDeCorrida(contexto: ContextoDeInicio): void {
  if (contexto.temCorridaEmAndamento) {
    throw new ErroDeConflito(
      CodigoErro.CORRIDA_JA_EM_ANDAMENTO,
      'Você já tem uma corrida em andamento. Encerre-a para iniciar outra.',
    );
  }

  if (contexto.rotaId === null) {
    const semOrigem = !contexto.origemDescricao?.trim();
    const semDestino = !contexto.destinoDescricao?.trim();

    if (semOrigem || semDestino) {
      throw new ErroDeNegocio(
        CodigoErro.DADOS_INVALIDOS,
        'Escolha uma rota ou informe origem e destino.',
        {
          ...(semOrigem ? { origemDescricao: 'Informe a origem.' } : {}),
          ...(semDestino ? { destinoDescricao: 'Informe o destino.' } : {}),
        },
      );
    }
    return;
  }

  if (contexto.rotaEstaAtiva === false) {
    throw new ErroDeNegocio(CodigoErro.ROTA_INATIVA, 'Esta rota não está mais disponível.', {
      rotaId: 'Selecione outra rota.',
    });
  }
}

// --------------------------------------------------------------- encerramento

export interface ContextoDeEncerramento {
  status: StatusCorrida;
  iniciadaEm: Date;
  encerradaEm: Date;
  odometroInicial: number | null;
  odometroFinal: number;
  quantidadePassageiros: number | null;
  capacidadeDoVeiculo: number;
  confirmaExcessoPassageiros: boolean;
}

export interface ResultadoDoEncerramento {
  kmPercorrido: number;
  duracaoMinutos: number;
}

/**
 * RN016, RN018, RN020 — valida a coerência do encerramento e devolve os totais
 * calculados. O cliente pode enviar `kmPercorrido`; ele é ignorado, porque
 * quilometragem é resultado de cálculo, não de digitação.
 */
export function encerrarCorrida(contexto: ContextoDeEncerramento): ResultadoDoEncerramento {
  if (contexto.status !== 'EM_ANDAMENTO') {
    throw new ErroDeConflito(
      CodigoErro.CORRIDA_JA_ENCERRADA,
      'Esta corrida já foi encerrada ou cancelada.',
    );
  }

  if (contexto.encerradaEm.getTime() <= contexto.iniciadaEm.getTime()) {
    throw new ErroDeNegocio(
      CodigoErro.HORARIO_INVALIDO,
      'O horário de encerramento precisa ser posterior ao de início.',
    );
  }

  if (!Number.isInteger(contexto.odometroFinal) || contexto.odometroFinal < 0) {
    throw new ErroDeNegocio(
      CodigoErro.ODOMETRO_INCOERENTE,
      'Informe o odômetro em quilômetros inteiros.',
      { odometroFinal: 'Valor inválido.' },
    );
  }

  const inicial = contexto.odometroInicial;
  if (inicial !== null && contexto.odometroFinal < inicial) {
    throw new ErroDeNegocio(
      CodigoErro.ODOMETRO_MENOR_QUE_INICIAL,
      `O odômetro final não pode ser menor que ${inicial.toLocaleString('pt-BR')} km, registrado no início da corrida.`,
      { odometroFinal: `Valor mínimo: ${inicial} km` },
    );
  }

  const passageiros = contexto.quantidadePassageiros;
  if (
    passageiros !== null &&
    passageiros > contexto.capacidadeDoVeiculo &&
    !contexto.confirmaExcessoPassageiros
  ) {
    throw new ErroDeNegocio(
      CodigoErro.EXCESSO_PASSAGEIROS_NAO_CONFIRMADO,
      `A quantidade informada excede a capacidade da van (${contexto.capacidadeDoVeiculo} lugares). Confirme para prosseguir.`,
      { quantidadePassageiros: 'Confirme o valor informado.' },
    );
  }

  return {
    kmPercorrido: inicial === null ? 0 : arredondar(contexto.odometroFinal - inicial, 2),
    duracaoMinutos: diferencaEmMinutos(contexto.iniciadaEm, contexto.encerradaEm),
  };
}

// ---------------------------------------------------------------- eventos

/** RN016 — evento não pode ser anterior ao início nem posterior ao fim. */
export function validarHorarioDoEvento(
  ocorridoEm: Date,
  iniciadaEm: Date,
  encerradaEm: Date | null,
): void {
  if (ocorridoEm.getTime() < iniciadaEm.getTime()) {
    throw new ErroDeNegocio(
      CodigoErro.HORARIO_INVALIDO,
      'O horário do registro é anterior ao início da corrida.',
    );
  }

  if (encerradaEm !== null && ocorridoEm.getTime() > encerradaEm.getTime()) {
    throw new ErroDeNegocio(
      CodigoErro.HORARIO_INVALIDO,
      'O horário do registro é posterior ao encerramento da corrida.',
    );
  }
}

/** RN016 — corridas do mesmo motorista não podem se sobrepor no tempo. */
export function existeSobreposicao(
  novaInicio: Date,
  novaFim: Date | null,
  existentes: readonly { iniciadaEm: Date; encerradaEm: Date | null }[],
): boolean {
  const fimNova = novaFim?.getTime() ?? Number.POSITIVE_INFINITY;
  const inicioNova = novaInicio.getTime();

  return existentes.some((corrida) => {
    const inicio = corrida.iniciadaEm.getTime();
    const fim = corrida.encerradaEm?.getTime() ?? Number.POSITIVE_INFINITY;
    return inicioNova < fim && inicio < fimNova;
  });
}

// ---------------------------------------------------------------- correção

export interface ContextoDeCorrecao {
  perfil: 'ADMIN' | 'MOTORISTA';
  encerradaEm: Date | null;
  agora: Date;
  justificativa: string;
  janelaHoras?: number;
}

/**
 * A ação "Corrigir" deve aparecer? (US022 · RN019)
 *
 * Espelha `validarCorrecao` do lado da **interface**. As duas existem porque
 * respondem a perguntas diferentes: esta decide o que mostrar, aquela decide o
 * que aceitar. Só a segunda protege o dado — mas mostrar um botão que a
 * primeira já sabe que vai ser recusado é convidar o motorista à frustração.
 */
export function podeCorrigirAgora(parametros: {
  perfil: 'ADMIN' | 'MOTORISTA';
  encerradaEm: Date | null;
  agora: Date;
  janelaHoras?: number;
}): boolean {
  if (parametros.perfil === 'ADMIN') return true;
  if (parametros.encerradaEm === null) return false;

  const janelaHoras = parametros.janelaHoras ?? JANELA_EDICAO_HORAS_PADRAO;
  const limite = parametros.encerradaEm.getTime() + janelaHoras * 60 * 60 * 1000;

  return parametros.agora.getTime() <= limite;
}

/**
 * RN020 — o odômetro corrigido continua sendo o fim de um trecho que começou
 * no `odometroInicial` da corrida.
 *
 * Corrigir não é reabrir: o início permanece onde estava, e um valor final
 * abaixo dele produziria km negativo, que contaminaria o total da jornada e o
 * consolidado do dia.
 */
export function validarOdometroDeCorrecao(
  odometroInicial: number | null,
  odometroFinal: number,
): void {
  if (!Number.isInteger(odometroFinal) || odometroFinal < 0) {
    throw new ErroDeNegocio(
      CodigoErro.ODOMETRO_INCOERENTE,
      'Informe o odômetro em quilômetros inteiros.',
      { odometroFinal: 'Valor inválido.' },
    );
  }

  if (odometroInicial !== null && odometroFinal < odometroInicial) {
    throw new ErroDeNegocio(
      CodigoErro.ODOMETRO_MENOR_QUE_INICIAL,
      `O odômetro final não pode ser menor que ${odometroInicial.toLocaleString('pt-BR')} km, ` +
        'registrado no início da corrida.',
      { odometroFinal: `Valor mínimo: ${odometroInicial} km` },
    );
  }
}

/**
 * RN019 — o administrador corrige a qualquer momento; o motorista, apenas
 * dentro da janela. Em ambos os casos a justificativa é obrigatória, porque é
 * ela que dá sentido ao "valor anterior" guardado na auditoria.
 */
export function validarCorrecao(contexto: ContextoDeCorrecao): void {
  const justificativa = contexto.justificativa.trim();

  if (justificativa.length < TAMANHO_MINIMO_JUSTIFICATIVA) {
    throw new ErroDeNegocio(
      CodigoErro.JUSTIFICATIVA_OBRIGATORIA,
      `Descreva o motivo da correção (mínimo de ${TAMANHO_MINIMO_JUSTIFICATIVA} caracteres).`,
      { justificativa: 'Justificativa muito curta.' },
    );
  }

  if (contexto.perfil === 'ADMIN') return;

  if (contexto.encerradaEm === null) return;

  const janelaHoras = contexto.janelaHoras ?? JANELA_EDICAO_HORAS_PADRAO;
  const limite = contexto.encerradaEm.getTime() + janelaHoras * 60 * 60 * 1000;

  if (contexto.agora.getTime() > limite) {
    throw new ErroDePermissao(
      CodigoErro.FORA_DA_JANELA_DE_EDICAO,
      'O prazo para corrigir este registro expirou. Procure o administrador.',
    );
  }
}

/** RN024 — cancelamento exige motivo, como qualquer ação irreversível. */
export function validarCancelamento(motivo: string): void {
  if (motivo.trim().length < TAMANHO_MINIMO_JUSTIFICATIVA) {
    throw new ErroDeNegocio(
      CodigoErro.JUSTIFICATIVA_OBRIGATORIA,
      `Descreva o motivo do cancelamento (mínimo de ${TAMANHO_MINIMO_JUSTIFICATIVA} caracteres).`,
      { motivo: 'Motivo muito curto.' },
    );
  }
}
