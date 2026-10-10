import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Navigation,
  Ticket,
  Timer,
  UserX,
} from 'lucide-react';
import { CartaoIndicador } from '@/componentes/dados/cartao-indicador';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { painel } from '@/modulos/relatorio/relatorio.servico';
import { listarDoDia } from '@/modulos/ocorrencia/ocorrencia.servico';
import { listarFila } from '@/modulos/notificacao/reenvio.servico';
import { ROTULO_DA_OCORRENCIA, ehGrave } from '@/modulos/ocorrencia/ocorrencia.regras';
import { Cronometro } from '@/modulos/corrida/componentes/cronometro';
import { dataOperacional, formatarDataOperacional, formatarHora } from '@/utilitarios/data';
import { formatarKm } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';
import { ChecklistPreparacao } from '@/modulos/preparacao/componentes/checklist-preparacao';
import { AtualizacaoAutomatica } from '@/componentes/dados/atualizacao-automatica';
import { separarPresencaDoDia } from '@/modulos/acompanhamento/acompanhamento.regras';
import { painelDeMotoristas } from '@/modulos/acompanhamento/acompanhamento.servico';
import { PresencaDoDia } from '@/modulos/acompanhamento/componentes/presenca-do-dia';
import { doDia as fechamentoDoDia } from '@/modulos/fechamento/fechamento.servico';
import { formatarReais } from '@/modulos/pedagio/pedagio.regras';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * T14 — Dashboard (doc 10 · US026 · RF028).
 *
 * A data é um parâmetro da URL: o administrador que chega na segunda-feira
 * precisa poder olhar sexta sem depender de um seletor com estado.
 */
export default async function PaginaDashboard({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  const [resultado, ocorrencias, fila, motoristas, fechamento] = await Promise.all([
    painel({ ...(data ? { data } : {}) }),
    listarDoDia({ ...(data ? { data } : {}) }),
    listarFila({ tamanho: 1 }),
    painelDeMotoristas({ ...(data ? { data } : {}) }),
    fechamentoDoDia({ ...(data ? { data } : {}) }),
  ]);

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const { data: dia, indicadores, corridasAgora } = resultado.dados;
  const periodo = `dataInicio=${dia}&dataFim=${dia}`;
  const ehHoje = dia === dataOperacional();

  const semMovimento =
    indicadores.jornadasAbertas === 0 &&
    indicadores.jornadasEncerradas === 0 &&
    indicadores.corridasEncerradas === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Dashboard</h1>
        <p className="text-texto-suave text-sm">Operação de {formatarDataOperacional(dia)}</p>
      </div>

      {/*
        Primeira coisa do painel: quem chega às 8h quer saber quem começou às 6h
        e quem não (pedido do cliente de 07/10). Atualiza sozinho enquanto a
        tela fica aberta no dia de hoje.
      */}
      {motoristas.sucesso ? (
        <>
          <PresencaDoDia
            presenca={separarPresencaDoDia(motoristas.dados.motoristas)}
            data={dia}
            ehHoje={ehHoje}
            consultadoEm={motoristas.dados.consultadoEm}
          />
          {ehHoje ? <AtualizacaoAutomatica segundos={120} /> : null}
        </>
      ) : (
        <MensagemErro
          titulo="Não foi possível ver quem começou o dia"
          mensagem={motoristas.erro.mensagem}
          acao={
            <Link href={`/admin/motoristas?data=${dia}`} className="text-primaria underline">
              Abrir a situação dos motoristas
            </Link>
          }
        />
      )}

      {semMovimento ? (
        // Zeros mudos não dizem se o dia não começou ou se o sistema falhou.
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nenhuma operação registrada hoje"
          descricao="Assim que um motorista iniciar o dia, os indicadores aparecem aqui."
          acao={
            <Link href="/admin/jornadas" className="text-primaria text-sm font-medium underline">
              Ver dias anteriores
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CartaoIndicador
            rotulo="Jornadas abertas"
            valor={indicadores.jornadasAbertas}
            Icone={ClipboardList}
            tom={indicadores.jornadasAbertas > 0 ? 'andamento' : 'neutro'}
            href={`/admin/jornadas?${periodo}&status=ABERTA`}
          />
          <CartaoIndicador
            rotulo="Jornadas encerradas"
            valor={indicadores.jornadasEncerradas}
            Icone={CheckCircle2}
            tom="sucesso"
            href={`/admin/jornadas?${periodo}&status=ENCERRADA`}
          />
          <CartaoIndicador
            rotulo="Corridas em andamento"
            valor={indicadores.corridasEmAndamento}
            Icone={Navigation}
            tom={indicadores.corridasEmAndamento > 0 ? 'andamento' : 'neutro'}
            href={`/admin/corridas?${periodo}&status=EM_ANDAMENTO`}
          />
          <CartaoIndicador
            rotulo="Corridas concluídas"
            valor={indicadores.corridasEncerradas}
            Icone={CheckCircle2}
            href={`/admin/corridas?${periodo}&status=ENCERRADA`}
          />
          <CartaoIndicador
            rotulo="Km rodado no dia"
            valor={formatarKm(indicadores.kmTotal)}
            Icone={Gauge}
          />
          <CartaoIndicador
            rotulo="Vans em operação"
            valor={indicadores.veiculosEmOperacao}
            Icone={Bus}
            href="/admin/veiculos"
          />
          <CartaoIndicador
            rotulo="Ocorrências"
            valor={indicadores.ocorrencias}
            Icone={AlertTriangle}
            tom={indicadores.ocorrencias > 0 ? 'atencao' : 'neutro'}
            detalhe={indicadores.ocorrencias === 0 ? 'Nenhuma hoje' : undefined}
          />
          <CartaoIndicador
            rotulo="Motoristas sem registro"
            valor={indicadores.motoristasSemRegistro}
            Icone={UserX}
            tom={indicadores.motoristasSemRegistro > 0 ? 'atencao' : 'sucesso'}
            href={`/admin/pendencias?data=${dia}`}
          />
          {/* Pedido do cliente de 07/10: hora extra e pedágio à vista no painel. */}
          {fechamento.sucesso ? (
            <>
              <CartaoIndicador
                rotulo="Motoristas com hora extra"
                valor={fechamento.dados.comHoraExtra}
                Icone={Timer}
                tom={fechamento.dados.comHoraExtra > 0 ? 'andamento' : 'neutro'}
                detalhe={
                  fechamento.dados.comHoraExtra > 0
                    ? `${formatarReais(fechamento.dados.valorHoraExtra)} em diárias`
                    : 'Nenhuma diária até agora'
                }
                href={`/admin/fechamento?inicio=${dia}`}
              />
              <CartaoIndicador
                rotulo="Pedágios no dia"
                valor={formatarReais(fechamento.dados.totalPedagios)}
                Icone={Ticket}
                href={`/admin/fechamento?inicio=${dia}`}
              />
            </>
          ) : null}
        </div>
      )}

      <ChecklistPreparacao data={dia} />

      {corridasAgora.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-texto text-lg font-semibold">Rodando agora</h2>
          <ul className="flex flex-col gap-2">
            {corridasAgora.map((corrida) => (
              <li
                key={corrida.id}
                className="border-andamento bg-andamento-suave flex flex-wrap items-center gap-3 rounded-[--radius-padrao] border-l-4 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-texto font-medium">
                    {corrida.rota
                      ? corrida.rota.nome
                      : `${corrida.origemDescricao} → ${corrida.destinoDescricao}`}
                  </p>
                  <p className="text-texto-suave text-xs">
                    {corrida.jornada.motorista.nome} · van{' '}
                    {formatarPlaca(corrida.jornada.veiculo.placa)} · desde{' '}
                    {formatarHora(corrida.iniciadaEm)}
                  </p>
                </div>
                <Cronometro desdeIso={corrida.iniciadaEm.toISOString()} />
                <Link
                  href={`/admin/corridas/${corrida.id}`}
                  className="text-primaria text-sm font-medium underline"
                >
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        US037 — notificações que esgotaram as tentativas automáticas. Fica no
        painel porque depender de alguém abrir a tela de notificações é o mesmo
        que não avisar.
      */}
      {fila.sucesso && fila.dados.requeremAtencao > 0 ? (
        <div
          role="alert"
          className="border-erro/30 bg-erro-suave flex items-center gap-3 rounded-[--radius-padrao] border p-3"
        >
          <AlertTriangle aria-hidden className="text-erro size-5 shrink-0" />
          <p className="text-texto flex-1 text-sm">
            <strong>
              {fila.dados.requeremAtencao}{' '}
              {fila.dados.requeremAtencao === 1 ? 'notificação' : 'notificações'}
            </strong>{' '}
            não chegou ao destino depois de todas as tentativas.
          </p>
          <Link
            href="/admin/notificacoes"
            className="text-primaria shrink-0 text-sm font-medium underline"
          >
            Ver fila
          </Link>
        </div>
      ) : null}

      {/*
        Ocorrências vêm ANTES da lista de pendências: pane e acidente tiram uma
        van de operação hoje, enquanto "não iniciou o dia" é cobrança. O
        administrador que abre o painel de manhã precisa esbarrar primeiro no
        que exige reação.
      */}
      {ocorrencias.sucesso && ocorrencias.dados.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-texto text-lg font-semibold">Ocorrências do dia</h2>
          <ul className="flex flex-col gap-2">
            {ocorrencias.dados.map((ocorrencia) => {
              const grave = ehGrave(ocorrencia.tipo);

              return (
                <li
                  key={ocorrencia.id}
                  className={`flex items-start gap-3 rounded-[--radius-padrao] border p-3 ${
                    grave ? 'border-erro/30 bg-erro-suave' : 'border-atencao/30 bg-atencao-suave'
                  }`}
                >
                  <AlertTriangle
                    aria-hidden
                    className={`mt-0.5 size-5 shrink-0 ${grave ? 'text-erro' : 'text-atencao'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-texto font-medium">
                        {ROTULO_DA_OCORRENCIA[ocorrencia.tipo]}
                      </span>
                      <span className="text-texto-suave text-xs">
                        {formatarHora(ocorrencia.ocorridoEm)} ·{' '}
                        {ocorrencia.registradoPor?.nome ?? 'Sistema'}
                        {ocorrencia.jornada
                          ? ` · van ${formatarPlaca(ocorrencia.jornada.veiculo.placa)}`
                          : ''}
                      </span>
                    </div>
                    <p className="text-texto text-sm">{ocorrencia.descricao}</p>
                  </div>

                  {ocorrencia.jornada ? (
                    <Link
                      href={`/admin/jornadas/${ocorrencia.jornada.id}`}
                      className="text-primaria shrink-0 text-sm font-medium underline"
                    >
                      Ver jornada
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/*
        A antiga lista "Sem registro hoje" saiu: os mesmos escalados que não
        iniciaram aparecem em vermelho em "Quem foi trabalhar", no topo. O
        cartão "Motoristas sem registro" continua levando às pendências e ao
        que já foi cobrado.
      */}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/resumo?data=${dia}`}
          className="border-borda text-texto hover:bg-superficie flex min-h-[--spacing-toque] items-center rounded-[--radius-padrao] border px-4 text-sm font-medium"
        >
          Ver resumo do dia
        </Link>
        <Link
          href={`/admin/jornadas?${periodo}`}
          className="border-borda text-texto hover:bg-superficie flex min-h-[--spacing-toque] items-center rounded-[--radius-padrao] border px-4 text-sm font-medium"
        >
          Todas as jornadas de hoje
        </Link>
      </div>
    </div>
  );
}
