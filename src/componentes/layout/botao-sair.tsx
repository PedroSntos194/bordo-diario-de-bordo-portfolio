'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LogOut } from 'lucide-react';
import { sair } from '@/modulos/autenticacao/autenticacao.acoes';

/**
 * Encerramento de sessão (US003 · RF008).
 *
 * Após sair, `refresh()` limpa o cache do roteador — sem ele, o botão "voltar"
 * do navegador exibiria a tela anterior a partir do cache do cliente. A sessão
 * no servidor já está invalidada, mas a tela em cache passaria a impressão de
 * que o logout não funcionou.
 */
export function BotaoSair() {
  const router = useRouter();
  const [saindo, iniciarSaida] = useTransition();

  function tratarClique(): void {
    iniciarSaida(async () => {
      await sair();
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={tratarClique}
      disabled={saindo}
      className="text-texto-suave hover:bg-borda/40 flex min-h-[--spacing-toque] items-center gap-2 rounded-[--radius-padrao] px-3 text-sm disabled:opacity-60"
    >
      <LogOut aria-hidden className="size-4" />
      {saindo ? 'Saindo…' : 'Sair'}
    </button>
  );
}
