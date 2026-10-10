import { describe, expect, it } from 'vitest';
import {
  avaliarHoraExtra,
  cicloAnterior,
  cicloQueContem,
  datasDoCiclo,
  kmDoDia,
  kmEntreCorridas,
  kmExcedente,
  medirVan,
  juntarDiasDoMotorista,
  montarLinhaDoMotorista,
  resumirMedicao,
  resumirPorMotorista,
  rotuloDoCiclo,
  saidaDeReferencia,
  tipoDoDia,
  type ContratoDaVan,
  type DiaParaHoraExtra,
  type RegrasDeHoraExtra,
} from '@/modulos/fechamento/fechamento.regras';

/** Fechamento mensal — pagamento dos motoristas e boletim de medição. */

const REGRAS: RegrasDeHoraExtra = {
  limiteEntrada: '06:00',
  saidaSegQui: '18:00',
  saidaSexDom: '17:00',
  saidaFeriado: '17:00',
  noturnoInicio: '18:00',
  noturnoFim: '07:00',
  exigeAmbas: false,
  valorDiaria: 105,
};
const SEM_FERIADOS = new Set<string>();
// 12/10/2026 é segunda-feira (Nossa Senhora Aparecida).
const FERIADOS = new Set(['2026-10-12']);

/** Instante a partir do horário de São Paulo (UTC−3). */
const sp = (data: string, hora: string): Date => new Date(`${data}T${hora}:00-03:00`);

function dia(
  data: string,
  inicio: string,
  fim: string | null,
  extra: Partial<DiaParaHoraExtra> = {},
): DiaParaHoraExtra {
  return {
    data,
    iniciadaEm: sp(data, inicio),
    encerradaEm: fim ? sp(data, fim) : null,
    noturno: false,
    inicioPeloAparelho: false,
    fimPeloAparelho: false,
    ...extra,
  };
}

describe('ciclo de 16 a 15', () => {
  it('a data cai no ciclo que começou no dia 16 anterior', () => {
    expect(cicloQueContem('2026-10-07', 16)).toEqual({ inicio: '2026-09-16', fim: '2026-10-15' });
    expect(cicloQueContem('2026-10-15', 16)).toEqual({ inicio: '2026-09-16', fim: '2026-10-15' });
    expect(cicloQueContem('2026-10-16', 16)).toEqual({ inicio: '2026-10-16', fim: '2026-11-15' });
  });

  it('atravessa a virada do ano', () => {
    expect(cicloQueContem('2026-01-10', 16)).toEqual({ inicio: '2025-12-16', fim: '2026-01-15' });
    expect(cicloQueContem('2026-12-20', 16)).toEqual({ inicio: '2026-12-16', fim: '2027-01-15' });
  });

  it('o ciclo anterior e os dias do ciclo, sem repetir o dia 15', () => {
    const atual = cicloQueContem('2026-10-07', 16);
    expect(cicloAnterior(atual, 16)).toEqual({ inicio: '2026-08-16', fim: '2026-09-15' });
    const datas = datasDoCiclo(atual);
    expect(datas[0]).toBe('2026-09-16');
    expect(datas.at(-1)).toBe('2026-10-15');
    expect(datas).toHaveLength(30);
    expect(rotuloDoCiclo(atual)).toBe('16/09/2026 a 15/10/2026');
  });

  it('com o modelo do cliente: 16/07 a 15/08 tem 31 dias', () => {
    expect(datasDoCiclo(cicloQueContem('2026-08-01', 16))).toHaveLength(31);
  });
});

describe('tipo do dia e saída de referência', () => {
  it('sábado, domingo e feriado são extra', () => {
    expect(tipoDoDia('2026-10-10', SEM_FERIADOS)).toBe('EXTRA'); // sábado
    expect(tipoDoDia('2026-10-11', SEM_FERIADOS)).toBe('EXTRA'); // domingo
    expect(tipoDoDia('2026-10-12', FERIADOS)).toBe('EXTRA'); // feriado numa segunda
    expect(tipoDoDia('2026-10-13', FERIADOS)).toBe('NORMAL');
  });

  it('segunda a quinta saem às 18h; sexta a domingo e feriado às 17h', () => {
    expect(saidaDeReferencia('2026-10-08', SEM_FERIADOS, REGRAS)).toBe('18:00'); // quinta
    expect(saidaDeReferencia('2026-10-09', SEM_FERIADOS, REGRAS)).toBe('17:00'); // sexta
    expect(saidaDeReferencia('2026-10-11', SEM_FERIADOS, REGRAS)).toBe('17:00'); // domingo
    expect(saidaDeReferencia('2026-10-12', FERIADOS, { ...REGRAS, saidaFeriado: '16:00' })).toBe(
      '16:00',
    );
  });
});

describe('diária de hora extra', () => {
  it('entrar antes das 6h dá a diária, uma só, qualquer que seja o tempo', () => {
    const resultado = avaliarHoraExtra(dia('2026-10-05', '05:50', '17:30'), SEM_FERIADOS, REGRAS);
    expect(resultado).toMatchObject({
      minutosAntes: 10,
      minutosDepois: 0,
      temDiaria: true,
      valor: 105,
    });
  });

  it('sair depois das 18h numa segunda dá a diária (modelo: 06:00 a 18:11)', () => {
    const resultado = avaliarHoraExtra(dia('2026-10-05', '06:00', '18:11'), SEM_FERIADOS, REGRAS);
    expect(resultado).toMatchObject({ minutosAntes: 0, minutosDepois: 11, temDiaria: true });
  });

  it('na sexta a saída de referência é 17h', () => {
    expect(
      avaliarHoraExtra(dia('2026-10-09', '06:00', '17:05'), SEM_FERIADOS, REGRAS).temDiaria,
    ).toBe(true);
    expect(
      avaliarHoraExtra(dia('2026-10-08', '06:00', '17:05'), SEM_FERIADOS, REGRAS).temDiaria,
    ).toBe(false);
  });

  it('dentro do horário não tem diária', () => {
    const resultado = avaliarHoraExtra(dia('2026-10-05', '06:00', '18:00'), SEM_FERIADOS, REGRAS);
    expect(resultado).toMatchObject({ temDiaria: false, valor: 0, conferir: [] });
  });

  it('exigindo as duas coisas, só entrar cedo não basta', () => {
    const ambas = { ...REGRAS, exigeAmbas: true };
    expect(
      avaliarHoraExtra(dia('2026-10-05', '05:50', '17:30'), SEM_FERIADOS, ambas).temDiaria,
    ).toBe(false);
    expect(
      avaliarHoraExtra(dia('2026-10-05', '05:50', '18:30'), SEM_FERIADOS, ambas).temDiaria,
    ).toBe(true);
  });

  it('dia aberto fica pendente; entrada antecipada já conta', () => {
    const semEntrada = avaliarHoraExtra(dia('2026-10-05', '06:00', null), SEM_FERIADOS, REGRAS);
    expect(semEntrada).toMatchObject({ pendente: true, temDiaria: false });
    expect(semEntrada.conferir).toContain('dia ainda aberto');

    const cedo = avaliarHoraExtra(dia('2026-10-05', '05:30', null), SEM_FERIADOS, REGRAS);
    expect(cedo).toMatchObject({ pendente: true, temDiaria: true });
  });

  it('turno da noite: 18h às 7h do dia seguinte', () => {
    const noturno: DiaParaHoraExtra = {
      ...dia('2026-10-05', '17:40', null, { noturno: true }),
      encerradaEm: sp('2026-10-06', '07:30'),
    };
    const resultado = avaliarHoraExtra(noturno, SEM_FERIADOS, REGRAS);
    expect(resultado).toMatchObject({
      referenciaEntrada: '18:00',
      referenciaSaida: '07:00',
      minutosAntes: 20,
      minutosDepois: 30,
      temDiaria: true,
      conferir: [],
    });
  });

  it('dia esquecido aberto e encerrado no dia seguinte vai para conferência', () => {
    const esquecido: DiaParaHoraExtra = {
      ...dia('2026-10-05', '06:00', null),
      encerradaEm: sp('2026-10-06', '08:00'),
    };
    const resultado = avaliarHoraExtra(esquecido, SEM_FERIADOS, REGRAS);
    expect(resultado.temDiaria).toBe(true);
    expect(resultado.conferir.join()).toContain('encerrado só em 06/10/2026');
  });

  it('horário vindo do celular vai para conferência', () => {
    const resultado = avaliarHoraExtra(
      dia('2026-10-05', '05:50', '17:00', { inicioPeloAparelho: true }),
      SEM_FERIADOS,
      REGRAS,
    );
    expect(resultado.conferir).toEqual(['início pelo horário do celular']);
  });
});

describe('km do dia e excedente', () => {
  it('diferença dos odômetros; acima de 130 é excedente', () => {
    expect(kmDoDia(100_000, 100_150)).toBe(150);
    expect(kmDoDia(100_000, null)).toBeNull();
    expect(kmExcedente(150, 130)).toBe(20);
    expect(kmExcedente(130, 130)).toBe(0);
    expect(kmExcedente(null, 130)).toBe(0);
  });

  it('desconta o km rodado entre uma corrida e outra (08/10, van BRA2E19)', () => {
    // A 1ª corrida tinha 46 km; o motorista lançou nela os 65 km que rodou
    // fora de serviço e depois ela foi corrigida de volta para 46.
    const corridas = [
      { odometroInicial: 453_600, odometroFinal: 453_646 },
      { odometroInicial: 453_711, odometroFinal: 453_755 },
      { odometroInicial: 453_755, odometroFinal: 453_798 },
      { odometroInicial: 453_798, odometroFinal: 453_839 },
    ];
    expect(kmEntreCorridas(corridas)).toBe(65);
    expect(kmDoDia(453_600, 453_839, kmEntreCorridas(corridas))).toBe(174);
  });

  it('corridas emendadas não descontam nada, nem o retorno depois da última', () => {
    const corridas = [
      { odometroInicial: 100_000, odometroFinal: 100_040 },
      { odometroInicial: 100_040, odometroFinal: 100_090 },
    ];
    expect(kmEntreCorridas(corridas)).toBe(0);
    expect(kmDoDia(100_000, 100_100, kmEntreCorridas(corridas))).toBe(100);
  });

  it('ordena pelo odômetro e ignora corrida sem leitura', () => {
    expect(
      kmEntreCorridas([
        { odometroInicial: 200, odometroFinal: 250 },
        { odometroInicial: null, odometroFinal: 180 },
        { odometroInicial: 100, odometroFinal: 150 },
      ]),
    ).toBe(50);
    expect(kmEntreCorridas([])).toBe(0);
  });

  it('150 km geram R$ 60,00 ao motorista (exemplo confirmado)', () => {
    const linha = montarLinhaDoMotorista(
      {
        ...dia('2026-10-05', '06:00', '17:00'),
        motoristaId: 'm1',
        motorista: 'Carlos',
        placa: 'ABC1234',
        km: 150,
      },
      SEM_FERIADOS,
      REGRAS,
      { limiteDia: 130, valorPorKm: 3 },
    );
    expect(linha).toMatchObject({ km: 150, kmExcedente: 20, valorKm: 60 });
  });
});

describe('resumo por motorista', () => {
  it('soma diárias e km de cada um e conta os dias a conferir', () => {
    const regrasKm = { limiteDia: 130, valorPorKm: 3 };
    const base = { motoristaId: 'm1', motorista: 'Carlos', placa: 'ABC1234' };
    const linhas = [
      montarLinhaDoMotorista(
        { ...dia('2026-10-05', '05:50', '17:00'), ...base, km: 150 },
        SEM_FERIADOS,
        REGRAS,
        regrasKm,
      ),
      montarLinhaDoMotorista(
        { ...dia('2026-10-06', '06:00', '18:30'), ...base, km: 100 },
        SEM_FERIADOS,
        REGRAS,
        regrasKm,
      ),
      montarLinhaDoMotorista(
        { ...dia('2026-10-07', '06:00', null), ...base, km: null },
        SEM_FERIADOS,
        REGRAS,
        regrasKm,
      ),
    ];
    expect(resumirPorMotorista(linhas)).toEqual([
      {
        motoristaId: 'm1',
        motorista: 'Carlos',
        dias: 3,
        diarias: 2,
        valorHoraExtra: 210,
        kmExcedente: 20,
        valorKm: 60,
        total: 270,
        diasParaConferir: 1,
      },
    ]);
  });
});

const CONTRATO: ContratoDaVan = {
  veiculoId: 'v1',
  placa: 'EXE1A23',
  cliente: 'Renea',
  categoria: 'VAN_DIURNA',
  valorMensal: 20_100,
  valorKmExcedido: 9.5,
  valorDiaExtra: 1450,
  limiteKmDia: null,
  linhaOrigem: 'Carmela',
  linhaDestino: 'Bananal',
};

describe('boletim de medição por van', () => {
  // 05/10 segunda, 06/10 terça, 10/10 sábado, 12/10 feriado.
  const dias = [
    { data: '2026-10-05', motorista: 'Antonio', km: 140 },
    { data: '2026-10-06', motorista: 'Antonio', km: 120 },
    { data: '2026-10-10', motorista: 'Bruno', km: 100 },
    { data: '2026-10-12', motorista: 'Antonio', km: 90 },
  ];

  it('separa normais e extras e valoriza como o boletim atual (mensal ÷ 22)', () => {
    const van = medirVan(CONTRATO, dias, FERIADOS, 22, 130);
    expect(van.diasNormais).toEqual(['2026-10-05', '2026-10-06']);
    expect(van.diasExtras).toEqual(['2026-10-10', '2026-10-12']);
    expect(van.valorDia).toBeCloseTo(913.636364, 5);
    // 20.100 × 2 ÷ 22 = 1.827,27
    expect(van.valorNormal).toBe(1827.27);
    expect(van.kmExcedidoPorDia).toEqual({ '2026-10-05': 10 });
    expect(van.valorKm).toBe(95);
    expect(van.valorExtra).toBe(2900);
    expect(van.total).toBe(4822.27);
    expect(van.motoristas).toEqual(['Antonio', 'Bruno']);
    expect(van.pendencias).toEqual([]);
  });

  it('22 dias normais dão exatamente o valor mensal', () => {
    const vinteEDois = Array.from({ length: 22 }, (_, i) => ({
      data: `2026-11-${String(i + 1).padStart(2, '0')}`,
      motorista: 'Antonio',
      km: 100,
    }));
    // Usa só dias normais: passa todos como dia útil num calendário sem fim de semana.
    const van = medirVan(CONTRATO, vinteEDois, SEM_FERIADOS, 22, 130);
    const normais = van.diasNormais.length;
    expect(van.valorNormal).toBe(Math.round((20_100 * normais * 100) / 22) / 100);
  });

  it('duas jornadas no mesmo dia somam os km; o dia conta uma vez', () => {
    const van = medirVan(
      CONTRATO,
      [
        { data: '2026-10-05', motorista: 'Antonio', km: 80 },
        { data: '2026-10-05', motorista: 'Bruno', km: 70 },
      ],
      SEM_FERIADOS,
      22,
      130,
    );
    expect(van.diasNormais).toEqual(['2026-10-05']);
    expect(van.kmExcedido).toBe(20);
  });

  it('o limite do contrato vale antes do limite configurado', () => {
    const van = medirVan({ ...CONTRATO, limiteKmDia: 100 }, [dias[0]!], SEM_FERIADOS, 22, 130);
    expect(van.kmExcedido).toBe(40);
  });

  it('contrato incompleto e dia aberto viram pendência, não somem', () => {
    const van = medirVan(
      { ...CONTRATO, cliente: null, valorMensal: null, valorDiaExtra: null },
      [...dias, { data: '2026-10-07', motorista: 'Antonio', km: null }],
      FERIADOS,
      22,
      130,
    );
    expect(van.valorNormal).toBe(0);
    expect(van.diasNormais).toContain('2026-10-07');
    expect(van.pendencias).toEqual([
      'dia 07/10/2026 ainda aberto: km desconhecido',
      'sem cliente no contrato',
      'sem valor mensal',
      'sem valor do dia extra',
    ]);
  });
});

describe('quadro-resumo do boletim', () => {
  it('totaliza por categoria e soma os pedágios ao total geral', () => {
    const vanDiurna = medirVan(
      CONTRATO,
      [{ data: '2026-10-05', motorista: 'A', km: 140 }],
      SEM_FERIADOS,
      22,
      130,
    );
    const onibus = medirVan(
      {
        ...CONTRATO,
        veiculoId: 'v2',
        categoria: 'ONIBUS',
        valorMensal: 27_500,
        valorKmExcedido: 10.8,
        valorDiaExtra: 1950,
      },
      [{ data: '2026-10-10', motorista: 'B', km: 50 }],
      SEM_FERIADOS,
      22,
      130,
    );
    const resumo = resumirMedicao([vanDiurna, onibus], 120.5);
    expect(resumo.porCategoria.map((linha) => linha.categoria)).toEqual(['ONIBUS', 'VAN_DIURNA']);
    expect(resumo.porCategoria[0]).toMatchObject({ diasExtras: 1, valorExtra: 1950, total: 1950 });
    expect(resumo.porCategoria[1]).toMatchObject({ diasNormais: 1, kmExcedido: 10, valorKm: 95 });
    // 913,64 + 95 = 1.008,64 da van; 1.950 do ônibus; 120,50 de pedágio.
    expect(resumo.totalVeiculos).toBe(2958.64);
    expect(resumo.totalGeral).toBe(3079.14);
  });
});

describe('dias com mais de uma jornada', () => {
  const base = { motoristaId: 'm1', motorista: 'Carlos' };

  it('junta manhã e tarde num dia só: uma diária e o km somado', () => {
    const [unico, ...resto] = juntarDiasDoMotorista([
      { ...dia('2026-10-05', '05:40', '11:00'), ...base, placa: 'ABC1234', km: 80 },
      { ...dia('2026-10-05', '13:00', '18:30'), ...base, placa: 'XYZ9876', km: 90 },
    ]);
    expect(resto).toHaveLength(0);
    expect(unico).toMatchObject({ placa: 'ABC1234 / XYZ9876', km: 170 });

    const linha = montarLinhaDoMotorista(unico!, SEM_FERIADOS, REGRAS, {
      limiteDia: 130,
      valorPorKm: 3,
    });
    expect(linha.horaExtra).toMatchObject({ minutosAntes: 20, minutosDepois: 30, valor: 105 });
    expect(linha).toMatchObject({ kmExcedente: 40, valorKm: 120 });
    expect(resumirPorMotorista([linha])[0]).toMatchObject({ dias: 1, diarias: 1 });
  });

  it('fica aberto se uma das jornadas ainda não fechou', () => {
    const [unico] = juntarDiasDoMotorista([
      { ...dia('2026-10-05', '06:00', '11:00'), ...base, placa: 'ABC1234', km: 80 },
      { ...dia('2026-10-05', '13:00', null), ...base, placa: 'ABC1234', km: null },
    ]);
    expect(unico).toMatchObject({ placa: 'ABC1234', encerradaEm: null, km: null });
  });

  it('não junta motoristas nem dias diferentes', () => {
    const dias = juntarDiasDoMotorista([
      { ...dia('2026-10-06', '06:00', '17:00'), ...base, placa: 'ABC1234', km: 10 },
      { ...dia('2026-10-05', '06:00', '17:00'), ...base, placa: 'ABC1234', km: 10 },
      {
        ...dia('2026-10-05', '06:00', '17:00'),
        motoristaId: 'm2',
        motorista: 'Ana',
        placa: 'XYZ9876',
        km: 10,
      },
    ]);
    expect(dias.map((d) => `${d.data} ${d.motorista}`)).toEqual([
      '2026-10-05 Ana',
      '2026-10-05 Carlos',
      '2026-10-06 Carlos',
    ]);
  });
});
