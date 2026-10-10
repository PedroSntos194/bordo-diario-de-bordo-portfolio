import { describe, expect, it } from 'vitest';
import {
  calcularTotaisDaJornada,
  exigirJornadaAberta,
  validarEncerramentoDaJornada,
  validarOdometroDeAbertura,
  validarOdometroDeEncerramento,
  validarReabertura,
  validarVeiculoParaJornada,
  type CorridaConsolidavel,
} from '@/modulos/jornada/jornada.regras';
import { CodigoErro, type ErroDaAplicacao } from '@/lib/erros';

function codigoDoErro(executar: () => void): string {
  try {
    executar();
  } catch (erro) {
    return (erro as ErroDaAplicacao).codigo;
  }
  throw new Error('esperava um erro, mas nada foi lançado');
}

describe('validarOdometroDeAbertura (RN015, RN020)', () => {
  const base = {
    odometroAtualDoVeiculo: 84320,
    confirmaDivergencia: false,
  };

  it('aceita odômetro igual ao último registrado — fronteira', () => {
    expect(() => validarOdometroDeAbertura({ ...base, odometroInformado: 84320 })).not.toThrow();
  });

  it('recusa odômetro menor que o último registrado', () => {
    expect(
      codigoDoErro(() => validarOdometroDeAbertura({ ...base, odometroInformado: 84000 })),
    ).toBe(CodigoErro.ODOMETRO_MENOR_QUE_ULTIMO);
  });

  it('aceita diferença dentro da tolerância', () => {
    expect(() =>
      validarOdometroDeAbertura({ ...base, odometroInformado: 84320 + 500 }),
    ).not.toThrow();
  });

  it('exige confirmação acima da tolerância', () => {
    expect(
      codigoDoErro(() => validarOdometroDeAbertura({ ...base, odometroInformado: 84320 + 501 })),
    ).toBe(CodigoErro.DIVERGENCIA_ODOMETRO_NAO_CONFIRMADA);
  });

  it('aceita a divergência quando confirmada', () => {
    expect(() =>
      validarOdometroDeAbertura({
        ...base,
        odometroInformado: 90000,
        confirmaDivergencia: true,
      }),
    ).not.toThrow();
  });

  it('respeita tolerância configurada', () => {
    expect(() =>
      validarOdometroDeAbertura({
        ...base,
        odometroInformado: 84320 + 200,
        toleranciaKm: 100,
      }),
    ).toThrow();
  });

  it('recusa valor não inteiro ou negativo', () => {
    expect(
      codigoDoErro(() => validarOdometroDeAbertura({ ...base, odometroInformado: 84320.5 })),
    ).toBe(CodigoErro.ODOMETRO_INCOERENTE);
    expect(codigoDoErro(() => validarOdometroDeAbertura({ ...base, odometroInformado: -1 }))).toBe(
      CodigoErro.ODOMETRO_INCOERENTE,
    );
  });
});

describe('validarOdometroDeEncerramento (RN020)', () => {
  it('aceita valor coerente com as corridas do dia', () => {
    expect(() => validarOdometroDeEncerramento(84500, 84320, 84480)).not.toThrow();
  });

  it('usa o maior entre o inicial da jornada e o das corridas como piso', () => {
    expect(codigoDoErro(() => validarOdometroDeEncerramento(84400, 84320, 84480))).toBe(
      CodigoErro.ODOMETRO_INCOERENTE,
    );
  });

  it('funciona quando o dia não teve corridas', () => {
    expect(() => validarOdometroDeEncerramento(84320, 84320, null)).not.toThrow();
  });

  it('não permite retroceder o odômetro do encerramento anterior de um dia reaberto', () => {
    expect(codigoDoErro(() => validarOdometroDeEncerramento(1015, 1000, 1010, 1020))).toBe(
      CodigoErro.ODOMETRO_INCOERENTE,
    );
    expect(() => validarOdometroDeEncerramento(1020, 1000, 1010, 1020)).not.toThrow();
  });

  it('mantém o odômetro atual como piso mesmo sem corridas', () => {
    expect(codigoDoErro(() => validarOdometroDeEncerramento(1000, 1000, null, 1020))).toBe(
      CodigoErro.ODOMETRO_INCOERENTE,
    );
  });
});

describe('exigirJornadaAberta (RN014)', () => {
  it('passa com jornada aberta', () => {
    expect(() => exigirJornadaAberta({ status: 'ABERTA' })).not.toThrow();
  });

  it('distingue jornada encerrada de jornada inexistente', () => {
    expect(codigoDoErro(() => exigirJornadaAberta({ status: 'ENCERRADA' }))).toBe(
      CodigoErro.JORNADA_JA_ENCERRADA,
    );
    expect(codigoDoErro(() => exigirJornadaAberta({ status: 'CANCELADA' }))).toBe(
      CodigoErro.JORNADA_NAO_ABERTA,
    );
  });
});

describe('validarEncerramentoDaJornada (RN014)', () => {
  it('permite encerrar sem corrida aberta', () => {
    expect(() =>
      validarEncerramentoDaJornada({ status: 'ABERTA', temCorridaEmAndamento: false }),
    ).not.toThrow();
  });

  it('bloqueia com corrida em andamento', () => {
    expect(
      codigoDoErro(() =>
        validarEncerramentoDaJornada({ status: 'ABERTA', temCorridaEmAndamento: true }),
      ),
    ).toBe(CodigoErro.CORRIDA_EM_ANDAMENTO);
  });

  it('bloqueia jornada já encerrada', () => {
    expect(
      codigoDoErro(() =>
        validarEncerramentoDaJornada({ status: 'ENCERRADA', temCorridaEmAndamento: false }),
      ),
    ).toBe(CodigoErro.JORNADA_JA_ENCERRADA);
  });
});

describe('calcularTotaisDaJornada (RN018)', () => {
  const inicio = new Date('2026-08-23T09:00:00Z');
  const fim = new Date('2026-08-23T17:30:00Z');

  const corridas: CorridaConsolidavel[] = [
    { kmPercorrido: 27.5, duracaoMinutos: 45, quantidadePassageiros: 14, status: 'ENCERRADA' },
    { kmPercorrido: 31.2, duracaoMinutos: 50, quantidadePassageiros: 12, status: 'ENCERRADA' },
    { kmPercorrido: 10, duracaoMinutos: 20, quantidadePassageiros: 5, status: 'CANCELADA' },
    {
      kmPercorrido: null,
      duracaoMinutos: null,
      quantidadePassageiros: null,
      status: 'EM_ANDAMENTO',
    },
  ];

  it('soma apenas as corridas encerradas', () => {
    const totais = calcularTotaisDaJornada(corridas, inicio, fim);

    expect(totais.totalCorridas).toBe(2);
    expect(totais.kmTotal).toBe(58.7);
    expect(totais.totalPassageiros).toBe(26);
  });

  it('ignora corrida cancelada — ela inflaria o custo por rota', () => {
    const somenteCancelada = calcularTotaisDaJornada(
      [{ kmPercorrido: 10, duracaoMinutos: 20, quantidadePassageiros: 5, status: 'CANCELADA' }],
      inicio,
      fim,
    );
    expect(somenteCancelada.totalCorridas).toBe(0);
    expect(somenteCancelada.kmTotal).toBe(0);
  });

  it('calcula a duração do dia pelos horários da jornada', () => {
    expect(calcularTotaisDaJornada(corridas, inicio, fim).duracaoMinutos).toBe(510);
  });

  it('nunca devolve duração negativa', () => {
    expect(calcularTotaisDaJornada([], fim, inicio).duracaoMinutos).toBe(0);
  });

  it('trata dia sem corridas', () => {
    const totais = calcularTotaisDaJornada([], inicio, fim);
    expect(totais).toMatchObject({ totalCorridas: 0, kmTotal: 0, totalPassageiros: 0 });
  });
});

describe('validarVeiculoParaJornada (RN013)', () => {
  it('aceita veículo ativo e livre', () => {
    expect(() => validarVeiculoParaJornada('ATIVO', false)).not.toThrow();
  });

  it('recusa veículo inativo ou em manutenção', () => {
    expect(codigoDoErro(() => validarVeiculoParaJornada('INATIVO', false))).toBe(
      CodigoErro.VEICULO_INATIVO,
    );
    expect(codigoDoErro(() => validarVeiculoParaJornada('MANUTENCAO', false))).toBe(
      CodigoErro.VEICULO_INATIVO,
    );
  });

  it('recusa veículo já em jornada aberta', () => {
    expect(codigoDoErro(() => validarVeiculoParaJornada('ATIVO', true))).toBe(
      CodigoErro.VEICULO_EM_USO,
    );
  });
});

describe('reabrir o dia', () => {
  const base = {
    status: 'ENCERRADA' as const,
    dataDaJornada: '2026-10-08',
    hoje: '2026-10-08',
    motoristaTemOutroDiaAberto: false,
    vanEmUsoPorOutro: false,
  };

  it('reabre o dia de hoje encerrado, com motorista e van livres', () => {
    expect(() => validarReabertura(base)).not.toThrow();
  });

  it('recusa dia que não está encerrado', () => {
    expect(() => validarReabertura({ ...base, status: 'ABERTA' })).toThrow('Só um dia encerrado');
  });

  it('recusa dia que não é o de hoje', () => {
    expect(() => validarReabertura({ ...base, dataDaJornada: '2026-10-07' })).toThrow(
      'Só o dia de hoje',
    );
  });

  it('recusa quando o motorista ou a van já estão em outro dia', () => {
    expect(() => validarReabertura({ ...base, motoristaTemOutroDiaAberto: true })).toThrow(
      'já tem um dia em aberto',
    );
    expect(() => validarReabertura({ ...base, vanEmUsoPorOutro: true })).toThrow(
      'em uso por outro motorista',
    );
  });
});
