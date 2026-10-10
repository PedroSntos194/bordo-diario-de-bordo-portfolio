import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { BarraFiltros } from '@/componentes/dados/barra-filtros';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Paginacao } from '@/componentes/dados/paginacao';
import { TabelaUsuarios } from '@/modulos/usuario/componentes/tabela-usuarios';
import { listar } from '@/modulos/usuario/usuario.servico';

export const metadata: Metadata = { title: 'Usuários' };

/**
 * T19 — Usuários (doc 10 · US007).
 *
 * Renderiza no servidor: a listagem sai pronta em HTML e só a interação
 * (menu de ações, modais) vai como JavaScript para o navegador.
 */
export default async function PaginaUsuarios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;

  const resultado = await listar({
    busca: parametros.busca,
    perfil: parametros.perfil,
    status: parametros.status,
    pagina: parametros.pagina,
    tamanho: parametros.tamanho,
    ordenar: parametros.ordenar ?? 'nome',
    direcao: parametros.direcao ?? 'asc',
  });

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const { dados: usuarios, paginacao, totalCadastrado } = resultado.dados;
  const semNenhumCadastro = totalCadastrado === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-texto text-2xl font-semibold">Usuários</h1>
          <p className="text-texto-suave text-sm">
            Motoristas e administradores com acesso ao sistema.
          </p>
        </div>

        <Link
          href="/admin/usuarios/novo"
          className="bg-primaria flex min-h-[--spacing-toque] items-center gap-2 rounded-[--radius-padrao] px-4 font-medium text-white"
        >
          <Plus aria-hidden className="size-4" />
          Novo usuário
        </Link>
      </div>

      {!semNenhumCadastro ? (
        <BarraFiltros
          placeholderBusca="Nome, CPF ou matrícula"
          filtros={[
            {
              chave: 'perfil',
              rotulo: 'Perfil',
              opcoes: [
                { valor: 'MOTORISTA', rotulo: 'Motorista' },
                { valor: 'ADMIN', rotulo: 'Administrador' },
              ],
            },
            {
              chave: 'status',
              rotulo: 'Status',
              opcoes: [
                { valor: 'ATIVO', rotulo: 'Ativo' },
                { valor: 'INATIVO', rotulo: 'Inativo' },
                { valor: 'BLOQUEADO', rotulo: 'Bloqueado' },
                { valor: 'EXCLUIDO', rotulo: 'Excluído' },
              ],
            },
          ]}
        />
      ) : null}

      {usuarios.length > 0 ? (
        <>
          <TabelaUsuarios usuarios={usuarios} />
          <Paginacao
            pagina={paginacao.pagina}
            totalPaginas={paginacao.totalPaginas}
            total={paginacao.total}
          />
        </>
      ) : semNenhumCadastro ? (
        // Dois estados vazios diferentes, com ações diferentes (doc 11).
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nenhum usuário cadastrado"
          descricao="Cadastre os motoristas e administradores para liberar o acesso ao sistema."
          acao={
            <Link
              href="/admin/usuarios/novo"
              className="bg-primaria inline-flex min-h-[--spacing-toque] items-center rounded-[--radius-padrao] px-4 font-medium text-white"
            >
              Cadastrar usuário
            </Link>
          }
        />
      ) : (
        <EstadoVazio
          motivo="sem-resultado"
          titulo="Nenhum resultado para os filtros aplicados"
          descricao="Ajuste a busca ou limpe os filtros para ver todos os usuários."
        />
      )}
    </div>
  );
}
