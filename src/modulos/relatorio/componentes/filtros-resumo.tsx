'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BotaoImprimir } from '@/componentes/dados/botao-imprimir';
import { BotaoExportar } from '@/modulos/exportacao/componentes/botao-exportar';
import { dataOperacional, somarDias } from '@/utilitarios/data';

interface Propriedades {
  dia: string;
  motoristas: { id: string; nome: string }[];
  temRegistros: boolean;
}

/** Data e motorista permanecem na URL, inclusive ao voltar a um dia anterior. */
export function FiltrosResumo({ dia, motoristas, temRegistros }: Propriedades) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [carregando, iniciarTransicao] = useTransition();
  const motoristaId = parametros.get('motoristaId') ?? '';
  const hoje = dataOperacional();

  function aplicar(data: string, motorista: string): void {
    if (!data) return;
    const proximos = new URLSearchParams(parametros.toString());
    proximos.set('data', data);
    if (motorista) proximos.set('motoristaId', motorista);
    else proximos.delete('motoristaId');
    iniciarTransicao(() => router.push(`${caminho}?${proximos.toString()}`));
  }

  return (
    <fieldset
      data-nao-imprimir
      disabled={carregando}
      aria-busy={carregando}
      className="border-borda bg-superficie flex flex-col gap-4 rounded-[--radius-padrao] border p-4"
    >
      <legend className="sr-only">Escolha a data e o motorista do relatório</legend>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="data-resumo" className="text-texto font-medium">
            Data do relatório
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => aplicar(somarDias(dia, -1), motoristaId)}
              aria-label="Dia anterior"
              className="border-borda hover:bg-borda/40 flex size-11 items-center justify-center rounded-[--radius-padrao] border"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <input
              id="data-resumo"
              type="date"
              value={dia}
              max={hoje}
              onChange={(evento) => aplicar(evento.target.value, motoristaId)}
              className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
            />
            <button
              type="button"
              onClick={() => aplicar(somarDias(dia, 1), motoristaId)}
              disabled={dia >= hoje}
              aria-label="Próximo dia"
              className="border-borda hover:bg-borda/40 flex size-11 items-center justify-center rounded-[--radius-padrao] border disabled:opacity-40"
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => aplicar(hoje, motoristaId)}
              className="text-primaria min-h-11 px-2 font-medium"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => aplicar(somarDias(hoje, -1), motoristaId)}
              className="text-primaria min-h-11 px-2 font-medium"
            >
              Ontem
            </button>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-56">
          <label htmlFor="motorista-resumo" className="text-texto font-medium">
            Motorista
          </label>
          <select
            id="motorista-resumo"
            value={motoristaId}
            onChange={(evento) => aplicar(dia, evento.target.value)}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] w-full rounded-[--radius-padrao] border px-3 text-base"
          >
            <option value="">Todos os motoristas</option>
            {motoristaId && !motoristas.some((motorista) => motorista.id === motoristaId) ? (
              <option value={motoristaId}>Motorista selecionado</option>
            ) : null}
            {motoristas.map((motorista) => (
              <option key={motorista.id} value={motorista.id}>
                {motorista.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <BotaoImprimir desabilitado={!temRegistros} />
        <BotaoExportar
          key={`${dia}-${motoristaId}`}
          tipo="RESUMO_DIA"
          parametrosAceitos={['motoristaId']}
          filtrosFixos={{ data: dia }}
        />
      </div>
      <p className="text-texto-suave text-sm" role="status">
        {carregando
          ? 'Carregando relatório…'
          : 'Para imprimir ou salvar em PDF, use Imprimir relatório.'}
      </p>
    </fieldset>
  );
}
