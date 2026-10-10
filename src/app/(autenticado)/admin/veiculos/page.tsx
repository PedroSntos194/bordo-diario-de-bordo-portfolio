import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { BarraFiltros } from '@/componentes/dados/barra-filtros';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Paginacao } from '@/componentes/dados/paginacao';
import { TabelaVeiculos } from '@/modulos/veiculo/componentes/tabela-veiculos';
import { listar } from '@/modulos/veiculo/veiculo.servico';
import { formatarPlaca } from '@/utilitarios/placa';
import { AjudaNaTela } from '@/componentes/feedback/ajuda-na-tela';

export const metadata: Metadata = { title: 'Veículos' };

/** T21 — Veículos (doc 10 · US011). ⚠️ V-03 */
export default async function PaginaVeiculos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;

  const resultado = await listar({
    busca: parametros.busca,
    status: parametros.status,
    pagina: parametros.pagina,
    tamanho: parametros.tamanho,
    ordenar: parametros.ordenar ?? 'placa',
    direcao: parametros.direcao ?? 'asc',
  });

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const { dados: veiculos, paginacao, totalCadastrado } = resultado.dados;
  const salvo = veiculos.find((veiculo) => veiculo.id === parametros.salvo);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-texto text-2xl font-semibold">Veículos</h1>
          <p className="text-texto-suave text-sm">
            As vans da frota. O odômetro é atualizado pela operação, não aqui.
          </p>
        </div>
        <Link
          href="/admin/veiculos/novo"
          className="bg-primaria flex min-h-[--spacing-toque] items-center gap-2 rounded-[--radius-padrao] px-4 font-medium text-white"
        >
          <Plus aria-hidden className="size-4" />
          Novo veículo
        </Link>
      </div>

      {salvo ? (
        <p
          role="status"
          className="border-sucesso/30 bg-sucesso-suave text-texto rounded-[--radius-padrao] border p-4"
        >
          Van <strong>{formatarPlaca(salvo.placa)}</strong>{' '}
          {parametros.acao === 'atualizado' ? 'atualizada' : 'cadastrada'} com sucesso. Ela aparece
          destacada abaixo. Limpe a busca para ver toda a frota.
        </p>
      ) : null}

      <AjudaNaTela
        titulo="Como cadastrar e encontrar uma van"
        passos={[
          'Toque em Novo veículo. Informe placa, modelo, lugares para passageiros e a quilometragem total do painel.',
          'Toque em Cadastrar veículo e espere a confirmação. Confira a placa na lista.',
          'Para o motorista escolher a van, ela precisa estar Ativa e sem uma jornada em aberto.',
          'Se uma van não aparecer, limpe a busca e os filtros. Todos os administradores veem os mesmos cadastros.',
        ]}
      />

      {totalCadastrado > 0 ? (
        <BarraFiltros
          placeholderBusca="Placa, modelo ou marca"
          filtros={[
            {
              chave: 'status',
              rotulo: 'Status',
              opcoes: [
                { valor: 'ATIVO', rotulo: 'Ativo' },
                { valor: 'MANUTENCAO', rotulo: 'Em manutenção' },
                { valor: 'INATIVO', rotulo: 'Inativo' },
              ],
            },
          ]}
        />
      ) : null}

      {veiculos.length > 0 ? (
        <>
          <TabelaVeiculos veiculos={veiculos} destacadoId={salvo?.id} />
          <Paginacao
            pagina={paginacao.pagina}
            totalPaginas={paginacao.totalPaginas}
            total={paginacao.total}
          />
        </>
      ) : totalCadastrado === 0 ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nenhum veículo cadastrado"
          descricao="Sem veículos, o motorista não consegue iniciar a jornada — é a van que dá nome ao diário de bordo."
          acao={
            <Link
              href="/admin/veiculos/novo"
              className="bg-primaria inline-flex min-h-[--spacing-toque] items-center rounded-[--radius-padrao] px-4 font-medium text-white"
            >
              Cadastrar veículo
            </Link>
          }
        />
      ) : (
        <EstadoVazio
          motivo="sem-resultado"
          titulo="Nenhum resultado para os filtros aplicados"
          descricao="Ajuste a busca ou limpe os filtros para ver toda a frota."
        />
      )}
    </div>
  );
}
