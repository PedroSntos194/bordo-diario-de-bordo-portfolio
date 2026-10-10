'use client';

import { useEffect } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { relatarErro } from '@/modulos/suporte/relato';

/**
 * Tela T33 — erro inesperado (doc 10, doc 18).
 *
 * Nenhum detalhe técnico aparece aqui: sem stack trace, sem SQL, sem nome de
 * tabela. O `digest` é o identificador que liga o que o usuário vê ao que está
 * no log do servidor, e é isso que o suporte precisa.
 */
export default function ErroInesperado({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O log detalhado já foi gravado no servidor; aqui fica só o rastro do cliente.
    console.error('Falha na renderização', error.digest);
    // Erro de renderização não chega ao `window.onerror`: o React o captura
    // antes. O `digest` vai junto para ligar o relato ao log do servidor.
    relatarErro(error.digest ? new Error(`${error.message} (código ${error.digest})`) : error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-texto text-2xl font-semibold">Algo não saiu como esperado</h1>
      <p className="text-texto-suave">
        Não conseguimos concluir agora. Tente novamente em alguns instantes.
      </p>
      {error.digest ? (
        <p className="text-texto-suave text-xs">
          Se o problema continuar, informe este código ao suporte:{' '}
          <code className="bg-superficie rounded px-1.5 py-0.5 font-mono">{error.digest}</code>
        </p>
      ) : null}
      <Botao onClick={reset}>Tentar novamente</Botao>
    </main>
  );
}
