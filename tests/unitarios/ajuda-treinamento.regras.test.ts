import { describe, expect, it } from 'vitest';
import {
  avancarDemonstracao,
  chaveDispensaTreinamento,
  demonstracaoInicial,
  type AcaoDaDemonstracao,
} from '@/modulos/ajuda/treinamento.regras';

function praticar(acoes: AcaoDaDemonstracao[]) {
  return acoes.reduce(avancarDemonstracao, demonstracaoInicial());
}

const ROTINA_COMPLETA: AcaoDaDemonstracao[] = [
  'ENTRAR',
  'PROXIMO',
  'INICIAR_DIA',
  'PROXIMO',
  'INICIAR_CORRIDA',
  'ENCERRAR_CORRIDA',
  'PROXIMO',
  'ENCERRAR_DIA',
];

describe('demonstração da rotina do motorista', () => {
  it('ensina a rotina inteira com avanço manual após cada prática', () => {
    const entrou = praticar(['ENTRAR']);
    expect(entrou.etapa).toBe(0);
    expect(entrou.entrou).toBe(true);

    expect(praticar(ROTINA_COMPLETA)).toEqual({
      etapa: 3,
      entrou: true,
      diaIniciado: true,
      corrida: 'ENCERRADA',
      diaEncerrado: true,
    });
  });

  it('não pula o exercício nem encerra a corrida antes de iniciá-la', () => {
    expect(praticar(['PROXIMO', 'ENCERRAR_DIA'])).toEqual(demonstracaoInicial());
    const antesDaCorrida = praticar(['ENTRAR', 'PROXIMO', 'INICIAR_DIA', 'PROXIMO']);
    expect(avancarDemonstracao(antesDaCorrida, 'ENCERRAR_CORRIDA')).toEqual(antesDaCorrida);
    expect(avancarDemonstracao(antesDaCorrida, 'PROXIMO')).toEqual(antesDaCorrida);
    expect(avancarDemonstracao(antesDaCorrida, 'ENCERRAR_DIA')).toEqual(antesDaCorrida);
  });

  it('evita iniciar novamente uma corrida que já foi encerrada', () => {
    const encerrada = praticar(ROTINA_COMPLETA.slice(0, 6));
    expect(avancarDemonstracao(encerrada, 'INICIAR_CORRIDA')).toEqual(encerrada);
  });

  it('permite rever as etapas e refazer sem reaproveitar o exercício anterior', () => {
    const completa = praticar(ROTINA_COMPLETA);
    const anterior = avancarDemonstracao(completa, 'ANTERIOR');
    expect(anterior.etapa).toBe(2);
    expect(anterior.corrida).toBe('ENCERRADA');
    expect(avancarDemonstracao(completa, 'PROXIMO')).toEqual(completa);
    expect(avancarDemonstracao(completa, 'REFAZER')).toEqual(demonstracaoInicial());
    expect(avancarDemonstracao(demonstracaoInicial(), 'ANTERIOR').etapa).toBe(0);
  });
});

describe('dispensa do convite de treinamento', () => {
  it('a dispensa de um motorista não esconde o convite para outro no mesmo aparelho', () => {
    expect(chaveDispensaTreinamento('motorista-a')).not.toBe(
      chaveDispensaTreinamento('motorista-b'),
    );
  });
});
