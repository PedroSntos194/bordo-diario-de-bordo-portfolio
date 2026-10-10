/**
 * Placa de veículo — formato antigo (`ABC1234`) e Mercosul (`ABC1D23`).
 *
 * A frota pode ter veículos dos dois períodos, então os dois formatos são
 * aceitos. O armazenamento é sempre em maiúsculas e sem hífen.
 */

const FORMATO_ANTIGO = /^[A-Z]{3}\d{4}$/;
const FORMATO_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

/** Maiúsculas, sem hífen, sem espaço. */
export function normalizarPlaca(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function placaEhValida(valor: string): boolean {
  const placa = normalizarPlaca(valor);
  return FORMATO_ANTIGO.test(placa) || FORMATO_MERCOSUL.test(placa);
}

export function formatoDaPlaca(valor: string): 'ANTIGO' | 'MERCOSUL' | 'INVALIDO' {
  const placa = normalizarPlaca(valor);
  if (FORMATO_MERCOSUL.test(placa)) return 'MERCOSUL';
  if (FORMATO_ANTIGO.test(placa)) return 'ANTIGO';
  return 'INVALIDO';
}

/**
 * Exibição: o formato antigo leva hífen (`ABC-1234`), o Mercosul não
 * (`ABC1D23`), conforme o padrão de cada época.
 */
export function formatarPlaca(valor: string): string {
  const placa = normalizarPlaca(valor);
  if (FORMATO_ANTIGO.test(placa)) return `${placa.slice(0, 3)}-${placa.slice(3)}`;
  return placa;
}
