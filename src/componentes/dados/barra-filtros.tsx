'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Busca e filtros de uma listagem (RF029, RF043).
 *
 * Os filtros vão para a URL, o que dá de graça: histórico do navegador,
 * recarregar sem perder o contexto e compartilhar a consulta com outra pessoa.
 *
 * A busca é enviada com atraso de 400 ms — sem isso, cada tecla dispararia uma
 * consulta ao banco e a navegação encheria o histórico de estados intermediários.
 */
export interface OpcaoDeFiltro {
  valor: string;
  rotulo: string;
}

export interface DefinicaoDeFiltro {
  chave: string;
  rotulo: string;
  opcoes: OpcaoDeFiltro[];
}

interface Propriedades {
  placeholderBusca: string;
  filtros: DefinicaoDeFiltro[];
  /** Telas que filtram só por período e status não precisam de busca textual. */
  semBusca?: boolean;
}

export function BarraFiltros({ placeholderBusca, filtros, semBusca = false }: Propriedades) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [, iniciarNavegacao] = useTransition();

  const buscaAtual = parametros.get('busca') ?? '';
  const [busca, setBusca] = useState(buscaAtual);

  // Mantém o campo em sincronia quando a URL muda por fora (voltar, limpar).
  useEffect(() => setBusca(buscaAtual), [buscaAtual]);

  function aplicar(alteracoes: Record<string, string | null>): void {
    const proximos = new URLSearchParams(parametros.toString());

    for (const [chave, valor] of Object.entries(alteracoes)) {
      if (valor === null || valor === '') proximos.delete(chave);
      else proximos.set(chave, valor);
    }

    // Qualquer mudança de filtro volta para a primeira página: manter a página 4
    // de um resultado que agora tem 2 páginas mostraria uma lista vazia.
    proximos.delete('pagina');

    const consulta = proximos.toString();
    iniciarNavegacao(() => router.push(consulta ? `${caminho}?${consulta}` : caminho));
  }

  useEffect(() => {
    if (busca === buscaAtual) return;

    const temporizador = setTimeout(() => {
      // Busca de 1 caractere devolveria quase tudo e não ajuda ninguém.
      aplicar({ busca: busca.length === 0 || busca.length >= 2 ? busca : null });
    }, 400);

    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const temFiltroAtivo =
    buscaAtual !== '' || filtros.some((filtro) => parametros.get(filtro.chave));

  // Limpar não pode descartar o período: ele é escolhido em outro controle e
  // apagá-lo junto surpreenderia quem só queria tirar um filtro de status.
  function limpar(): void {
    const preservados = new URLSearchParams();
    for (const chave of ['dataInicio', 'dataFim']) {
      const valor = parametros.get(chave);
      if (valor) preservados.set(chave, valor);
    }
    const consulta = preservados.toString();
    router.push(consulta ? `${caminho}?${consulta}` : caminho);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {semBusca ? null : (
        <div className="flex-1">
          <label htmlFor="campo-busca" className="text-texto mb-1.5 block text-sm font-medium">
            Buscar
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="text-texto-suave pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <input
              id="campo-busca"
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder={placeholderBusca}
              className="border-borda bg-fundo text-texto min-h-[--spacing-toque] w-full rounded-[--radius-padrao] border py-2 pr-3 pl-9 text-base"
            />
          </div>
        </div>
      )}

      {filtros.map((filtro) => (
        <div key={filtro.chave} className="sm:w-44">
          <label
            htmlFor={`filtro-${filtro.chave}`}
            className="text-texto mb-1.5 block text-sm font-medium"
          >
            {filtro.rotulo}
          </label>
          <select
            id={`filtro-${filtro.chave}`}
            value={parametros.get(filtro.chave) ?? ''}
            onChange={(evento) => aplicar({ [filtro.chave]: evento.target.value })}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] w-full rounded-[--radius-padrao] border px-3 text-base"
          >
            <option value="">Todos</option>
            {filtro.opcoes.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </div>
      ))}

      {temFiltroAtivo ? (
        <button
          type="button"
          onClick={limpar}
          className="text-texto-suave hover:bg-superficie flex min-h-[--spacing-toque] items-center gap-1 rounded-[--radius-padrao] px-3 text-sm"
        >
          <X aria-hidden className="size-4" />
          Limpar
        </button>
      ) : null}
    </div>
  );
}
