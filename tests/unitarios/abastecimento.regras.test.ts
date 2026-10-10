import { describe, expect, it } from 'vitest';
import { CodigoErro, ehErroDaAplicacao } from '@/lib/erros';
import { esquemaRegistrarAbastecimento } from '@/modulos/abastecimento/abastecimento.schema';
import {
  ROTULO_DO_COMBUSTIVEL,
  TIPOS_DE_COMBUSTIVEL,
  calcularConsumo,
  precoPorLitro,
  unidadeDoCombustivel,
  validarOdometroDoAbastecimento,
  validarQuantidade,
} from '@/modulos/abastecimento/abastecimento.regras';

/** US024 — odômetro do abastecimento (RN020) e consumo tanque a tanque. */

function codigoDoErro(executar: () => void): string | null {
  try {
    executar();
    return null;
  } catch (erro) {
    return ehErroDaAplicacao(erro) ? erro.codigo : 'DESCONHECIDO';
  }
}

describe('validarOdometroDoAbastecimento', () => {
  it('aceita valor igual ou maior que o último conhecido', () => {
    expect(codigoDoErro(() => validarOdometroDoAbastecimento(160540, 160540))).toBe(null);
    expect(codigoDoErro(() => validarOdometroDoAbastecimento(161200, 160540))).toBe(null);
  });

  it('recusa valor menor, dizendo qual é o último (RN020)', () => {
    let mensagem = '';
    try {
      validarOdometroDoAbastecimento(160000, 160540);
    } catch (erro) {
      mensagem = ehErroDaAplicacao(erro) ? erro.message : '';
      expect(ehErroDaAplicacao(erro) && erro.codigo).toBe(CodigoErro.ODOMETRO_MENOR_QUE_ULTIMO);
    }

    expect(mensagem).toContain('160.540 km');
  });

  it('não põe teto para cima', () => {
    // Diferente da abertura da jornada, aqui o sistema não tem como saber
    // quanto a van rodou entre um abastecimento e outro — ela pode ter passado
    // a semana na estrada. Inventar um teto recusaria registro correto.
    expect(codigoDoErro(() => validarOdometroDoAbastecimento(999_000, 160540))).toBe(null);
  });
});

describe('validarQuantidade', () => {
  it('recusa zero e negativo', () => {
    expect(codigoDoErro(() => validarQuantidade(0))).toBe(CodigoErro.DADOS_INVALIDOS);
    expect(codigoDoErro(() => validarQuantidade(-10))).toBe(CodigoErro.DADOS_INVALIDOS);
  });

  it('aceita fração — a bomba não para em número redondo', () => {
    expect(codigoDoErro(() => validarQuantidade(58.4))).toBe(null);
  });
});

describe('calcularConsumo', () => {
  it('não calcula com menos de dois abastecimentos', () => {
    expect(calcularConsumo([]).mediaKmPorLitro).toBe(null);
    expect(
      calcularConsumo([{ odometro: 100_000, litros: 60, tanqueCheio: true }]).mediaKmPorLitro,
    ).toBe(null);
  });

  it('ignora os litros do primeiro abastecimento', () => {
    // É o erro clássico da conta. O combustível do primeiro encheu o tanque no
    // ponto de partida e não rodou nenhum dos quilômetros medidos: contá-lo
    // infla o denominador e faz a van parecer mais gastadora do que é.
    const consumo = calcularConsumo([
      { odometro: 100_000, litros: 50, tanqueCheio: true },
      { odometro: 100_500, litros: 50, tanqueCheio: true },
    ]);

    expect(consumo.kmPercorrido).toBe(500);
    expect(consumo.litrosConsiderados).toBe(50);
    expect(consumo.mediaKmPorLitro).toBe(10);

    // A conta ingênua — 500 / 100 — daria 5 km/L, metade do real.
    expect(consumo.mediaKmPorLitro).not.toBe(5);
  });

  it('soma o combustível de todas as paradas depois da primeira', () => {
    const consumo = calcularConsumo([
      { odometro: 200_000, litros: 40, tanqueCheio: true },
      { odometro: 200_400, litros: 50, tanqueCheio: true },
      { odometro: 200_900, litros: 50, tanqueCheio: true },
    ]);

    expect(consumo.kmPercorrido).toBe(900);
    expect(consumo.litrosConsiderados).toBe(100);
    expect(consumo.mediaKmPorLitro).toBe(9);
    expect(consumo.abastecimentos).toBe(3);
  });

  it('ordena por odômetro, não pela ordem recebida', () => {
    // A listagem chega do mais novo para o mais velho, e um registro lançado
    // com atraso tem data fora de ordem sem a quilometragem estar errada.
    const consumo = calcularConsumo([
      { odometro: 200_900, litros: 50, tanqueCheio: true },
      { odometro: 200_000, litros: 40, tanqueCheio: true },
      { odometro: 200_400, litros: 50, tanqueCheio: true },
    ]);

    expect(consumo.kmPercorrido).toBe(900);
    expect(consumo.mediaKmPorLitro).toBe(9);
  });

  it('não devolve número quando a van não andou entre as pontas', () => {
    // Dois abastecimentos com o mesmo odômetro produziriam divisão por zero km;
    // `null` é mais honesto que um zero que parece consumo medido.
    const consumo = calcularConsumo([
      { odometro: 100_000, litros: 50, tanqueCheio: true },
      { odometro: 100_000, litros: 30, tanqueCheio: true },
    ]);

    expect(consumo.mediaKmPorLitro).toBe(null);
  });

  it('arredonda a média em duas casas', () => {
    const consumo = calcularConsumo([
      { odometro: 0, litros: 10, tanqueCheio: true },
      { odometro: 1000, litros: 123, tanqueCheio: true },
    ]);

    expect(consumo.mediaKmPorLitro).toBe(8.13);
  });
});

describe('tanque cheio e abastecimentos parciais', () => {
  it('mede 500 km com 20 litros parciais e 30 litros ao completar novamente', () => {
    const consumo = calcularConsumo([
      { odometro: 100000, litros: 60, tanqueCheio: true },
      { odometro: 100200, litros: 20, tanqueCheio: false },
      { odometro: 100500, litros: 30, tanqueCheio: true },
      { odometro: 100700, litros: 20, tanqueCheio: false },
    ]);
    expect(consumo.mediaKmPorLitro).toBe(10);
    expect(consumo.kmPercorrido).toBe(500);
    expect(consumo.litrosConsiderados).toBe(50);
    expect(consumo.abastecimentos).toBe(3);
  });

  it('não presume tanque cheio em registros antigos ou em um parcial final', () => {
    expect(
      calcularConsumo([
        { odometro: 100000, litros: 50, tanqueCheio: null },
        { odometro: 100500, litros: 50, tanqueCheio: null },
      ]).mediaKmPorLitro,
    ).toBeNull();
    expect(
      calcularConsumo([
        { odometro: 100000, litros: 50, tanqueCheio: true },
        { odometro: 100500, litros: 20, tanqueCheio: false },
      ]).mediaKmPorLitro,
    ).toBeNull();
  });

  it('usa somente a distância após o primeiro tanque cheio confirmado', () => {
    const consumo = calcularConsumo([
      { odometro: 99000, litros: 60, tanqueCheio: null },
      { odometro: 100000, litros: 50, tanqueCheio: true },
      { odometro: 100250, litros: 20, tanqueCheio: null },
      { odometro: 100500, litros: 30, tanqueCheio: true },
    ]);
    expect(consumo.mediaKmPorLitro).toBe(10);
    expect(consumo.kmPercorrido).toBe(500);
  });

  it('não soma litros de gasolina com metros cúbicos de GNV', () => {
    const consumo = calcularConsumo([
      { odometro: 100000, litros: 30, tanqueCheio: true, tipoCombustivel: 'GASOLINA' },
      { odometro: 100200, litros: 10, tanqueCheio: false, tipoCombustivel: 'GNV' },
      { odometro: 100500, litros: 30, tanqueCheio: true, tipoCombustivel: 'GASOLINA' },
    ]);
    expect(consumo.mediaKmPorLitro).toBeNull();
  });

  it('identifica a unidade do trecho medido, mesmo com outro combustível fora dele', () => {
    const consumo = calcularConsumo([
      { odometro: 99000, litros: 20, tanqueCheio: false, tipoCombustivel: 'GASOLINA' },
      { odometro: 100000, litros: 20, tanqueCheio: true, tipoCombustivel: 'GNV' },
      { odometro: 100200, litros: 20, tanqueCheio: true, tipoCombustivel: 'GNV' },
    ]);
    expect(consumo.mediaKmPorLitro).toBe(10);
    expect(unidadeDoCombustivel(consumo.tipoCombustivel!)).toBe('m³');
  });

  it('aceita clientes antigos sem tratar o campo omitido como sim', () => {
    const dados = { odometro: 100000, litros: 50, tipoCombustivel: 'DIESEL' };
    expect(esquemaRegistrarAbastecimento.parse(dados).tanqueCheio).toBeNull();
    expect(esquemaRegistrarAbastecimento.parse({ ...dados, tanqueCheio: false }).tanqueCheio).toBe(
      false,
    );
    expect(
      esquemaRegistrarAbastecimento.safeParse({ ...dados, tanqueCheio: 'false' }).success,
    ).toBe(false);
  });
});

describe('precoPorLitro', () => {
  it('divide o valor pago pelo volume, em três casas', () => {
    expect(precoPorLitro(350.4, 58.4)).toBe(6);
    expect(precoPorLitro(100, 16.5)).toBe(6.061);
  });

  it('devolve nulo sem valor informado ou sem volume', () => {
    expect(precoPorLitro(null, 58.4)).toBe(null);
    expect(precoPorLitro(350, 0)).toBe(null);
  });
});

describe('unidade e rótulos', () => {
  it('GNV é vendido em metro cúbico, o resto em litro', () => {
    expect(unidadeDoCombustivel('GNV')).toBe('m³');
    expect(unidadeDoCombustivel('DIESEL')).toBe('L');
  });

  it('todo combustível tem rótulo em português', () => {
    for (const tipo of TIPOS_DE_COMBUSTIVEL) {
      expect(ROTULO_DO_COMBUSTIVEL[tipo]).toBeTruthy();
    }
  });
});
