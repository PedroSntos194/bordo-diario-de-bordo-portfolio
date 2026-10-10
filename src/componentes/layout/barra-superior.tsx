import Link from 'next/link';
import { BotaoSair } from '@/componentes/layout/botao-sair';
import { MarcaBordo } from '@/componentes/marca/marca-bordo';
import { formatarData } from '@/utilitarios/data';

/**
 * Cabeçalho comum às áreas autenticadas (doc 11).
 *
 * Server Component: só o botão de sair precisa de interatividade, e ele está
 * isolado num Client Component próprio para não arrastar a barra inteira para
 * o pacote enviado ao navegador (RNF011).
 */
interface Propriedades {
  nome: string;
  papel: string;
  mostrarData?: boolean;
}

export function BarraSuperior({ nome, papel, mostrarData = false }: Propriedades) {
  const primeiroNome = nome.split(' ')[0] ?? nome;

  return (
    <header className="border-borda bg-superficie border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <MarcaBordo className="size-9 shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span className="text-texto truncate text-sm font-semibold">{primeiroNome}</span>
            <span className="text-texto-suave truncate text-xs">
              {papel}
              {/* No celular a marca ocupa o lugar da data, que a tela já mostra. */}
              {mostrarData ? (
                <span className="hidden sm:inline">{` · ${formatarData(new Date())}`}</span>
              ) : null}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/perfil"
            className="text-texto-suave hover:bg-borda/40 flex min-h-[--spacing-toque] items-center rounded-[--radius-padrao] px-3 text-sm whitespace-nowrap"
          >
            Meu perfil
          </Link>
          <BotaoSair />
        </div>
      </div>
    </header>
  );
}
