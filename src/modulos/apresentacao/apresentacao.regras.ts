export const ETAPAS_DA_APRESENTACAO = [
  'PRONTO',
  'DIA_ABERTO',
  'EM_CORRIDA',
  'CORRIDA_ENCERRADA',
  'DIA_ENCERRADO',
] as const;

export type EtapaDaApresentacao = (typeof ETAPAS_DA_APRESENTACAO)[number];

export interface EstadoDaApresentacao {
  etapa: EtapaDaApresentacao;
  etapaSincronizada: EtapaDaApresentacao;
  online: boolean;
  pendencias: number;
}

export type AcaoDaApresentacao = 'AVANCAR' | 'ALTERNAR_CONEXAO' | 'REINICIAR';

export function apresentacaoInicial(): EstadoDaApresentacao {
  return { etapa: 'PRONTO', etapaSincronizada: 'PRONTO', online: true, pendencias: 0 };
}

/** Simulação em memória. Não importa serviços, não grava nem envia registros. */
export function simularOperacao(
  estado: EstadoDaApresentacao,
  acao: AcaoDaApresentacao,
): EstadoDaApresentacao {
  if (acao === 'REINICIAR') return apresentacaoInicial();

  if (acao === 'ALTERNAR_CONEXAO') {
    return estado.online
      ? { ...estado, online: false }
      : { ...estado, online: true, etapaSincronizada: estado.etapa, pendencias: 0 };
  }

  const proxima = ETAPAS_DA_APRESENTACAO[ETAPAS_DA_APRESENTACAO.indexOf(estado.etapa) + 1];
  if (!proxima) return estado;

  return {
    ...estado,
    etapa: proxima,
    etapaSincronizada: estado.online ? proxima : estado.etapaSincronizada,
    pendencias: estado.online ? 0 : estado.pendencias + 1,
  };
}
