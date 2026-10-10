import { CodigoErro, ErroDeNegocio } from '@/lib/erros';
import { arredondar } from '@/utilitarios/numero';

/**
 * Regras do abastecimento (US024 · RF021 · RN020).
 *
 * Duas coisas moram aqui: a validação do odômetro contra o último valor
 * conhecido da van, e o cálculo do consumo — que é a única parte do sistema
 * onde é fácil produzir um número plausível e errado.
 */

export const TIPOS_DE_COMBUSTIVEL = ['DIESEL', 'GASOLINA', 'ETANOL', 'GNV'] as const;
export type TipoDeCombustivel = (typeof TIPOS_DE_COMBUSTIVEL)[number];

export const ROTULO_DO_COMBUSTIVEL: Record<TipoDeCombustivel, string> = {
  DIESEL: 'Diesel',
  GASOLINA: 'Gasolina',
  ETANOL: 'Etanol',
  GNV: 'GNV',
};

/** GNV é vendido em metros cúbicos; o resto, em litros. */
export function unidadeDoCombustivel(tipo: TipoDeCombustivel): string {
  return tipo === 'GNV' ? 'm³' : 'L';
}

/**
 * O odômetro do abastecimento contra o último valor conhecido da van (RN020).
 *
 * Recusa o valor **menor**, que é erro de digitação ou de veículo. Não recusa o
 * valor muito maior: diferente da abertura da jornada, aqui não há como o
 * sistema saber quanto a van rodou entre um abastecimento e outro — ela pode
 * ter passado a semana inteira na estrada. Inventar um teto produziria recusa
 * em cima de registro correto, que é o jeito mais rápido de o motorista parar
 * de registrar.
 */
export function validarOdometroDoAbastecimento(
  odometroInformado: number,
  odometroAtualDoVeiculo: number,
): void {
  if (odometroInformado < odometroAtualDoVeiculo) {
    throw new ErroDeNegocio(
      CodigoErro.ODOMETRO_MENOR_QUE_ULTIMO,
      `O odômetro não pode ser menor que ${odometroAtualDoVeiculo.toLocaleString('pt-BR')} km, ` +
        'último valor registrado para esta van.',
      { odometro: 'Menor que o último valor registrado.' },
    );
  }
}

/** Litros e valor precisam ser positivos; zero é engano, não registro. */
export function validarQuantidade(litros: number): void {
  if (litros <= 0) {
    throw new ErroDeNegocio(CodigoErro.DADOS_INVALIDOS, 'Informe quanto foi abastecido.', {
      litros: 'Precisa ser maior que zero.',
    });
  }
}

export interface AbastecimentoParaConsumo {
  odometro: number;
  litros: number;
  tanqueCheio: boolean | null;
  tipoCombustivel?: TipoDeCombustivel;
}

export interface ConsumoDoVeiculo {
  tipoCombustivel: TipoDeCombustivel | null;
  /** Km entre o primeiro e o último abastecimento do período. */
  kmPercorrido: number;
  /** Litros considerados no cálculo — **sem** os do primeiro abastecimento. */
  litrosConsiderados: number;
  /** Km por litro, ou `null` quando não há base para calcular. */
  mediaKmPorLitro: number | null;
  /** Quantos abastecimentos entraram na conta. */
  abastecimentos: number;
}

/**
 * Consumo médio pelo método **tanque a tanque**.
 *
 * O erro clássico — e o motivo de esta função existir com teste — é dividir a
 * quilometragem total pela soma de **todos** os litros. Os litros do primeiro
 * abastecimento não rodaram nenhum dos quilômetros medidos: eles encheram o
 * tanque no ponto de partida. Contá-los infla o denominador e faz a van parecer
 * mais gastadora do que é.
 *
 * O que se mede é: a distância entre o primeiro e o último abastecimento,
 * dividida pelo combustível colocado **depois** do primeiro — que é exatamente
 * o que foi queimado para percorrê-la.
 *
 * Só as pontas precisam ter tanque cheio confirmado. Parciais (e registros
 * antigos de quantidade conhecida) entre elas entram na soma. Antes da
 * primeira ponta e depois da última, os registros não entram na medida.
 * Combustíveis diferentes não geram uma média única: não sabemos qual deles
 * foi consumido em cada trecho, especialmente em veículos com dois sistemas.
 */
export function calcularConsumo(abastecimentos: AbastecimentoParaConsumo[]): ConsumoDoVeiculo {
  const emOrdem = [...abastecimentos].sort((um, outro) => um.odometro - outro.odometro);
  const primeiroIndice = emOrdem.findIndex((abastecimento) => abastecimento.tanqueCheio === true);
  let ultimoIndice = -1;
  for (let indice = emOrdem.length - 1; indice >= 0; indice--) {
    if (emOrdem[indice]!.tanqueCheio === true) {
      ultimoIndice = indice;
      break;
    }
  }
  const medidos =
    primeiroIndice >= 0 && ultimoIndice > primeiroIndice
      ? emOrdem.slice(primeiroIndice, ultimoIndice + 1)
      : [];
  const combustiveis = new Set(
    medidos.map((abastecimento) => abastecimento.tipoCombustivel ?? 'DIESEL'),
  );

  if (medidos.length < 2 || combustiveis.size > 1) {
    return {
      tipoCombustivel: null,
      kmPercorrido: 0,
      litrosConsiderados: 0,
      mediaKmPorLitro: null,
      abastecimentos: 0,
    };
  }

  const primeiro = medidos[0]!;
  const ultimo = medidos[medidos.length - 1]!;

  const kmPercorrido = ultimo.odometro - primeiro.odometro;
  const litrosConsiderados = medidos
    .slice(1)
    .reduce((soma, abastecimento) => soma + abastecimento.litros, 0);

  return {
    tipoCombustivel: primeiro.tipoCombustivel ?? 'DIESEL',
    kmPercorrido,
    litrosConsiderados: arredondar(litrosConsiderados, 2),
    // Km sem combustível entre as pontas, ou combustível sem km: as duas
    // situações produzem número sem sentido, e `null` é mais honesto que zero.
    mediaKmPorLitro:
      litrosConsiderados > 0 && kmPercorrido > 0
        ? arredondar(kmPercorrido / litrosConsiderados, 2)
        : null,
    abastecimentos: medidos.length,
  };
}

/** Preço por litro de um abastecimento, quando o valor total foi informado. */
export function precoPorLitro(valorTotal: number | null, litros: number): number | null {
  if (valorTotal === null || litros <= 0) return null;
  return arredondar(valorTotal / litros, 3);
}
