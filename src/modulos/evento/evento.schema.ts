import { z } from 'zod';
import { esquemaLocalizacao } from '@/modulos/corrida/corrida.schema';
import { TIPOS_MANUAIS } from '@/modulos/evento/evento.regras';

/** Contratos dos eventos da corrida (US021 · RF017). */

export const esquemaRegistrarEvento = z.object({
  corridaId: z.string().uuid(),
  tipo: z.enum(TIPOS_MANUAIS, {
    errorMap: () => ({ message: 'Tipo de evento inválido.' }),
  }),
  /** Ponto da rota cadastrada; ausente em corrida avulsa. */
  pontoParadaId: z.string().uuid().optional(),
  /** Nome livre da parada — obrigatório quando não há ponto cadastrado. */
  descricao: z.string().trim().max(160).optional().or(z.literal('')),
  localizacao: esquemaLocalizacao.optional(),
  clientUuid: z.string().uuid().optional(),
});

export type EntradaRegistrarEvento = z.infer<typeof esquemaRegistrarEvento>;

export const esquemaDesfazerEvento = z.object({ id: z.string().uuid() });

export type EntradaDesfazerEvento = z.infer<typeof esquemaDesfazerEvento>;
