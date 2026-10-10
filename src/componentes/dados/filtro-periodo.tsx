'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { dataOperacional, somarDias } from '@/utilitarios/data';

/**
 * Seleção de período (US027 · RF043).
 *
 * Os atalhos existem porque as consultas reais são quase sempre as mesmas —
 * hoje, ontem, esta semana, este mês. Obrigar o administrador a preencher duas
 * datas para ver o dia de ontem é atrito diário desnecessário.
 *
 * O período vai para a URL, então a consulta é compartilhável e sobrevive ao
 * botão "voltar".
 */
export function FiltroDePeriodo() {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();

  const inicio = parametros.get('dataInicio') ?? '';
  const fim = parametros.get('dataFim') ?? '';

  function aplicar(dataInicio: string, dataFim: string): void {
    const proximos = new URLSearchParams(parametros.toString());

    if (dataInicio) proximos.set('dataInicio', dataInicio);
    else proximos.delete('dataInicio');

    if (dataFim) proximos.set('dataFim', dataFim);
    else proximos.delete('dataFim');

    proximos.delete('pagina');

    const consulta = proximos.toString();
    router.push(consulta ? `${caminho}?${consulta}` : caminho);
  }

  const hoje = dataOperacional();

  const atalhos: { rotulo: string; inicio: string; fim: string }[] = [
    { rotulo: 'Hoje', inicio: hoje, fim: hoje },
    { rotulo: 'Ontem', inicio: somarDias(hoje, -1), fim: somarDias(hoje, -1) },
    { rotulo: 'Últimos 7 dias', inicio: somarDias(hoje, -6), fim: hoje },
    { rotulo: 'Últimos 30 dias', inicio: somarDias(hoje, -29), fim: hoje },
  ];

  return (
    <div className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="periodo-inicio" className="text-texto mb-1.5 block text-sm font-medium">
            De
          </label>
          <input
            id="periodo-inicio"
            type="date"
            value={inicio}
            max={fim || undefined}
            onChange={(evento) => aplicar(evento.target.value, fim)}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
          />
        </div>

        <div>
          <label htmlFor="periodo-fim" className="text-texto mb-1.5 block text-sm font-medium">
            Até
          </label>
          <input
            id="periodo-fim"
            type="date"
            value={fim}
            min={inicio || undefined}
            onChange={(evento) => aplicar(inicio, evento.target.value)}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
          />
        </div>

        <CalendarDays aria-hidden className="text-texto-suave mb-3 size-4" />
      </div>

      <div className="flex flex-wrap gap-2">
        {atalhos.map((atalho) => {
          const ativo = inicio === atalho.inicio && fim === atalho.fim;

          return (
            <button
              key={atalho.rotulo}
              type="button"
              onClick={() => aplicar(atalho.inicio, atalho.fim)}
              aria-pressed={ativo}
              className={`min-h-9 rounded-full border px-3 text-sm ${
                ativo
                  ? 'border-primaria bg-primaria-suave text-primaria font-medium'
                  : 'border-borda text-texto-suave hover:bg-superficie'
              }`}
            >
              {atalho.rotulo}
            </button>
          );
        })}

        {inicio || fim ? (
          <button
            type="button"
            onClick={() => aplicar('', '')}
            className="text-texto-suave hover:bg-superficie min-h-9 rounded-full px-3 text-sm"
          >
            Todo o período
          </button>
        ) : null}
      </div>
    </div>
  );
}
