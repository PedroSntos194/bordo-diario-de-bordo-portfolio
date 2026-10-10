'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dataOperacional, somarDias } from '@/utilitarios/data';

/**
 * Escolha de um único dia, para o resumo diário (US030).
 *
 * As setas existem porque a navegação real é sequencial: o administrador olha
 * ontem, depois anteontem. Obrigar a abrir o calendário a cada passo seria
 * atrito num gesto que se repete.
 *
 * Avançar para além de hoje fica desabilitado — não há operação futura.
 */
export function SeletorDeDia({ permitirFuturo = false }: { permitirFuturo?: boolean }) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();

  const hoje = dataOperacional();
  const atual = parametros.get('data') ?? hoje;

  function ir(data: string): void {
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    const proximos = new URLSearchParams(parametros.toString());
    if (data === hoje) proximos.delete('data');
    else proximos.set('data', data);

    const consulta = proximos.toString();
    router.push(consulta ? `${caminho}?${consulta}` : caminho);
  }

  const ehHoje = atual === hoje;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => ir(somarDias(atual, -1))}
        aria-label="Dia anterior"
        className="border-borda hover:bg-superficie flex size-10 items-center justify-center rounded-[--radius-padrao] border"
      >
        <ChevronLeft aria-hidden className="size-4" />
      </button>

      <label className="sr-only" htmlFor="seletor-dia">
        Dia
      </label>
      <input
        id="seletor-dia"
        type="date"
        value={atual}
        max={permitirFuturo ? undefined : hoje}
        onChange={(evento) => ir(evento.target.value)}
        className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
      />

      <button
        type="button"
        onClick={() => ir(somarDias(atual, 1))}
        disabled={!permitirFuturo && atual >= hoje}
        aria-label="Próximo dia"
        className="border-borda hover:bg-superficie flex size-10 items-center justify-center rounded-[--radius-padrao] border disabled:opacity-40"
      >
        <ChevronRight aria-hidden className="size-4" />
      </button>

      {!ehHoje ? (
        <button
          type="button"
          onClick={() => ir(hoje)}
          className="text-primaria min-h-10 px-2 text-sm font-medium"
        >
          Hoje
        </button>
      ) : null}
    </div>
  );
}
