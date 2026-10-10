export const ETAPAS_DO_TREINAMENTO = [
  'Entrar',
  'Iniciar o dia',
  'Iniciar e encerrar a corrida',
  'Encerrar o dia',
] as const;

export interface EstadoDaDemonstracao {
  etapa: number;
  entrou: boolean;
  diaIniciado: boolean;
  corrida: 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'ENCERRADA';
  diaEncerrado: boolean;
}

export type AcaoDaDemonstracao =
  | 'ENTRAR'
  | 'INICIAR_DIA'
  | 'INICIAR_CORRIDA'
  | 'ENCERRAR_CORRIDA'
  | 'ENCERRAR_DIA'
  | 'PROXIMO'
  | 'ANTERIOR'
  | 'REFAZER';

export function demonstracaoInicial(): EstadoDaDemonstracao {
  return {
    etapa: 0,
    entrou: false,
    diaIniciado: false,
    corrida: 'NAO_INICIADA',
    diaEncerrado: false,
  };
}

export function etapaFoiPraticada(estado: EstadoDaDemonstracao): boolean {
  return (
    [estado.entrou, estado.diaIniciado, estado.corrida === 'ENCERRADA', estado.diaEncerrado][
      estado.etapa
    ] ?? false
  );
}

/** Apenas estado da demonstração; nenhuma ação chama os registros da operação. */
export function avancarDemonstracao(
  estado: EstadoDaDemonstracao,
  acao: AcaoDaDemonstracao,
): EstadoDaDemonstracao {
  switch (acao) {
    case 'ENTRAR':
      return estado.etapa === 0 ? { ...estado, entrou: true } : estado;
    case 'INICIAR_DIA':
      return estado.etapa === 1 && estado.entrou ? { ...estado, diaIniciado: true } : estado;
    case 'INICIAR_CORRIDA':
      return estado.etapa === 2 && estado.diaIniciado && estado.corrida === 'NAO_INICIADA'
        ? { ...estado, corrida: 'EM_ANDAMENTO' }
        : estado;
    case 'ENCERRAR_CORRIDA':
      return estado.etapa === 2 && estado.corrida === 'EM_ANDAMENTO'
        ? { ...estado, corrida: 'ENCERRADA' }
        : estado;
    case 'ENCERRAR_DIA':
      return estado.etapa === 3 && estado.diaIniciado && estado.corrida === 'ENCERRADA'
        ? { ...estado, diaEncerrado: true }
        : estado;
    case 'PROXIMO':
      return estado.etapa < ETAPAS_DO_TREINAMENTO.length - 1 && etapaFoiPraticada(estado)
        ? { ...estado, etapa: estado.etapa + 1 }
        : estado;
    case 'ANTERIOR':
      return estado.etapa > 0 ? { ...estado, etapa: estado.etapa - 1 } : estado;
    case 'REFAZER':
      return demonstracaoInicial();
  }
}

export function chaveDispensaTreinamento(usuarioId: string): string {
  return `bordo:treinamento-motorista:dispensado:${usuarioId}`;
}
