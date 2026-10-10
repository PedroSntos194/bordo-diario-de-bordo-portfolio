import { z } from 'zod';
import { TAMANHO_MINIMO_JUSTIFICATIVA } from '@/modulos/corrida/corrida.regras';

/** Contratos de entrada da corrida (US018, US019 · RF015, RF016, RF018). */

/**
 * Localização é sempre **opcional** no contrato (RN022).
 *
 * Não é descuido: o servidor precisa aceitar um registro sem coordenada, senão
 * o motorista que negou a permissão de GPS fica impedido de trabalhar.
 */
export const esquemaLocalizacao = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  precisaoMetros: z.coerce.number().min(0).nullable().optional(),
  capturadoEm: z.string().datetime().optional(),
});

export type EntradaLocalizacao = z.infer<typeof esquemaLocalizacao>;

export const esquemaIniciarCorrida = z
  .object({
    rotaId: z.string().uuid().optional(),
    origemDescricao: z.string().trim().max(160).optional().or(z.literal('')),
    destinoDescricao: z.string().trim().max(160).optional().or(z.literal('')),
    localizacao: esquemaLocalizacao.optional(),
    clientUuid: z.string().uuid().optional(),
  })
  .refine(
    (dados) =>
      Boolean(dados.rotaId) ||
      (Boolean(dados.origemDescricao?.trim()) && Boolean(dados.destinoDescricao?.trim())),
    {
      path: ['rotaId'],
      message: 'Escolha uma rota ou informe origem e destino.',
    },
  );

export type EntradaIniciarCorrida = z.infer<typeof esquemaIniciarCorrida>;

export const esquemaEncerrarCorrida = z.object({
  id: z.string().uuid(),
  odometroFinal: z.coerce
    .number({ invalid_type_error: 'Informe o odômetro em quilômetros.' })
    .int('Informe o odômetro em quilômetros inteiros.')
    .min(0, 'O odômetro não pode ser negativo.')
    .max(9_999_999, 'Valor acima do plausível.'),
  quantidadePassageiros: z.coerce
    .number()
    .int('Informe um número inteiro de passageiros.')
    .min(0)
    .max(200)
    .nullable()
    .optional(),
  observacoes: z.string().trim().max(500).optional().or(z.literal('')),
  confirmaExcessoPassageiros: z.coerce.boolean().default(false),
  localizacao: esquemaLocalizacao.optional(),
});

export type EntradaEncerrarCorrida = z.infer<typeof esquemaEncerrarCorrida>;

export const esquemaCancelarCorrida = z.object({
  id: z.string().uuid(),
  motivo: z
    .string()
    .trim()
    .min(
      TAMANHO_MINIMO_JUSTIFICATIVA,
      `Descreva o motivo do cancelamento (mínimo de ${TAMANHO_MINIMO_JUSTIFICATIVA} caracteres).`,
    )
    .max(240),
});

export type EntradaCancelarCorrida = z.infer<typeof esquemaCancelarCorrida>;

export const esquemaEncerrarJornada = z.object({
  odometroFinal: z.coerce
    .number({ invalid_type_error: 'Informe o odômetro em quilômetros.' })
    .int('Informe o odômetro em quilômetros inteiros.')
    .min(0, 'O odômetro não pode ser negativo.')
    .max(9_999_999, 'Valor acima do plausível.'),
  observacoes: z.string().trim().max(500).optional().or(z.literal('')),
  /** Horário do celular para o encerramento feito sem sinal; ver `horarioDoRegistro`. */
  ocorridoEm: z.string().datetime({ offset: true }).optional(),
});

export type EntradaEncerrarJornada = z.infer<typeof esquemaEncerrarJornada>;

/**
 * Correção de uma corrida encerrada (US022 · RF023 · RN019).
 *
 * Só os campos que o motorista pode ter errado entram aqui: odômetro final,
 * passageiros e observações. Horário de início, rota e odômetro inicial ficam
 * de fora **de propósito** — mexer neles reescreveria a cadeia de odômetros da
 * jornada inteira (RN020), e correção não é reabertura do dia.
 */
export const esquemaCorrigirCorrida = z.object({
  id: z.string().uuid(),
  odometroFinal: z.coerce
    .number({ invalid_type_error: 'Informe o odômetro em quilômetros.' })
    .int('Informe o odômetro em quilômetros inteiros.')
    .min(0, 'O odômetro não pode ser negativo.')
    .max(9_999_999, 'Valor acima do plausível.'),
  quantidadePassageiros: z.coerce
    .number()
    .int('Informe um número inteiro de passageiros.')
    .min(0)
    .max(200)
    .nullable()
    .optional(),
  observacoes: z.string().trim().max(500).optional().or(z.literal('')),
  justificativa: z
    .string()
    .trim()
    .min(
      TAMANHO_MINIMO_JUSTIFICATIVA,
      `Descreva o motivo da correção (mínimo de ${TAMANHO_MINIMO_JUSTIFICATIVA} caracteres).`,
    )
    .max(500),
});

export type EntradaCorrigirCorrida = z.infer<typeof esquemaCorrigirCorrida>;
