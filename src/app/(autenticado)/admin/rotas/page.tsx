import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { BarraFiltros } from '@/componentes/dados/barra-filtros';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Paginacao } from '@/componentes/dados/paginacao';
import { TabelaRotas } from '@/modulos/rota/componentes/tabela-rotas';
import { listar } from '@/modulos/rota/rota.servico';

export const metadata: Metadata = { title: 'Rotas' };

/** T23 — Rotas (doc 10 · US012). */
export default async function PaginaRotas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;

  const resultado = await listar({
    busca: parametros.busca,
    turno: parametros.turno,
    status: parametros.status,
    pagina: parametros.pagina,
    tamanho: parametros.tamanho,
    ordenar: parametros.ordenar ?? 'codigo',
    direcao: parametros.direcao ?? 'asc',
  });

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const { dados: rotas, paginacao, totalCadastrado } = resultado.dados;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-texto text-2xl font-semibold">Rotas</h1>
          <p className="text-texto-suave text-sm">
            Trajetos que o motorista apenas seleciona ao iniciar a corrida.
          </p>
        </div>
        <Link
          href="/admin/rotas/novo"
          className="bg-primaria flex min-h-[--spacing-toque] items-center gap-2 rounded-[--radius-padrao] px-4 font-medium text-white"
        >
          <Plus aria-hidden className="size-4" />
          Nova rota
        </Link>
      </div>

      {totalCadastrado > 0 ? (
        <BarraFiltros
          placeholderBusca="Código, nome, origem ou destino"
          filtros={[
            {
              chave: 'turno',
              rotulo: 'Turno',
              opcoes: [
                { valor: 'MANHA', rotulo: 'Manhã' },
                { valor: 'TARDE', rotulo: 'Tarde' },
                { valor: 'NOITE', rotulo: 'Noite' },
                { valor: 'INTEGRAL', rotulo: 'Integral' },
              ],
            },
            {
              chave: 'status',
              rotulo: 'Status',
              opcoes: [
                { valor: 'ATIVA', rotulo: 'Ativa' },
                { valor: 'INATIVA', rotulo: 'Inativa' },
              ],
            },
          ]}
        />
      ) : null}

      {rotas.length > 0 ? (
        <>
          <TabelaRotas rotas={rotas} />
          <Paginacao
            pagina={paginacao.pagina}
            totalPaginas={paginacao.totalPaginas}
            total={paginacao.total}
          />
        </>
      ) : totalCadastrado === 0 ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nenhuma rota cadastrada"
          descricao="Com as rotas cadastradas, iniciar uma corrida vira um toque em vez de digitação."
          acao={
            <Link
              href="/admin/rotas/novo"
              className="bg-primaria inline-flex min-h-[--spacing-toque] items-center rounded-[--radius-padrao] px-4 font-medium text-white"
            >
              Cadastrar rota
            </Link>
          }
        />
      ) : (
        <EstadoVazio
          motivo="sem-resultado"
          titulo="Nenhum resultado para os filtros aplicados"
          descricao="Ajuste a busca ou limpe os filtros para ver todas as rotas."
        />
      )}
    </div>
  );
}
