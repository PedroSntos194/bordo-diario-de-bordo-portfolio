import Link from 'next/link';

/** Tela T32 — página não encontrada (doc 10). */
export default function NaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-texto text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-texto-suave">
        O endereço acessado não existe ou o registro não está mais disponível.
      </p>
      <Link
        href="/"
        className="bg-primaria min-h-[--spacing-toque] rounded-[--radius-padrao] px-6 py-2 font-medium text-white"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
