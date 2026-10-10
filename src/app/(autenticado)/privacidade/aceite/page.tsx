import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { obterUsuarioDaSessao } from '@/lib/sessao';
import {
  AVISO_PRIVACIDADE,
  VERSAO_AVISO_PRIVACIDADE,
} from '@/modulos/privacidade/aviso-privacidade';
import { AceitePrivacidade } from '@/modulos/privacidade/componentes/aceite-privacidade';

export const metadata: Metadata = { title: 'Aviso de privacidade' };

/** T03 — Aviso de privacidade (doc 10 · US043 · RF042). */
export default async function PaginaAceitePrivacidade() {
  const usuario = await obterUsuarioDaSessao();
  if (!usuario) redirect('/login');

  // Troca de senha vem antes: não faz sentido pedir aceite informado a quem
  // ainda está usando uma senha que o administrador conhece.
  if (usuario.deveTrocarSenha) redirect('/trocar-senha');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-texto text-2xl font-semibold">Aviso de privacidade</h1>
        <p className="text-texto-suave text-sm">
          Antes de começar, leia o que o sistema registra sobre você e sobre o seu trabalho.
        </p>
      </header>

      <AceitePrivacidade
        versao={VERSAO_AVISO_PRIVACIDADE}
        secoes={AVISO_PRIVACIDADE}
        destino={usuario.perfil === 'ADMIN' ? '/admin' : '/app'}
      />
    </main>
  );
}
