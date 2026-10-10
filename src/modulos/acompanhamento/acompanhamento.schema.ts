import { z } from 'zod';

export const esquemaPainelDeMotoristas = z.object({
  data: z.string().date('Escolha uma data válida.').optional(),
  busca: z.string().trim().max(120, 'A busca deve ter até 120 caracteres.').optional(),
  atencao: z.enum(['todos', 'atencao']).optional(),
});

export type EntradaPainelDeMotoristas = z.infer<typeof esquemaPainelDeMotoristas>;
