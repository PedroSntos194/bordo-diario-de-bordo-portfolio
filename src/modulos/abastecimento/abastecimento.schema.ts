import { z } from 'zod';
import { TIPOS_DE_COMBUSTIVEL } from '@/modulos/abastecimento/abastecimento.regras';

/** Contrato de entrada do abastecimento (US024 · RF021). */

export const esquemaRegistrarAbastecimento = z.object({
  // Clientes antigos podem omitir o campo. Ausência nunca significa tanque cheio.
  tanqueCheio: z.boolean().nullable().default(null),
  odometro: z.coerce
    .number({ invalid_type_error: 'Informe o odômetro em quilômetros.' })
    .int('Informe o odômetro em quilômetros inteiros.')
    .min(0, 'O odômetro não pode ser negativo.')
    .max(9_999_999, 'Valor acima do plausível.'),

  /**
   * Aceita vírgula decimal: o motorista digita o que está na bomba, e no Brasil
   * a bomba mostra "58,4".
   */
  litros: z.coerce
    .number({ invalid_type_error: 'Informe quantos litros.' })
    .positive('Informe quantos litros.')
    .max(2000, 'Valor acima do plausível para um tanque.'),

  valorTotal: z.coerce
    .number({ invalid_type_error: 'Informe o valor pago.' })
    .min(0)
    .max(99_999)
    .nullable()
    .optional(),

  tipoCombustivel: z.enum(TIPOS_DE_COMBUSTIVEL, {
    errorMap: () => ({ message: 'Escolha o combustível.' }),
  }),

  posto: z.string().trim().max(120).optional().or(z.literal('')),
});

export type EntradaRegistrarAbastecimento = z.infer<typeof esquemaRegistrarAbastecimento>;
