import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterUsuarioDaSessao } from '@/lib/sessao';
import { destinoAposLogin } from '@/modulos/autenticacao/autenticacao.regras';
import { FormularioTrocaSenha } from '@/modulos/autenticacao/componentes/formulario-troca-senha';

export const metadata: Metadata = { title: 'Trocar senha' };

/** T02 — Troca obrigatória de senha (doc 10 · US002 · RF003). */
export default async function PaginaTrocarSenha() {
  const usuario = await obterUsuarioDaSessao();
  if (!usuario) redirect('/login');

  const primeiroAcesso = usuario.deveTrocarSenha;

  // Depois de trocar, o usuário segue para onde iria — aceite de privacidade,
  // se ainda faltar, ou a área do seu perfil.
  const destino = destinoAposLogin({
    perfil: usuario.perfil,
    deveTrocarSenha: false,
    aceitouPrivacidade: usuario.aceitouPrivacidade,
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-texto text-2xl font-semibold">
          {primeiroAcesso ? 'Defina sua senha' : 'Trocar senha'}
        </h1>
        <p className="text-texto-suave text-sm">
          {primeiroAcesso
            ? 'Você está usando uma senha temporária. Escolha uma senha que só você conheça para continuar.'
            : 'Informe a senha atual e escolha uma nova.'}
        </p>
      </header>

      <FormularioTrocaSenha primeiroAcesso={primeiroAcesso} destino={destino} />
    </main>
  );
}
