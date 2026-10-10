import { CodigoErro } from '@/lib/erros';

/**
 * Regras da sincronização offline (US025 · RF022 · RN025).
 *
 * Funções puras, e este é o único arquivo do módulo que roda **nos dois lados**:
 * o servidor usa a ordenação e a classificação de falhas; o aplicativo usa o
 * estado local e o resumo da fila. É o que evita o cliente e o servidor
 * discordarem sobre o que é conflito e sobre em que ordem as coisas
 * aconteceram — divergência que, num sistema de registro, vira dado errado.
 */

export const TIPOS_DE_OPERACAO = [
  'ABRIR_JORNADA',
  'INICIAR_CORRIDA',
  'REGISTRAR_EVENTO',
  'ENCERRAR_CORRIDA',
  'ENCERRAR_JORNADA',
] as const;

export type TipoDeOperacao = (typeof TIPOS_DE_OPERACAO)[number];

export const ROTULO_DA_OPERACAO: Record<TipoDeOperacao, string> = {
  ABRIR_JORNADA: 'Início do dia',
  INICIAR_CORRIDA: 'Início de corrida',
  REGISTRAR_EVENTO: 'Parada',
  ENCERRAR_CORRIDA: 'Fim de corrida',
  ENCERRAR_JORNADA: 'Fim do dia',
};

export interface OperacaoOffline {
  /** Identificador gerado no aparelho, antes de existir qualquer id do servidor. */
  clientUuid: string;
  tipo: TipoDeOperacao;
  /** Relógio do aparelho no momento do registro. Define a ordem de aplicação. */
  ocorridoEm: string;
  dados: Record<string, unknown>;
}

export type SituacaoDaOperacao = 'APLICADA' | 'JA_PROCESSADA' | 'CONFLITO' | 'FALHA';

export interface ResultadoDaOperacao {
  clientUuid: string;
  situacao: SituacaoDaOperacao;
  /** Identificador do registro criado ou alterado no servidor. */
  id: string | null;
  codigo: string | null;
  mensagem: string | null;
}

/**
 * Ordena as operações pelo relógio do **aparelho** (critério: "em ordem
 * cronológica").
 *
 * Tem de ser o relógio do aparelho, e não o de chegada: as operações foram
 * criadas sem rede e chegam todas no mesmo instante. Aplicar na ordem de
 * chegada encerraria uma corrida antes de iniciá-la.
 *
 * O desempate pela posição original é o que torna a ordenação estável quando o
 * motorista registra duas coisas dentro do mesmo segundo — parada e fim de
 * corrida em sequência, por exemplo.
 */
export function ordenarOperacoes(operacoes: OperacaoOffline[]): OperacaoOffline[] {
  return operacoes
    .map((operacao, posicao) => ({ operacao, posicao }))
    .sort((uma, outra) => {
      const diferenca = Date.parse(uma.operacao.ocorridoEm) - Date.parse(outra.operacao.ocorridoEm);
      return diferenca !== 0 ? diferenca : uma.posicao - outra.posicao;
    })
    .map((item) => item.operacao);
}

/**
 * Códigos em que **tentar de novo faz sentido**.
 *
 * A lista é curta de propósito: são as falhas do ambiente, não do registro. O
 * resto — odômetro incoerente, jornada já encerrada, veículo ocupado — é
 * conflito de verdade, e repetir só produziria a mesma recusa. Conflito vai
 * para o motorista decidir, nunca para uma repetição infinita em segundo plano.
 */
const CODIGOS_QUE_VALEM_REPETIR = new Set<string>([
  CodigoErro.ERRO_INTERNO,
  CodigoErro.SERVICO_INDISPONIVEL,
  CodigoErro.LIMITE_EXCEDIDO,
  // Sessão expirada é ambiente, não registro: o motorista entra de novo e a
  // fila segue de onde parou.
  CodigoErro.SESSAO_EXPIRADA,
  CodigoErro.NAO_AUTENTICADO,
]);

export function classificarFalha(codigo: string): 'CONFLITO' | 'FALHA' {
  return CODIGOS_QUE_VALEM_REPETIR.has(codigo) ? 'FALHA' : 'CONFLITO';
}

/** A operação some da fila local, ou fica esperando o motorista? */
export function podeSairDaFila(situacao: SituacaoDaOperacao): boolean {
  return situacao === 'APLICADA' || situacao === 'JA_PROCESSADA';
}

// ------------------------------------------------------- estado do aparelho

/**
 * Retrato do dia, guardado no aparelho na última vez em que houve rede.
 *
 * É o que permite o modo sem conexão saber quais vans existem e se o dia já
 * estava aberto. Sem ele o motorista sem sinal não teria nem a lista de
 * veículos para escolher.
 */
export interface RetratoDoDia {
  data: string;
  atualizadoEm: string;
  jornadaAberta: { id: string; placa: string } | null;
  corridaEmAndamento: { id: string; descricao: string } | null;
  veiculos: { id: string; placa: string; modelo: string; odometroAtual: number }[];
  rotas: { id: string; codigo: string; nome: string }[];
}

/**
 * Referência a uma corrida que pode existir só no aparelho.
 *
 * A corrida iniciada sem rede **não tem id do servidor**: ela só é conhecida
 * pelo identificador gerado no aparelho. Encerrá-la exige poder apontar para
 * ela pelos dois caminhos — daí este par, resolvido no servidor na hora de
 * aplicar (RN025).
 */
export interface ReferenciaDaCorrida {
  id: string | null;
  clientUuid: string | null;
  descricao: string;
}

export interface EstadoLocal {
  /** Há jornada aberta, contando o que ainda não foi sincronizado. */
  temJornada: boolean;
  placaDaJornada: string | null;
  corrida: ReferenciaDaCorrida | null;
  /** Quantas operações esperam envio. */
  pendentes: number;
  /** Quantas travaram em conflito e precisam do motorista. */
  emConflito: number;
}

interface OperacaoNaFila extends OperacaoOffline {
  /** Preenchido quando o servidor recusou e o motorista precisa decidir. */
  conflito?: { codigo: string; mensagem: string } | null;
}

/**
 * Estado efetivo do dia no aparelho: o retrato **mais** o que ainda não subiu.
 *
 * É o coração do modo sem conexão. Sem aplicar a fila por cima do retrato, o
 * motorista que abriu o dia sem sinal veria "você ainda não iniciou seu dia" e
 * abriria de novo — criando duas jornadas para sincronizar, das quais uma seria
 * recusada. A regra é a mesma de sempre (RN014, uma corrida por vez), só que
 * avaliada localmente.
 *
 * Operações **em conflito não contam** para o estado: elas já foram recusadas
 * pelo servidor, e tratá-las como válidas manteria a tela mostrando uma corrida
 * que não existe em lugar nenhum.
 */
export function estadoLocal(retrato: RetratoDoDia | null, fila: OperacaoNaFila[]): EstadoLocal {
  const pendentesValidas = ordenarOperacoes(
    fila.filter((operacao) => !operacao.conflito),
  ) as OperacaoNaFila[];

  let temJornada = retrato?.jornadaAberta !== null && retrato?.jornadaAberta !== undefined;
  let placaDaJornada = retrato?.jornadaAberta?.placa ?? null;

  let corrida: ReferenciaDaCorrida | null = retrato?.corridaEmAndamento
    ? {
        id: retrato.corridaEmAndamento.id,
        clientUuid: null,
        descricao: retrato.corridaEmAndamento.descricao,
      }
    : null;

  for (const operacao of pendentesValidas) {
    if (operacao.tipo === 'ABRIR_JORNADA') {
      temJornada = true;
      placaDaJornada = String(operacao.dados.placa ?? placaDaJornada ?? '') || null;
    }

    if (operacao.tipo === 'INICIAR_CORRIDA') {
      corrida = {
        id: null,
        clientUuid: operacao.clientUuid,
        descricao: String(operacao.dados.descricao ?? 'Corrida'),
      };
    }

    if (operacao.tipo === 'ENCERRAR_CORRIDA') corrida = null;

    if (operacao.tipo === 'ENCERRAR_JORNADA') {
      temJornada = false;
      placaDaJornada = null;
      corrida = null;
    }
  }

  return {
    temJornada,
    placaDaJornada,
    corrida,
    pendentes: pendentesValidas.length,
    emConflito: fila.length - pendentesValidas.length,
  };
}

/**
 * Texto do indicador permanente (critério: "Sincronizado" ou "N registros
 * pendentes").
 *
 * O indicador é permanente por decisão de produto: o motorista precisa poder
 * confiar que o registro chegou. Um aviso que só aparece quando há problema
 * deixa a dúvida de sempre — "será que foi?" —, que é exatamente a dúvida que
 * fez o diário de papel fracassar.
 */
export function textoDaSincronizacao(estado: {
  online: boolean;
  pendentes: number;
  emConflito: number;
  sincronizando: boolean;
}): { rotulo: string; tom: 'sucesso' | 'andamento' | 'atencao' | 'erro' } {
  if (estado.emConflito > 0) {
    return {
      rotulo: `${estado.emConflito} ${estado.emConflito === 1 ? 'registro precisa' : 'registros precisam'} de você`,
      tom: 'erro',
    };
  }

  if (estado.sincronizando) return { rotulo: 'Enviando…', tom: 'andamento' };

  if (estado.pendentes > 0) {
    const sufixo = estado.pendentes === 1 ? 'registro pendente' : 'registros pendentes';
    return {
      rotulo: `${estado.pendentes} ${sufixo}`,
      tom: estado.online ? 'andamento' : 'atencao',
    };
  }

  return estado.online
    ? { rotulo: 'Sincronizado', tom: 'sucesso' }
    : { rotulo: 'Sem conexão', tom: 'atencao' };
}
