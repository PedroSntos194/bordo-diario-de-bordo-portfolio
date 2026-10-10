import { CodigoErro, ErroDeNegocio } from '@/lib/erros';

/**
 * Regras dos eventos da corrida — paradas, embarques e desembarques
 * (US021 · RF017 · RN016, RN022).
 *
 * O evento existe para responder à pergunta que o diário de papel respondia mal:
 * *quais destinos a van efetivamente atendeu*. Marcar chegada e saída em cada
 * ponto é o que transforma "fez a rota R-014" em um registro verificável.
 *
 * Por isso o registro tem que caber em **um toque**: um motorista que precisa
 * preencher formulário a cada parada simplesmente não marca, e o dado volta a
 * ser a suposição de que a rota inteira foi cumprida.
 */

export const TIPOS_DE_EVENTO = [
  'INICIO',
  'CHEGADA',
  'SAIDA',
  'EMBARQUE',
  'DESEMBARQUE',
  'FIM',
] as const;

export type TipoDeEvento = (typeof TIPOS_DE_EVENTO)[number];

export const ROTULO_DO_EVENTO: Record<TipoDeEvento, string> = {
  INICIO: 'Início',
  CHEGADA: 'Chegada',
  SAIDA: 'Saída',
  EMBARQUE: 'Embarque',
  DESEMBARQUE: 'Desembarque',
  FIM: 'Fim',
};

/**
 * Tipos que o motorista registra à mão durante a corrida.
 *
 * `INICIO` e `FIM` são derivados do próprio ciclo da corrida e **não** entram:
 * deixá-los na tela permitiria uma corrida com dois inícios, ou um fim antes do
 * encerramento — estados que nenhum relatório saberia interpretar.
 */
export const TIPOS_MANUAIS = ['CHEGADA', 'SAIDA', 'EMBARQUE', 'DESEMBARQUE'] as const;

export type TipoManual = (typeof TIPOS_MANUAIS)[number];

/**
 * Janela para desfazer o último evento (critério de aceitação da US021).
 *
 * Dois minutos cobrem o caso real — tocar no ponto errado e perceber na hora —
 * sem abrir espaço para reescrever o histórico depois. Passado o prazo, a
 * correção existe, mas é a US022: com justificativa e trilha de auditoria.
 */
export const JANELA_DESFAZER_MINUTOS = 2;

export function validarTipoManual(tipo: string): asserts tipo is TipoManual {
  if (!(TIPOS_MANUAIS as readonly string[]).includes(tipo)) {
    throw new ErroDeNegocio(
      CodigoErro.DADOS_INVALIDOS,
      'Início e fim são registrados automaticamente pela corrida.',
    );
  }
}

/**
 * Evento só se registra em corrida **em andamento**.
 *
 * Depois de encerrada, os totais já foram calculados e podem ter entrado no
 * resumo do dia (RN017); acrescentar uma parada ali criaria um registro que não
 * corresponde a nenhum número já publicado.
 */
export function validarCorridaParaEvento(status: string): void {
  if (status !== 'EM_ANDAMENTO') {
    throw new ErroDeNegocio(
      CodigoErro.CORRIDA_JA_ENCERRADA,
      'Esta corrida já foi encerrada. Não é possível registrar paradas nela.',
    );
  }
}

/**
 * Parada avulsa precisa de nome; parada de rota já tem o do ponto cadastrado.
 *
 * Sem isto, a corrida avulsa acumularia uma lista de "Chegada" sem dizer onde —
 * um registro que ocupa espaço e não informa nada.
 */
export function validarIdentificacaoDaParada(parametros: {
  pontoParadaId: string | null;
  descricao: string | null;
}): void {
  if (parametros.pontoParadaId) return;
  if (parametros.descricao?.trim()) return;

  throw new ErroDeNegocio(CodigoErro.DADOS_INVALIDOS, 'Informe o nome da parada.');
}

/**
 * O evento pertence à corrida informada? O ponto de parada é da rota dela?
 *
 * Um identificador trocado penduraria a parada de uma rota na corrida de outra,
 * e o relatório de destinos atendidos mentiria em silêncio.
 */
export function validarPontoDaRota(parametros: {
  pontoParadaId: string | null;
  rotaDoPonto: string | null;
  rotaDaCorrida: string | null;
}): void {
  if (!parametros.pontoParadaId) return;

  if (parametros.rotaDoPonto !== parametros.rotaDaCorrida) {
    throw new ErroDeNegocio(
      CodigoErro.DADOS_INVALIDOS,
      'Este ponto de parada não pertence à rota desta corrida.',
    );
  }
}

/** Ainda dá para desfazer? */
export function podeDesfazer(ocorridoEm: Date, agora: Date): boolean {
  const decorridoMs = agora.getTime() - ocorridoEm.getTime();
  return decorridoMs >= 0 && decorridoMs <= JANELA_DESFAZER_MINUTOS * 60_000;
}

export function validarDesfazer(ocorridoEm: Date, agora: Date): void {
  if (!podeDesfazer(ocorridoEm, agora)) {
    throw new ErroDeNegocio(
      CodigoErro.FORA_DA_JANELA_DE_EDICAO,
      `O prazo de ${JANELA_DESFAZER_MINUTOS} minutos para desfazer já passou. ` +
        'Peça a correção ao administrador.',
    );
  }
}
