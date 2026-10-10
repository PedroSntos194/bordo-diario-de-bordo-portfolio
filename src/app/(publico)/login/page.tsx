import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MarcaBordo } from '@/componentes/marca/marca-bordo';
import { obterUsuarioDaSessao } from '@/lib/sessao';
import { retornoEhSeguro } from '@/modulos/autenticacao/autenticacao.regras';
import { FormularioLogin } from '@/modulos/autenticacao/componentes/formulario-login';

export const metadata: Metadata = { title: 'Entrar' };

/**
 * T01 — Login (doc 10).
 *
 * "Qual seria a primeira coisa que o usuário deveria visualizar ao entrar no
 * sistema? login" — resposta do cliente no levantamento.
 */
export default async function PaginaDeLogin({
  searchParams,
}: {
  searchParams: Promise<{ retorno?: string }>;
}) {
  // Quem já tem sessão não precisa ver o login de novo.
  const usuario = await obterUsuarioDaSessao();
  if (usuario) redirect('/');

  const { retorno } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <MarcaBordo className="size-16" />
        <div className="flex flex-col gap-1">
          <h1 className="text-texto text-3xl font-semibold tracking-tight">Bordo</h1>
          <p className="text-texto-suave text-sm">Diário de bordo digital</p>
        </div>
      </header>

      <FormularioLogin retorno={retornoEhSeguro(retorno) ? retorno : undefined} />
    </main>
  );
}
