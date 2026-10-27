import { describe, expect, it } from 'vitest';
import { apresentacaoInicial, simularOperacao } from '@/modulos/apresentacao/apresentacao.regras';

describe('demonstração pública do portfólio', () => {
  it('percorre a jornada na ordem e mantém o painel sincronizado quando online', () => {
    let estado = apresentacaoInicial();
    for (const etapa of ['DIA_ABERTO', 'EM_CORRIDA', 'CORRIDA_ENCERRADA', 'DIA_ENCERRADO']) {
      estado = simularOperacao(estado, 'AVANCAR');
      expect(estado.etapa).toBe(etapa);
      expect(estado.etapaSincronizada).toBe(etapa);
      expect(estado.pendencias).toBe(0);
    }
    expect(simularOperacao(estado, 'AVANCAR')).toEqual(estado);
  });

  it('mantém o painel no último registro recebido até a conexão voltar', () => {
    let estado = simularOperacao(apresentacaoInicial(), 'AVANCAR');
    estado = simularOperacao(estado, 'ALTERNAR_CONEXAO');
    estado = simularOperacao(estado, 'AVANCAR');
    estado = simularOperacao(estado, 'AVANCAR');
    expect(estado).toEqual({
      etapa: 'CORRIDA_ENCERRADA',
      etapaSincronizada: 'DIA_ABERTO',
      online: false,
      pendencias: 2,
    });
    estado = simularOperacao(estado, 'ALTERNAR_CONEXAO');
    expect(estado).toEqual({
      etapa: 'CORRIDA_ENCERRADA',
      etapaSincronizada: 'CORRIDA_ENCERRADA',
      online: true,
      pendencias: 0,
    });
  });

  it('não cria novas pendências depois de encerrar e permite recomeçar sem resíduos', () => {
    let estado = simularOperacao(apresentacaoInicial(), 'ALTERNAR_CONEXAO');
    for (let i = 0; i < 6; i++) estado = simularOperacao(estado, 'AVANCAR');
    expect(estado.pendencias).toBe(4);
    expect(estado.etapaSincronizada).toBe('PRONTO');
    expect(simularOperacao(estado, 'REINICIAR')).toEqual(apresentacaoInicial());
  });

  it('reconecta sem duplicar os registros que já estavam no painel', () => {
    const estado = simularOperacao(apresentacaoInicial(), 'AVANCAR');
    const semSinal = simularOperacao(estado, 'ALTERNAR_CONEXAO');
    expect(simularOperacao(semSinal, 'ALTERNAR_CONEXAO')).toEqual(estado);
    expect(estado.online).toBe(true);
  });
});
