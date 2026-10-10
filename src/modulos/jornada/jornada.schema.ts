import { z } from 'zod';

/** Contratos de entrada da jornada (US016 · RF014). */

export const esquemaAbrirJornada = z.object({
  veiculoId: z.string().uuid('Selecione o veículo.'),
  odometroInicial: z.coerce
    .number({ invalid_type_error: 'Informe o odômetro em quilômetros.' })
    .int('Informe o odômetro em quilômetros inteiros.')
    .min(0, 'O odômetro não pode ser negativo.')
    .max(9_999_999, 'Valor acima do plausível.'),
  /**
   * Marcado pelo motorista quando o sistema pede confirmação de divergência
   * (RN015). Chega falso por padrão: confirmar é sempre ação explícita.
   */
  confirmaDivergencia: z.coerce.boolean().default(false),
  /**
   * Identificador gerado no aparelho, para idempotência da sincronização
   * offline (RN025). Já entra no contrato agora para que a US025 não precise
   * alterar o endpoint depois.
   */
  clientUuid: z.string().uuid().optional(),
  /**
   * Horário em que o motorista tocou, guardado no celular quando o registro foi
   * feito sem sinal. Só a sincronização envia; ver `horarioDoRegistro`.
   */
  ocorridoEm: z.string().datetime({ offset: true }).optional(),
});

export type EntradaAbrirJornada = z.infer<typeof esquemaAbrirJornada>;

/** Reabrir o dia pela administração: o motivo fica na trilha de auditoria. */
export const esquemaReabrirJornada = z.object({
  id: z.string().uuid(),
  motivo: z
    .string()
    .trim()
    .min(5, 'Conte em poucas palavras por que o dia será reaberto.')
    .max(240, 'Use até 240 caracteres.'),
});

export type EntradaReabrirJornada = z.infer<typeof esquemaReabrirJornada>;
