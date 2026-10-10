'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Recarrega os dados da página de tempos em tempos, sem recarregar a página.
 *
 * Para painéis que ficam abertos numa tela durante o turno. Só atualiza com a
 * aba visível — em segundo plano não gasta consulta — e atualiza na hora quando
 * a aba volta a ficar visível, para ninguém olhar um número velho.
 *
 * Genérico: não conhece o que a página mostra.
 */
export function AtualizacaoAutomatica({ segundos }: { segundos: number }) {
  const router = useRouter();

  useEffect(() => {
    const atualizar = (): void => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const intervalo = window.setInterval(atualizar, segundos * 1000);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [router, segundos]);

  return null;
}
