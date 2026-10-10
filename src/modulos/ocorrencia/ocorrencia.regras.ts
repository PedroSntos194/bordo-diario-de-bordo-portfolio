import { CodigoErro, ErroDeNegocio } from '@/lib/erros';

/**
 * Regras da ocorrência (US023 · RF020 · RN023).
 *
 * A regra que define a entidade inteira é a **RN023**: ocorrência é registro
 * *complementar*. Ela não altera km, horário nem status da corrida.
 *
 * Isso parece uma limitação e é o contrário: permite que o motorista registre
 * um problema — pane, acidente, atraso — **sem medo de estragar o registro
 * operacional**. Se anotar uma pane pudesse mexer no km do dia, ninguém
 * anotaria, e o sistema perderia justamente a informação que a empresa mais
 * precisa saber.
 */

export const TIPOS_DE_OCORRENCIA = [
  'ATRASO',
  'PANE',
  'ACIDENTE',
  'DESVIO',
  'PASSAGEIRO',
  'OUTRO',
] as const;

export type TipoDeOcorrencia = (typeof TIPOS_DE_OCORRENCIA)[number];

/** Rótulos em linguagem de operação — é o motorista quem escolhe na tela. */
export const ROTULO_DA_OCORRENCIA: Record<TipoDeOcorrencia, string> = {
  ATRASO: 'Atraso',
  PANE: 'Pane mecânica',
  ACIDENTE: 'Acidente',
  DESVIO: 'Desvio de rota',
  PASSAGEIRO: 'Problema com passageiro',
  OUTRO: 'Outro',
};

/**
 * Tipos que a administração precisa ver primeiro no painel.
 *
 * Acidente e pane tiram a van de operação; os demais são registro. A distinção
 * existe para o dashboard destacar o que exige reação hoje.
 */
const GRAVES = new Set<TipoDeOcorrencia>(['ACIDENTE', 'PANE']);

export function ehGrave(tipo: string): boolean {
  return GRAVES.has(tipo as TipoDeOcorrencia);
}

export const TAMANHO_MINIMO_DESCRICAO = 10;
export const TAMANHO_MAXIMO_DESCRICAO = 1000;

/**
 * A ocorrência precisa pertencer a uma jornada, e a corrida — quando informada
 * — precisa ser daquela jornada.
 *
 * Sem esta verificação, um identificador trocado penduraria a ocorrência de um
 * motorista na corrida de outro, e o relatório do dia mentiria sem que nenhuma
 * tela mostrasse erro.
 */
export function validarVinculo(parametros: {
  jornadaId: string;
  corridaId: string | null;
  jornadaDaCorrida: string | null;
}): void {
  if (!parametros.corridaId) return;

  if (parametros.jornadaDaCorrida !== parametros.jornadaId) {
    throw new ErroDeNegocio(
      CodigoErro.DADOS_INVALIDOS,
      'A corrida informada não pertence a esta jornada.',
    );
  }
}

/**
 * Registrar ocorrência exige jornada **aberta ou encerrada**, nunca cancelada.
 *
 * Dia cancelado não aconteceu; pendurar nele o relato de um acidente deixaria o
 * registro invisível em todo relatório que filtra por jornada válida.
 */
export function validarJornadaParaOcorrencia(status: string): void {
  if (status === 'CANCELADA') {
    throw new ErroDeNegocio(
      CodigoErro.JORNADA_NAO_ABERTA,
      'Não é possível registrar ocorrência em uma jornada cancelada.',
    );
  }
}
