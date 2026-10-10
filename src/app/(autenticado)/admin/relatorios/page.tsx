import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { FiltroDePeriodo } from '@/componentes/dados/filtro-periodo';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { relatorioDoPeriodo } from '@/modulos/relatorio/periodo.servico';
import { formatarDataOperacional, formatarDuracao } from '@/utilitarios/data';
import { formatarKm } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Relatórios' };

const AGRUPAMENTOS = [
  { valor: 'motorista', rotulo: 'Por motorista' },
  { valor: 'veiculo', rotulo: 'Por veículo' },
  { valor: 'rota', rotulo: 'Por rota' },
] as const;

/** T-Relatórios — análise por período e dimensão (US031 · RF031). */
export default async function PaginaRelatorios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;

  const resultado = await relatorioDoPeriodo({
    dataInicio: parametros.dataInicio,
    dataFim: parametros.dataFim,
    agrupamento: parametros.agrupamento ?? 'motorista',
  });

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Relatórios</h1>
        <FiltroDePeriodo />
        <MensagemErro titulo="Consulta inválida" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  const { periodo, agrupamento, linhas, totais } = resultado.dados;

  /** Troca o agrupamento preservando o período que já está na URL. */
  const comAgrupamento = (valor: string): string => {
    const consulta = new URLSearchParams();
    if (parametros.dataInicio) consulta.set('dataInicio', parametros.dataInicio);
    if (parametros.dataFim) consulta.set('dataFim', parametros.dataFim);
    consulta.set('agrupamento', valor);
    return `/admin/relatorios?${consulta.toString()}`;
  };

  const cabecalhoDaDimensao =
    agrupamento === 'motorista' ? 'Motorista' : agrupamento === 'veiculo' ? 'Veículo' : 'Rota';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Relatórios</h1>
        <p className="text-texto-suave text-sm">
          {formatarDataOperacional(periodo.dataInicio)} a {formatarDataOperacional(periodo.dataFim)}{' '}
          · {periodo.dias} {periodo.dias === 1 ? 'dia' : 'dias'} · somente corridas encerradas
        </p>
      </div>

      <FiltroDePeriodo />

      <Link
        href={
          parametros.dataInicio && parametros.dataInicio === parametros.dataFim
            ? '/admin/resumo?data=' + parametros.dataInicio
            : '/admin/resumo'
        }
        className="border-primaria bg-primaria-suave text-primaria flex min-h-[--spacing-toque] flex-wrap items-center justify-between gap-2 rounded-[--radius-padrao] border p-4"
      >
        <span className="font-semibold">Ver diário dos motoristas</span>
        <span className="text-sm">Viagens, horários, quilômetros e impressão por dia</span>
      </Link>

      <nav aria-label="Agrupamento" className="flex flex-wrap gap-2">
        {AGRUPAMENTOS.map((opcao) => (
          <Link
            key={opcao.valor}
            href={comAgrupamento(opcao.valor)}
            aria-current={agrupamento === opcao.valor ? 'page' : undefined}
            className={`min-h-9 rounded-full border px-3 text-sm leading-9 ${
              agrupamento === opcao.valor
                ? 'border-primaria bg-primaria-suave text-primaria font-medium'
                : 'border-borda text-texto-suave hover:bg-superficie'
            }`}
          >
            {opcao.rotulo}
          </Link>
        ))}
      </nav>

      {linhas.length === 0 ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nenhuma corrida encerrada neste período"
          descricao="Amplie o período ou confira se as jornadas foram encerradas — corrida em andamento não entra no relatório."
        />
      ) : (
        <>
          <section className="border-borda bg-superficie rounded-[--radius-padrao] border p-4">
            <h2 className="text-texto mb-3 flex items-center gap-2 text-sm font-semibold">
              <BarChart3 aria-hidden className="text-texto-suave size-4" />
              Total da frota no período
            </h2>

            <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <div>
                <dt className="text-texto-suave text-xs">Corridas</dt>
                <dd className="text-texto text-2xl font-semibold">{totais.corridas}</dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Km rodado</dt>
                <dd className="text-texto text-2xl font-semibold">{formatarKm(totais.kmTotal)}</dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Tempo</dt>
                <dd className="text-texto text-2xl font-semibold">
                  {formatarDuracao(totais.duracaoMinutos)}
                </dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Passageiros</dt>
                <dd className="text-texto text-2xl font-semibold">{totais.passageiros}</dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Média por dia</dt>
                <dd className="text-texto text-2xl font-semibold">{formatarKm(totais.kmPorDia)}</dd>
              </div>
            </dl>

            {/*
              Dizer qual é o denominador evita a leitura errada mais provável:
              alguém dividir o km total pelos dias do calendário e concluir que
              a frota está ociosa, quando na verdade ela não operou no fim de
              semana.
            */}
            <p className="text-texto-suave mt-3 text-xs">
              A média usa os {totais.diasComOperacao}{' '}
              {totais.diasComOperacao === 1 ? 'dia' : 'dias'} em que houve operação, não os{' '}
              {periodo.dias} dias do calendário.
            </p>
          </section>

          <div className="border-borda overflow-x-auto rounded-[--radius-padrao] border">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-superficie">
                <tr className="text-texto-suave text-left text-xs">
                  <th className="p-3 font-medium">{cabecalhoDaDimensao}</th>
                  <th className="p-3 text-right font-medium">Corridas</th>
                  <th className="p-3 text-right font-medium">Km</th>
                  <th className="p-3 text-right font-medium">Tempo</th>
                  <th className="p-3 text-right font-medium">Passageiros</th>
                  <th className="p-3 text-right font-medium">Dias</th>
                  <th className="p-3 text-right font-medium">Km/dia</th>
                </tr>
              </thead>

              <tbody className="divide-borda divide-y">
                {linhas.map((linha) => (
                  <tr key={linha.chave}>
                    <td className="text-texto p-3">
                      {agrupamento === 'veiculo' ? formatarPlaca(linha.rotulo) : linha.rotulo}
                      {linha.detalhe ? (
                        <span className="text-texto-suave"> · {linha.detalhe}</span>
                      ) : null}
                    </td>
                    <td className="text-texto p-3 text-right">{linha.corridas}</td>
                    <td className="text-texto p-3 text-right">{formatarKm(linha.kmTotal)}</td>
                    <td className="text-texto p-3 text-right">
                      {formatarDuracao(linha.duracaoMinutos)}
                    </td>
                    <td className="text-texto p-3 text-right">{linha.passageiros}</td>
                    <td className="text-texto-suave p-3 text-right">{linha.diasComOperacao}</td>
                    <td className="text-texto p-3 text-right">{formatarKm(linha.kmPorDia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
