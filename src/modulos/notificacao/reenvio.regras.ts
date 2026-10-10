/**
 * Regras de reenvio de notificação (US037 · RF027 · RN028).
 *
 * O pano de fundo é a RN028: falha de notificação não invalida o registro
 * operacional. A consequência prática é que a falha **fica em algum lugar** —
 * e alguém precisa poder olhar esse lugar, entender o que houve e reenviar.
 * Sem esta tela, "fica registrada como pendente" é uma promessa que ninguém
 * pode cobrar.
 */

export const MAX_TENTATIVAS = 3;

export type StatusDaNotificacao = 'PENDENTE' | 'ENVIADA' | 'FALHA' | 'CANCELADA';

export const ROTULO_DO_STATUS: Record<StatusDaNotificacao, string> = {
  PENDENTE: 'Pendente',
  ENVIADA: 'Enviada',
  FALHA: 'Falha',
  CANCELADA: 'Cancelada',
};

/**
 * Espera antes da próxima tentativa, em segundos: 1, 5 e 25 minutos.
 *
 * Cresce porque a causa mais provável de falha é indisponibilidade temporária
 * do provedor. Repetir de imediato três vezes só transforma uma falha em três,
 * e ainda por cima concentradas no pior momento.
 */
export function intervaloDeReenvioSegundos(tentativa: number): number {
  const passo = Math.max(1, Math.min(tentativa, MAX_TENTATIVAS));
  return 60 * 5 ** (passo - 1);
}

/**
 * Esgotou as tentativas automáticas e continua sem sair.
 *
 * É o que o critério da US037 chama de **"requer atenção"**: o sistema fez o
 * que podia sozinho e agora precisa de gente. Sinalizado no painel para não
 * depender de alguém lembrar de abrir a tela de notificações.
 */
export function requerAtencao(status: string, tentativas: number): boolean {
  return status === 'FALHA' && tentativas >= MAX_TENTATIVAS;
}

/**
 * O reenvio **manual** continua disponível mesmo depois das três tentativas.
 *
 * O limite existe para o robô, não para a pessoa: quem clica em "reenviar" já
 * sabe que as automáticas falharam e provavelmente corrigiu a causa — um número
 * errado no cadastro, por exemplo. Recusar aqui obrigaria a recriar a
 * notificação para contornar o próprio sistema.
 */
export function podeReenviarManualmente(status: string): boolean {
  return status === 'FALHA' || status === 'PENDENTE';
}

/** Elegível para a próxima tentativa **automática**? */
export function elegivelParaReenvioAutomatico(parametros: {
  status: string;
  tentativas: number;
  ultimaTentativaEm: Date;
  agora: Date;
  /**
   * O servidor consegue disparar sozinho neste canal?
   *
   * Vem de fora porque **não dá para deduzir da notificação**: o campo `canal`
   * no banco diz `WHATSAPP` ou `INTERNA`, enquanto o que decide se o envio é
   * automático é a abordagem do V-05 — `WHATSAPP_CANAL=cloud` no ambiente.
   *
   * Importa muito: no canal `link` quem envia é o aplicativo do motorista, e a
   * notificação fica pendente até ele confirmar. Repetir do servidor não muda
   * nada, gastaria as três tentativas e marcaria como "requer atenção" algo que
   * depende de um toque na tela dele.
   */
  servidorEnvia: boolean;
}): boolean {
  if (!parametros.servidorEnvia) return false;
  if (parametros.status !== 'FALHA') return false;
  if (parametros.tentativas >= MAX_TENTATIVAS) return false;

  const espera = intervaloDeReenvioSegundos(parametros.tentativas) * 1000;
  return parametros.agora.getTime() - parametros.ultimaTentativaEm.getTime() >= espera;
}
