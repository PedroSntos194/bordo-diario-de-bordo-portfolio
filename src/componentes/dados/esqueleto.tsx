import { cn } from '@/lib/cn';

/**
 * Placeholder de carregamento (doc 11): a tela mantém a forma do conteúdo final
 * enquanto carrega, em vez de piscar em branco e depois saltar.
 */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('bg-superficie animate-pulse rounded-[--radius-padrao]', className)}
    />
  );
}

/** Esqueleto no formato de uma tabela em carregamento. */
export function EsqueletoDeTabela({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Carregando registros">
      <Esqueleto className="h-10 w-full" />
      {Array.from({ length: linhas }, (_, indice) => (
        <Esqueleto key={indice} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** Esqueleto no formato dos cartões do dashboard. */
export function EsqueletoDeCartoes({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      role="status"
      aria-label="Carregando indicadores"
    >
      {Array.from({ length: quantidade }, (_, indice) => (
        <Esqueleto key={indice} className="h-24 w-full" />
      ))}
    </div>
  );
}
