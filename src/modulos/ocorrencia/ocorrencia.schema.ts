import { z } from 'zod';
import { esquemaLocalizacao } from '@/modulos/corrida/corrida.schema';
import {
  TAMANHO_MAXIMO_DESCRICAO,
  TAMANHO_MINIMO_DESCRICAO,
  TIPOS_DE_OCORRENCIA,
} from '@/modulos/ocorrencia/ocorrencia.regras';

/** Contrato de registro de ocorrência (US023 · RF020). */

export const esquemaRegistrarOcorrencia = z.object({
  /** Ausente = pendura na jornada aberta do próprio motorista. */
  corridaId: z.string().uuid().optional(),
  tipo: z.enum(TIPOS_DE_OCORRENCIA, {
    errorMap: () => ({ message: 'Escolha o tipo da ocorrência.' }),
  }),
  descricao: z
    .string()
    .trim()
    .min(
      TAMANHO_MINIMO_DESCRICAO,
      `Descreva o que aconteceu (mínimo de ${TAMANHO_MINIMO_DESCRICAO} caracteres).`,
    )
    .max(TAMANHO_MAXIMO_DESCRICAO),
  // O horário é do servidor, não do cliente: relógio de celular erra, e este é
  // um registro que pode virar prova em discussão trabalhista ou de seguro.
  localizacao: esquemaLocalizacao.optional(),
});

export type EntradaRegistrarOcorrencia = z.infer<typeof esquemaRegistrarOcorrencia>;
