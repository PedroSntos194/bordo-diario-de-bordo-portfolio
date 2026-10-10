import { z } from 'zod';
import { cpfEhValido, normalizarCpf } from '@/utilitarios/cpf';
import { normalizarTelefone } from '@/utilitarios/telefone';
import { esquemaPaginacao } from '@/lib/paginacao';

/**
 * Contratos de entrada do módulo de usuários (US004 a US009).
 *
 * A normalização acontece **dentro do esquema**: o que sai daqui já está no
 * formato de armazenamento (CPF só com dígitos, telefone em E.164). Assim
 * nenhum serviço precisa lembrar de normalizar, e não existe caminho em que um
 * CPF mascarado chegue ao banco.
 */

export const PERFIS = ['ADMIN', 'MOTORISTA'] as const;
export const STATUS_USUARIO = ['ATIVO', 'INATIVO', 'BLOQUEADO'] as const;

const campoCpf = z
  .string()
  .min(1)
  .transform(normalizarCpf)
  .refine(cpfEhValido, 'CPF inválido. Confira os números digitados.');

const campoTelefone = z
  .string()
  .min(1)
  .transform((valor) => normalizarTelefone(valor) ?? valor)
  .refine(
    (valor) => valor.startsWith('+55'),
    'Telefone inválido. Use DDD + número, como (11) 99999-8888.',
  );

const campoNome = z
  .string()
  .trim()
  .min(3, 'Informe o nome completo.')
  .max(120)
  // Nome com uma palavra só quase sempre é cadastro pela metade, e o relatório
  // do dia sai identificando a pessoa por ele.
  .refine((valor) => valor.includes(' '), 'Informe nome e sobrenome.');

const camposDeMotorista = {
  cnhNumero: z.string().trim().max(20).optional().or(z.literal('')),
  cnhCategoria: z.string().trim().max(5).optional().or(z.literal('')),
  cnhValidade: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
    .optional()
    .or(z.literal('')),
};

export const esquemaCriarUsuario = z.object({
  nome: campoNome,
  cpf: campoCpf,
  telefone: campoTelefone,
  perfil: z.enum(PERFIS),
  matricula: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().email('E-mail inválido.').max(160).optional().or(z.literal('')),
  ...camposDeMotorista,
});

export type EntradaCriarUsuario = z.infer<typeof esquemaCriarUsuario>;

/**
 * Na edição o CPF é opcional: quem já tem registros operacionais não pode
 * trocá-lo (US005), então o formulário sequer o envia nesse caso.
 */
export const esquemaEditarUsuario = z.object({
  id: z.string().uuid(),
  nome: campoNome,
  cpf: campoCpf.optional(),
  telefone: campoTelefone,
  perfil: z.enum(PERFIS),
  matricula: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().email('E-mail inválido.').max(160).optional().or(z.literal('')),
  ...camposDeMotorista,
});

export type EntradaEditarUsuario = z.infer<typeof esquemaEditarUsuario>;

export const esquemaAlterarStatus = z.object({
  id: z.string().uuid(),
  status: z.enum([...STATUS_USUARIO, 'EXCLUIDO'] as const),
  motivo: z.string().trim().max(240).optional().or(z.literal('')),
});

export type EntradaAlterarStatus = z.infer<typeof esquemaAlterarStatus>;

export const esquemaRedefinirSenha = z.object({
  id: z.string().uuid(),
});

export const esquemaListarUsuarios = esquemaPaginacao.extend({
  busca: z.string().trim().max(120).optional(),
  perfil: z.enum(PERFIS).optional(),
  status: z.enum([...STATUS_USUARIO, 'EXCLUIDO'] as const).optional(),
  ordenar: z.enum(['nome', 'criadoEm', 'ultimoLoginEm']).default('nome'),
  direcao: z.enum(['asc', 'desc']).default('asc'),
});

export type EntradaListarUsuarios = z.infer<typeof esquemaListarUsuarios>;
