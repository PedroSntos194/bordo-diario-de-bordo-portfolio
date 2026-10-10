import { somarDias } from '@/utilitarios/data';

/**
 * Feriados do fechamento (observações do cliente de 07/10/2026).
 *
 * Feriado conta como dia extra (S/D/F) no boletim e muda o horário de saída da
 * hora extra. O calendário é cadastrado pela administração: há feriados
 * municipais e estaduais que só ela sabe quais valem para a operação.
 *
 * O sistema sugere os nacionais do ano — os fixos em lei e a Sexta-feira Santa,
 * que depende da Páscoa. Carnaval e Corpus Christi são ponto facultativo e
 * ficam de fora; quem os trata como feriado cadastra à mão.
 */

const NACIONAIS_FIXOS: readonly [mes: number, dia: number, nome: string][] = [
  [1, 1, 'Confraternização Universal'],
  [4, 21, 'Tiradentes'],
  [5, 1, 'Dia do Trabalho'],
  [9, 7, 'Independência do Brasil'],
  [10, 12, 'Nossa Senhora Aparecida'],
  [11, 2, 'Finados'],
  [11, 15, 'Proclamação da República'],
  [11, 20, 'Dia Nacional de Zumbi e da Consciência Negra'],
  [12, 25, 'Natal'],
];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function domingoDePascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export interface FeriadoSugerido {
  data: string;
  nome: string;
}

export function feriadosNacionais(ano: number): FeriadoSugerido[] {
  const fixos = NACIONAIS_FIXOS.map(([mes, dia, nome]) => ({
    data: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    nome,
  }));
  const sextaSanta = { data: somarDias(domingoDePascoa(ano), -2), nome: 'Sexta-feira Santa' };
  return [...fixos, sextaSanta].sort((a, b) => a.data.localeCompare(b.data));
}

/** Só os que ainda não estão cadastrados — adicionar duas vezes não duplica nem sobrescreve. */
export function feriadosQueFaltam(
  sugeridos: readonly FeriadoSugerido[],
  cadastradas: ReadonlySet<string>,
): FeriadoSugerido[] {
  return sugeridos.filter((feriado) => !cadastradas.has(feriado.data));
}
