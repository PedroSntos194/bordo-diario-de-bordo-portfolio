import { z } from 'zod';
import { cpfEhValido, normalizarCpf } from '@/utilitarios/cpf';
import { POLITICA_SENHA } from '@/modulos/usuario/usuario.regras';
import { VERSAO_AVISO_PRIVACIDADE } from '@/modulos/privacidade/aviso-privacidade';

/**
 * Esquemas de entrada da autenticação.
 *
 * O mesmo objeto é usado no formulário (navegador), na Server Action e na rota
 * de API. Duplicar validação entre cliente e servidor é como as duas pontas
 * acabam divergindo — aqui não há como.
 */

export const esquemaLogin = z.object({
  cpf: z
    .string()
    .min(1, 'Informe seu CPF.')
    // Aceita com ou sem máscara e normaliza antes de qualquer verificação.
    .transform(normalizarCpf)
    .refine(cpfEhValido, 'CPF inválido. Confira os números digitados.'),
  senha: z.string().min(1, 'Informe sua senha.'),
  retorno: z.string().optional(),
});

export type EntradaLogin = z.infer<typeof esquemaLogin>;

export const esquemaTrocaDeSenha = z
  .object({
    /** Dispensada no primeiro acesso: o login com a senha temporária já provou a posse. */
    senhaAtual: z.string().optional(),
    novaSenha: z
      .string()
      .min(
        POLITICA_SENHA.tamanhoMinimo,
        `A senha precisa ter no mínimo ${POLITICA_SENHA.tamanhoMinimo} caracteres.`,
      ),
    confirmacao: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((dados) => dados.novaSenha === dados.confirmacao, {
    path: ['confirmacao'],
    message: 'As senhas não conferem.',
  });

export type EntradaTrocaDeSenha = z.infer<typeof esquemaTrocaDeSenha>;

/**
 * Só a versão vigente é aceita. Sem isso o registro de aceite gravaria o que o
 * navegador mandasse — inclusive a versão antiga, de uma aba aberta antes da
 * troca do texto, que o usuário nunca leu na forma nova.
 */
export const esquemaAceitePrivacidade = z.object({
  versaoTexto: z.literal(VERSAO_AVISO_PRIVACIDADE, {
    errorMap: () => ({
      message: 'O aviso de privacidade foi atualizado. Recarregue a página e leia a nova versão.',
    }),
  }),
});

export type EntradaAceitePrivacidade = z.infer<typeof esquemaAceitePrivacidade>;
