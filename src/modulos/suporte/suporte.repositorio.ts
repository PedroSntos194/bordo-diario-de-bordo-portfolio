import type { ClientePrisma } from '@/lib/prisma';

/** Acesso a dados do suporte. */

/** Já existe aviso ao administrador para este erro hoje? */
export async function avisoDeErroJaRegistrado(
  cliente: ClientePrisma,
  chave: string,
): Promise<boolean> {
  const existente = await cliente.notificacao.findFirst({
    where: { tipo: 'FALHA_SISTEMA', referenciaChave: chave },
    select: { id: true },
  });
  return existente !== null;
}
