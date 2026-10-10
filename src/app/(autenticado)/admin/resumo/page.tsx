import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FiltrosResumo } from '@/modulos/relatorio/componentes/filtros-resumo';
import { FichaDiariaMotorista } from '@/modulos/relatorio/componentes/ficha-diaria-motorista';
import { listarMotoristasDoResumo, resumoDoDia } from '@/modulos/relatorio/relatorio.servico';
import { formatarDataOperacional } from '@/utilitarios/data';
import { formatarKm } from '@/utilitarios/numero';

export const metadata: Metadata = { title: 'Resumo do dia' };

/** Consulta e impressão do diário, com jornadas abertas fora dos totais finais. */
export default async function PaginaResumo({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; motoristaId?: string }>;
}) {
  const parametros = await searchParams;
  const [resultado, resultadoMotoristas] = await Promise.all([
    resumoDoDia(parametros),
    listarMotoristasDoResumo({}),
  ]);

  if (!resultado.sucesso || !resultadoMotoristas.sucesso) {
    const erro = !resultado.sucesso
      ? resultado.erro
      : !resultadoMotoristas.sucesso
        ? resultadoMotoristas.erro
        : null;
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Resumo do dia</h1>
        <MensagemErro
          titulo="Não foi possível carregar"
          mensagem={erro?.mensagem ?? 'Não foi possível consultar o diário. Tente novamente.'}
        />
        <Link href="/admin/resumo" className="text-primaria underline">
          Voltar ao resumo de hoje
        </Link>
      </div>
    );
  }

  const { data: dia, encerradas, emAberto, consolidado } = resultado.dados;
  const motoristas = resultadoMotoristas.dados;
  const nomeMotorista = parametros.motoristaId
    ? (motoristas.find((motorista) => motorista.id === parametros.motoristaId)?.nome ??
      'Motorista selecionado')
    : 'Todos os motoristas';
  const temRegistros = encerradas.length > 0 || emAberto.length > 0;
  const consultaHistorico = new URLSearchParams();
  if (parametros.motoristaId) consultaHistorico.set('motoristaId', parametros.motoristaId);
  const historico =
    consultaHistorico.size > 0
      ? '/admin/jornadas?' + consultaHistorico.toString()
      : '/admin/jornadas';

  return (
    <div data-relatorio-diario className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Resumo do dia</h1>
        <p className="text-texto mt-1 text-base">
          Diário de bordo · {formatarDataOperacional(dia)} · {nomeMotorista}
        </p>
        <p data-nao-imprimir className="text-texto-suave mt-2 text-sm">
          Escolha a data e o motorista para conferir as viagens e imprimir o relatório.
        </p>
      </div>

      <FiltrosResumo dia={dia} motoristas={motoristas} temRegistros={temRegistros} />

      {encerradas.length > 0 ? (
        <section className="border-borda bg-superficie rounded-[--radius-padrao] border p-4">
          <h2 className="text-texto mb-3 font-semibold">
            {parametros.motoristaId ? 'Totais do motorista no dia' : 'Totais da frota no dia'}
          </h2>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div>
              <dt className="text-texto-suave text-sm">Motoristas</dt>
              <dd className="text-texto text-2xl font-semibold">{consolidado.motoristas}</dd>
            </div>
            <div>
              <dt className="text-texto-suave text-sm">Viagens encerradas</dt>
              <dd className="text-texto text-2xl font-semibold">{consolidado.corridas}</dd>
            </div>
            <div>
              <dt className="text-texto-suave text-sm">Km rodado</dt>
              <dd className="text-texto text-2xl font-semibold">
                {formatarKm(consolidado.kmTotal)}
              </dd>
            </div>
            <div>
              <dt className="text-texto-suave text-sm">Passageiros</dt>
              <dd className="text-texto text-2xl font-semibold">{consolidado.passageiros}</dd>
            </div>
            <div>
              <dt className="text-texto-suave text-sm">Ocorrências registradas</dt>
              <dd className="text-texto text-2xl font-semibold">{consolidado.ocorrencias}</dd>
            </div>
          </dl>
          <p className="text-texto-suave mt-3 text-sm">
            Quilômetros, viagens e passageiros consideram apenas jornadas encerradas.
          </p>
        </section>
      ) : null}

      {!temRegistros ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo={
            parametros.motoristaId
              ? 'Nenhum registro deste motorista nesta data'
              : 'Nenhum registro nesta data'
          }
          descricao="Escolha outra data ou consulte o histórico de jornadas."
        />
      ) : null}

      {encerradas.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-texto text-lg font-semibold">Viagens do dia por motorista</h2>
          {encerradas.map((jornada) => (
            <FichaDiariaMotorista key={jornada.id} jornada={jornada} dia={dia} />
          ))}
        </section>
      ) : null}

      {emAberto.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-atencao flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle aria-hidden className="size-5" />
            Dias em andamento
          </h2>
          {emAberto.map((jornada) => (
            <FichaDiariaMotorista key={jornada.id} jornada={jornada} dia={dia} />
          ))}
        </section>
      ) : null}

      <div data-nao-imprimir className="border-borda border-t pt-4">
        <Link
          href={historico}
          className="text-primaria inline-flex min-h-[--spacing-toque] items-center font-medium underline"
        >
          Ver histórico de jornadas{parametros.motoristaId ? ' deste motorista' : ''}
        </Link>
        <p className="text-texto-suave text-sm">
          Consulte os registros desde o início do uso do aplicativo.
        </p>
      </div>
    </div>
  );
}
