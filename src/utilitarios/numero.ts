/**
 * Formatação numérica em pt-BR (RNF023): vírgula decimal e ponto de milhar.
 */

const formatadorDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatadorInteiro = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
});

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** `12,4 km` */
export function formatarKm(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (Number.isNaN(numero)) return '—';
  return `${formatadorDecimal.format(numero)} km`;
}

/** `84.320` — odômetro é sempre inteiro. */
export function formatarOdometro(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return formatadorInteiro.format(valor);
}

/** `R$ 320,50` */
export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (Number.isNaN(numero)) return '—';
  return formatadorMoeda.format(numero);
}

/** `45,3 L` */
export function formatarLitros(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  const numero = typeof valor === 'string' ? Number(valor) : valor;
  if (Number.isNaN(numero)) return '—';
  return `${formatadorDecimal.format(numero)} L`;
}

/**
 * Interpreta número digitado por pessoa: aceita `1.234,5` e `1234.5`.
 * Devolve `null` quando não há número reconhecível — nunca `NaN`, que se
 * propagaria silenciosamente por um cálculo de quilometragem.
 */
export function interpretarNumero(entrada: string): number | null {
  const limpo = entrada.trim();
  if (limpo === '') return null;

  const temVirgula = limpo.includes(',');
  const normalizado = temVirgula ? limpo.replace(/\./g, '').replace(',', '.') : limpo;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

/** Arredonda para duas casas sem o erro de ponto flutuante de `toFixed`. */
export function arredondar(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * fator) / fator;
}
