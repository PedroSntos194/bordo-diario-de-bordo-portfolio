'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Navegação entre páginas (RNF012 · RF043).
 *
 * A página vive na URL, não em estado local: assim o administrador pode voltar
 * pelo navegador, recarregar ou compartilhar a consulta e cair no mesmo lugar.
 */
interface Propriedades {
  pagina: number;
  totalPaginas: number;
  total: number;
}

export function Paginacao({ pagina, totalPaginas, total }: Propriedades) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();

  function irPara(novaPagina: number): void {
    const busca = new URLSearchParams(parametros.toString());
    if (novaPagina <= 1) busca.delete('pagina');
    else busca.set('pagina', String(novaPagina));

    const consulta = busca.toString();
    router.push(consulta ? `${caminho}?${consulta}` : caminho);
  }

  if (total === 0) return null;

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
      <p className="text-texto-suave" aria-live="polite">
        {total === 1 ? '1 registro' : `${total} registros`}
        {totalPaginas > 1 ? ` · página ${pagina} de ${totalPaginas}` : ''}
      </p>

      {totalPaginas > 1 ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => irPara(pagina - 1)}
            disabled={pagina <= 1}
            aria-label="Página anterior"
            className="border-borda hover:bg-superficie flex min-h-9 items-center gap-1 rounded-[--radius-padrao] border px-3 disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="size-4" />
            Anterior
          </button>
          <button
            type="button"
            onClick={() => irPara(pagina + 1)}
            disabled={pagina >= totalPaginas}
            aria-label="Próxima página"
            className="border-borda hover:bg-superficie flex min-h-9 items-center gap-1 rounded-[--radius-padrao] border px-3 disabled:opacity-40"
          >
            Próxima
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}
    </nav>
  );
}
