import type { Metadata } from 'next';
import Link from 'next/link';
import { SeletorDeDia } from '@/componentes/dados/seletor-dia';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { painelDeMotoristas } from '@/modulos/acompanhamento/acompanhamento.servico';
import {
  AtualizarMotoristas,
  ListaMotoristas,
} from '@/modulos/acompanhamento/componentes/lista-motoristas';
import { formatarDataHora, formatarDataOperacional } from '@/utilitarios/data';

export const metadata: Metadata = { title: 'Situação dos motoristas' };

export default async function PaginaMotoristas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;
  const resultado = await painelDeMotoristas({
    data: parametros.data,
    busca: parametros.busca,
    atencao: parametros.atencao,
  });
  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-texto text-2xl font-semibold">Situação dos motoristas</h1>
        <MensagemErro mensagem={resultado.erro.mensagem} />
        <Link className="text-primaria font-medium" href="/admin/motoristas">
          Voltar à consulta de hoje
        </Link>
      </div>
    );
  }
  const painel = resultado.dados;
  const indicadores = [
    { titulo: 'Motoristas cadastrados', valor: painel.resumo.total },
    { titulo: 'Precisam de atenção', valor: painel.resumo.precisamAtencao },
    { titulo: 'Sem primeiro login', valor: painel.resumo.nuncaEntraram },
    { titulo: 'Escalados sem jornada', valor: painel.resumo.escaladosSemJornada },
    { titulo: 'Em operação', valor: painel.resumo.emOperacao },
    { titulo: 'Dia encerrado', valor: painel.resumo.diaEncerrado },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-texto text-2xl font-semibold">Situação dos motoristas</h1>
          <p className="text-texto-suave mt-1 text-sm">
            Veja quem precisa de ajuda para entrar e acompanhe os registros de cada dia.
          </p>
        </div>
        <AtualizarMotoristas />
      </div>
      <SeletorDeDia />
      <p className="text-texto-suave text-sm">
        Acesso e primeira utilização mostram a situação atual. A operação mostra{' '}
        {formatarDataOperacional(painel.data)}. Consulta atualizada em{' '}
        {formatarDataHora(painel.consultadoEm)}.
      </p>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {indicadores.map((indicador) => (
          <div
            key={indicador.titulo}
            className="border-borda bg-superficie flex flex-col-reverse gap-1 rounded-[--radius-padrao] border p-3"
          >
            <dt className="text-texto-suave text-sm">{indicador.titulo}</dt>
            <dd className="text-texto text-2xl font-semibold">{indicador.valor}</dd>
          </div>
        ))}
      </dl>
      <details className="border-borda rounded-[--radius-padrao] border p-4 text-sm">
        <summary className="text-texto cursor-pointer font-medium">
          Como conferir este painel
        </summary>
        <div className="text-texto-suave mt-3 flex flex-col gap-2">
          <p>
            Entrar no aplicativo comprova o acesso. O uso da rotina é comprovado por uma jornada
            válida e uma corrida encerrada no histórico. A primeira utilização foi concluída por{' '}
            {painel.resumo.adocaoConcluida} de {painel.resumo.total} motoristas.
          </p>
          <p>
            Folga dispensa a cobrança de abertura do dia; jornadas já registradas continuam visíveis
            para conferência e encerramento. Sem escala, confirme se houve trabalho antes de cobrar
            registro. Uma jornada anterior aberta aparece separadamente e não conta como início do
            dia escolhido.
          </p>
          <p>
            Os registros aparecem após o envio ao servidor. Se o motorista registrou sem internet,
            confira Pendências de envio no celular e peça que sincronize quando houver conexão.
          </p>
        </div>
      </details>
      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="data" value={painel.data} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="busca-motorista" className="text-texto text-sm font-medium">
            Buscar motorista
          </label>
          <input
            id="busca-motorista"
            name="busca"
            type="search"
            defaultValue={parametros.busca ?? ''}
            placeholder="Nome do motorista"
            maxLength={120}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-atencao" className="text-texto text-sm font-medium">
            Exibir
          </label>
          <select
            id="filtro-atencao"
            name="atencao"
            defaultValue={parametros.atencao ?? 'todos'}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
          >
            <option value="todos">Todos os motoristas</option>
            <option value="atencao">Precisam de atenção</option>
          </select>
        </div>
        <button
          type="submit"
          className="bg-primaria min-h-[--spacing-toque] rounded-[--radius-padrao] px-4 font-medium text-white"
        >
          Aplicar
        </button>
        {parametros.busca || parametros.atencao === 'atencao' ? (
          <Link
            href={`/admin/motoristas?data=${painel.data}`}
            className="text-primaria inline-flex min-h-[--spacing-toque] items-center px-2 text-sm font-medium"
          >
            Limpar filtros
          </Link>
        ) : null}
      </form>
      <p className="text-texto-suave text-sm" aria-live="polite">
        Exibindo {painel.motoristas.length} de {painel.resumo.total} motoristas. Os indicadores
        acima consideram todos os cadastros, mesmo com filtros aplicados.
      </p>
      {painel.motoristas.length ? (
        <ListaMotoristas motoristas={painel.motoristas} data={painel.data} />
      ) : (
        <EstadoVazio
          motivo={painel.resumo.total ? 'sem-resultado' : 'sem-dados'}
          titulo={
            painel.resumo.total
              ? 'Nenhum motorista para estes filtros'
              : 'Nenhum motorista cadastrado'
          }
          descricao={
            painel.resumo.total
              ? 'Ajuste a busca ou limpe os filtros para conferir os demais motoristas.'
              : 'Cadastre os motoristas em Usuários para começar o acompanhamento.'
          }
        />
      )}
    </div>
  );
}
