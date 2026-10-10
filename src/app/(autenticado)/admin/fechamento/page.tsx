import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CalendarDays, Download } from 'lucide-react';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { GerarFechamento } from '@/modulos/fechamento/componentes/gerar-fechamento';
import { ROTULO_DA_CATEGORIA } from '@/modulos/fechamento/fechamento.regras';
import { consultar } from '@/modulos/fechamento/fechamento.servico';
import { formatarReais } from '@/modulos/pedagio/pedagio.regras';
import { dataOperacional, formatarDataHora, formatarDataOperacional } from '@/utilitarios/data';
import { formatarOdometro } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Fechamento do mês' };

const ROTULO_DA_PLANILHA: Record<string, string> = {
  PAGAMENTO_MOTORISTAS: 'Pagamento dos motoristas',
  BOLETIM_MEDICAO: 'Boletim de medição',
};

const MAXIMO_DE_DIAS_A_CONFERIR = 30;

/**
 * Fechamento mensal (pedido do cliente de 07/10/2026): hora extra e km
 * excedente de cada motorista, e o boletim de medição de cada van, no ciclo do
 * dia 16 ao dia 15. Os números da tela são os mesmos das planilhas.
 */
export default async function PaginaFechamento({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string }>;
}) {
  const { inicio } = await searchParams;
  const resultado = await consultar({ ...(inicio ? { inicio } : {}) });

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Fechamento do mês</h1>
        <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  const { fechamento, ciclos, arquivos } = resultado.dados;
  const { ciclo, avisos, motoristas, medicao } = fechamento;
  const emAndamento = ciclo.fim >= dataOperacional();
  const diasAConferir = fechamento.linhas.filter((linha) => linha.horaExtra.conferir.length > 0);
  const semContrato = fechamento.vans.filter(
    (van) => van.contrato.valorMensal === null || van.contrato.categoria === null,
  );
  const temAvisos = diasAConferir.length > 0 || semContrato.length > 0 || avisos.diasAbertos > 0;
  const somaMotoristas = (campo: (m: (typeof motoristas)[number]) => number) =>
    motoristas.reduce((total, m) => total + Math.round(campo(m) * 100), 0) / 100;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Fechamento do mês</h1>
        <p className="text-texto-suave text-sm">
          Período de {fechamento.rotulo}
          {emAndamento ? ' · em andamento' : ''}
        </p>
      </div>

      <nav aria-label="Período" className="flex flex-wrap gap-2">
        {ciclos.map((opcao) => (
          <Link
            key={opcao.inicio}
            href={`/admin/fechamento?inicio=${opcao.inicio}`}
            aria-current={opcao.inicio === ciclo.inicio ? 'page' : undefined}
            className={`min-h-9 rounded-full border px-3 text-sm leading-9 ${
              opcao.inicio === ciclo.inicio
                ? 'border-primaria bg-primaria-suave text-primaria font-medium'
                : 'border-borda text-texto-suave hover:bg-superficie'
            }`}
          >
            <span className="sr-only">{opcao.rotulo}</span>
            <span aria-hidden>
              {formatarDataOperacional(opcao.inicio).slice(0, 5)} a{' '}
              {formatarDataOperacional(opcao.fim).slice(0, 5)}
            </span>
          </Link>
        ))}
      </nav>

      <section className="border-borda bg-superficie flex flex-col gap-4 rounded-[--radius-padrao] border p-4">
        <GerarFechamento inicio={ciclo.inicio} emAndamento={emAndamento} />
        <p className="text-texto-suave flex flex-wrap items-center gap-1.5 text-sm">
          <CalendarDays aria-hidden className="size-4" />
          {fechamento.feriados.length === 0
            ? 'Nenhum feriado cadastrado neste período.'
            : `Feriados: ${fechamento.feriados
                .map((feriado) => `${formatarDataOperacional(feriado.data)} ${feriado.nome}`)
                .join(' · ')}.`}{' '}
          <Link href="/admin/feriados" className="text-primaria underline">
            Ver feriados
          </Link>
        </p>
      </section>

      {temAvisos ? (
        <section className="border-atencao/30 bg-atencao-suave flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
          <h2 className="text-texto flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden className="text-atencao size-5" />
            Conferir antes de pagar e de enviar
          </h2>
          {semContrato.length > 0 ? (
            <p className="text-texto text-sm">
              Vans sem valor ou categoria no contrato:{' '}
              {semContrato.map((van, indice) => (
                <span key={van.contrato.veiculoId}>
                  {indice > 0 ? ', ' : ''}
                  <Link
                    href={`/admin/veiculos/${van.contrato.veiculoId}`}
                    className="text-primaria font-mono whitespace-nowrap underline"
                  >
                    {formatarPlaca(van.contrato.placa)}
                  </Link>
                </span>
              ))}
              . Sem isso o boletim sai sem o valor dessas vans.
            </p>
          ) : null}
          {avisos.diasAbertos > 0 ? (
            <p className="text-texto text-sm">
              {avisos.diasAbertos === 1
                ? '1 dia ainda aberto: '
                : `${avisos.diasAbertos} dias ainda abertos: `}
              sem o encerramento, a saída e o km desse dia não entram na conta.
            </p>
          ) : null}
          {diasAConferir.length > 0 ? (
            <details className="text-texto text-sm">
              <summary className="cursor-pointer font-medium">
                {diasAConferir.length === 1
                  ? '1 dia com horário a conferir'
                  : `${diasAConferir.length} dias com horário a conferir`}
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {diasAConferir.slice(0, MAXIMO_DE_DIAS_A_CONFERIR).map((linha) => (
                  <li key={`${linha.motoristaId}-${linha.data}`}>
                    {formatarDataOperacional(linha.data)} · {linha.motorista} ·{' '}
                    {linha.horaExtra.conferir.join('; ')}
                  </li>
                ))}
                {diasAConferir.length > MAXIMO_DE_DIAS_A_CONFERIR ? (
                  <li className="text-texto-suave">
                    e mais {diasAConferir.length - MAXIMO_DE_DIAS_A_CONFERIR} na planilha.
                  </li>
                ) : null}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-texto text-lg font-semibold">Pagamento dos motoristas</h2>
        <p className="text-texto-suave text-sm">
          Diária de {formatarReais(fechamento.regras.horaExtra.valorDiaria)} por dia com hora extra
          e {formatarReais(fechamento.regras.km.valorPorKm)} por km acima de{' '}
          {fechamento.regras.km.limiteDia} km no dia.
        </p>
        {motoristas.length === 0 ? (
          <EstadoVazio
            motivo="sem-dados"
            titulo="Nenhum dia de trabalho neste período"
            descricao="Os valores aparecem conforme os motoristas abrem e encerram o dia."
          />
        ) : (
          <div className="border-borda overflow-x-auto rounded-[--radius-padrao] border">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-superficie text-texto-suave text-left">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    Motorista
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Dias
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Diárias HE
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Hora extra
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Km excedente
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Valor km
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-borda divide-y">
                {motoristas.map((motorista) => (
                  <tr key={motorista.motoristaId}>
                    <td className="text-texto p-3">
                      {motorista.motorista}
                      {motorista.diasParaConferir > 0 ? (
                        <span className="text-atencao block text-xs">
                          {motorista.diasParaConferir === 1
                            ? '1 dia a conferir'
                            : `${motorista.diasParaConferir} dias a conferir`}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-texto p-3 text-right tabular-nums">{motorista.dias}</td>
                    <td className="text-texto p-3 text-right tabular-nums">{motorista.diarias}</td>
                    <td className="text-texto p-3 text-right tabular-nums">
                      {formatarReais(motorista.valorHoraExtra)}
                    </td>
                    <td className="text-texto p-3 text-right tabular-nums">
                      {formatarOdometro(motorista.kmExcedente)} km
                    </td>
                    <td className="text-texto p-3 text-right tabular-nums">
                      {formatarReais(motorista.valorKm)}
                    </td>
                    <td className="text-texto p-3 text-right font-medium tabular-nums">
                      {formatarReais(motorista.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-borda border-t-2">
                <tr className="text-texto font-semibold">
                  <th scope="row" className="p-3 text-left">
                    Total
                  </th>
                  <td className="p-3 text-right tabular-nums">
                    {motoristas.reduce((soma, m) => soma + m.dias, 0)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {motoristas.reduce((soma, m) => soma + m.diarias, 0)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatarReais(somaMotoristas((m) => m.valorHoraExtra))}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatarOdometro(motoristas.reduce((soma, m) => soma + m.kmExcedente, 0))} km
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatarReais(somaMotoristas((m) => m.valorKm))}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatarReais(somaMotoristas((m) => m.total))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-texto text-lg font-semibold">Boletim de medição</h2>
        <p className="text-texto-suave text-sm">
          Dia normal pelo valor mensal da van ÷ {fechamento.regras.divisor}; sábado, domingo e
          feriado como dia extra. Os valores vêm do contrato de cada van, em Veículos.
        </p>
        {medicao.porCategoria.length === 0 ? (
          <EstadoVazio
            motivo="sem-dados"
            titulo="Nenhuma van para medir neste período"
            descricao="Preencha o contrato das vans em Veículos para o boletim sair com valores."
            acao={
              <Link href="/admin/veiculos" className="text-primaria text-sm font-medium underline">
                Abrir veículos
              </Link>
            }
          />
        ) : (
          <div className="border-borda overflow-x-auto rounded-[--radius-padrao] border">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="bg-superficie text-texto-suave text-left">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    Categoria
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Vans
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Dias normais
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Km excedido
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Dias extras
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-borda divide-y">
                {medicao.porCategoria.map((linha) => (
                  <tr key={linha.categoria}>
                    <td className="text-texto p-3">
                      {linha.categoria === 'SEM_CATEGORIA'
                        ? 'Sem categoria'
                        : ROTULO_DA_CATEGORIA[linha.categoria]}
                    </td>
                    <td className="text-texto p-3 text-right tabular-nums">{linha.quantidade}</td>
                    <td className="text-texto p-3 text-right tabular-nums">
                      {linha.diasNormais}
                      <span className="text-texto-suave block text-xs">
                        {formatarReais(linha.valorNormal)}
                      </span>
                    </td>
                    <td className="text-texto p-3 text-right tabular-nums">
                      {formatarOdometro(linha.kmExcedido)} km
                      <span className="text-texto-suave block text-xs">
                        {formatarReais(linha.valorKm)}
                      </span>
                    </td>
                    <td className="text-texto p-3 text-right tabular-nums">
                      {linha.diasExtras}
                      <span className="text-texto-suave block text-xs">
                        {formatarReais(linha.valorExtra)}
                      </span>
                    </td>
                    <td className="text-texto p-3 text-right font-medium tabular-nums">
                      {formatarReais(linha.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-borda divide-borda divide-y border-t-2">
                <tr className="text-texto">
                  <th scope="row" colSpan={5} className="p-3 text-left font-medium">
                    Total dos veículos
                  </th>
                  <td className="p-3 text-right tabular-nums">
                    {formatarReais(medicao.totalVeiculos)}
                  </td>
                </tr>
                <tr className="text-texto">
                  <th scope="row" colSpan={5} className="p-3 text-left font-medium">
                    Hora extra (diárias do período)
                  </th>
                  <td className="p-3 text-right tabular-nums">
                    {formatarReais(fechamento.totalHoraExtra)}
                  </td>
                </tr>
                <tr className="text-texto">
                  <th scope="row" colSpan={5} className="p-3 text-left font-medium">
                    Pedágios ({fechamento.pedagios.length})
                  </th>
                  <td className="p-3 text-right tabular-nums">
                    {formatarReais(medicao.totalPedagios)}
                  </td>
                </tr>
                <tr className="text-texto font-semibold">
                  <th scope="row" colSpan={5} className="p-3 text-left">
                    Total geral da medição
                  </th>
                  <td className="p-3 text-right tabular-nums">
                    {formatarReais(fechamento.totalGeral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-texto text-lg font-semibold">Planilhas geradas</h2>
        {arquivos.length === 0 ? (
          <p className="text-texto-suave text-sm">
            Nenhuma ainda. Use “Gerar planilhas” acima — e no dia {fechamento.regras.diaInicio} de
            cada mês o sistema gera as do período que terminou.
          </p>
        ) : (
          <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
            {arquivos.map((arquivo) => (
              <li key={arquivo.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-texto text-sm font-medium">
                    {ROTULO_DA_PLANILHA[arquivo.tipo] ?? arquivo.nome}
                    {arquivo.ciclo ? ` · ${arquivo.ciclo}` : ''}
                  </p>
                  <p className="text-texto-suave text-xs">
                    {formatarDataHora(arquivo.criadoEm)} · {arquivo.autor}
                  </p>
                </div>
                <a
                  href={`/api/arquivos/${arquivo.id}/download`}
                  className="text-primaria inline-flex min-h-[--spacing-toque] items-center gap-1.5 text-sm font-medium underline"
                >
                  <Download aria-hidden className="size-4" />
                  Baixar
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
