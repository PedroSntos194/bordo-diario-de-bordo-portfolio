/**
 * Pedágio (observações do cliente de 07/10/2026).
 *
 * O motorista registra o pedágio pago no dia, com o dia aberto, como faz com o
 * abastecimento. O total do período entra no boletim de medição, como no
 * boletim atual ("PEDÁGIOS"). Por enquanto é registro online, como o
 * abastecimento; sem sinal, o motorista registra quando a conexão voltar.
 */

export const FORMAS_DE_PAGAMENTO = ['DINHEIRO', 'TAG', 'CARTAO'] as const;
export type FormaDePagamento = (typeof FORMAS_DE_PAGAMENTO)[number];

export const ROTULO_DA_FORMA: Record<FormaDePagamento, string> = {
  DINHEIRO: 'Dinheiro',
  TAG: 'Tag',
  CARTAO: 'Cartão',
};

/** Maior valor aceito num pedágio — acima disso é quase sempre um zero a mais. */
export const VALOR_MAXIMO_PEDAGIO = 500;

export function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
