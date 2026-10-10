import { z } from 'zod';
import { FORMAS_DE_PAGAMENTO, VALOR_MAXIMO_PEDAGIO } from '@/modulos/pedagio/pedagio.regras';

/** Contrato de entrada do pedágio. */

export const esquemaRegistrarPedagio = z.object({
  /** Aceita vírgula: o recibo mostra "12,50". */
  valor: z.preprocess(
    (valor) => (typeof valor === 'string' ? valor.trim().replace(',', '.') : valor),
    z.coerce
      .number({ invalid_type_error: 'Informe o valor pago.' })
      .positive('Informe o valor pago.')
      .max(VALOR_MAXIMO_PEDAGIO, `Valor acima de R$ ${VALOR_MAXIMO_PEDAGIO}: confira o recibo.`),
  ),
  praca: z.string().trim().max(120, 'Use até 120 caracteres.').optional().or(z.literal('')),
  formaPagamento: z.enum(FORMAS_DE_PAGAMENTO, {
    errorMap: () => ({ message: 'Escolha como pagou.' }),
  }),
});

export type EntradaRegistrarPedagio = z.infer<typeof esquemaRegistrarPedagio>;
