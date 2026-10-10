import Link from 'next/link';
import { obterUsuarioDaSessao } from '@/lib/sessao';

/**
 * Tela T31 — acesso não permitido (doc 10).
 *
 * O botão leva à área do próprio perfil, não a uma página genérica: quem chegou
 * aqui errou de área, e devolvê-lo ao lugar certo evita a segunda tentativa.
 */
export default async function AcessoNaoPermitido() {
  const usuario = await obterUsuarioDaSessao();
  const destino = usuario?.perfil === 'ADMIN' ? '/admin' : '/app';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-texto text-2xl font-semibold">Acesso não permitido</h1>
      <p className="text-texto-suave">
        Você não tem acesso a esta área. Se acredita que deveria ter, procure o administrador.
      </p>
      <Link
        href={destino}
        className="bg-primaria min-h-[--spacing-toque] rounded-[--radius-padrao] px-6 py-2 font-medium text-white"
      >
        Ir para a minha área
      </Link>
    </main>
  );
}
