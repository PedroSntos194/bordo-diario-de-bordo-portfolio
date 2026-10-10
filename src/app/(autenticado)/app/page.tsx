import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Fuel, Ticket, TriangleAlert } from 'lucide-react';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { Cronometro } from '@/modulos/corrida/componentes/cronometro';
import { EnviarResumo } from '@/modulos/notificacao/componentes/enviar-resumo';
import { meuDia } from '@/modulos/jornada/jornada.servico';
import {
  formatarData,
  formatarDataHora,
  formatarDataOperacional,
  dataOperacional,
  formatarDuracao,
  formatarHora,
} from '@/utilitarios/data';
import { formatarKm, formatarOdometro } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Meu dia' };

/**
 * T04 — Meu dia (doc 10).
 *
 * Tela central do motorista. O conteúdo muda conforme o estado do dia, e há
 * **uma ação principal** por estado — nunca duas competindo pela atenção de
 * quem está de pé na porta da van (doc 11):
 *
 *   sem jornada        → Iniciar meu dia
 *   jornada sem corrida→ Iniciar corrida
 *   corrida rodando    → Encerrar corrida
 *   dia encerrado      → resumo, somente leitura
 */
export default async function PaginaMeuDia() {
  const resultado = await meuDia();

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const { jornada, jornadaAbertaDeOutroDia, resumoEnviadoEm } = resultado.dados;
  const emAndamento = jornada?.corridas.find((corrida) => corrida.status === 'EM_ANDAMENTO');
  const encerradas = jornada?.corridas.filter((corrida) => corrida.status === 'ENCERRADA') ?? [];

  const kmAcumulado = encerradas.reduce(
    (soma, corrida) => soma + Number(corrida.kmPercorrido ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      {jornadaAbertaDeOutroDia ? (
        <div
          role="alert"
          className="border-atencao/30 bg-atencao-suave flex items-start gap-3 rounded-[--radius-padrao] border p-3"
        >
          <AlertTriangle aria-hidden className="text-atencao mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-texto text-sm font-medium">Você tem um dia em aberto</p>
            <p className="text-texto-suave text-sm">
              A jornada de {formatarDataOperacional(jornadaAbertaDeOutroDia.data)} com a van{' '}
              {formatarPlaca(jornadaAbertaDeOutroDia.placa)} não foi encerrada.
            </p>
            <Link
              href="/app/jornada/encerrar"
              className="text-primaria mt-1 inline-block text-sm font-medium underline"
            >
              Encerrar aquele dia
            </Link>
          </div>
        </div>
      ) : null}

      {jornada === null ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Você ainda não iniciou seu dia"
          descricao="Informe a van e o odômetro do painel para começar a registrar."
          acao={
            jornadaAbertaDeOutroDia ? undefined : (
              <Link
                href="/app/jornada/abrir"
                className="bg-primaria inline-flex min-h-[--spacing-toque] w-full items-center justify-center rounded-[--radius-padrao] px-6 text-lg font-medium text-white"
              >
                Iniciar meu dia
              </Link>
            )
          }
        />
      ) : (
        <>
          <section className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-texto-suave text-xs">{formatarData(jornada.iniciadaEm)}</p>
                <p className="text-texto text-xl font-semibold">
                  Van {formatarPlaca(jornada.veiculo.placa)}
                </p>
              </div>
              <Etiqueta tom={jornada.status === 'ABERTA' ? 'andamento' : 'sucesso'}>
                {jornada.status === 'ABERTA' ? 'Dia em andamento' : 'Dia encerrado'}
              </Etiqueta>
            </div>

            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-texto-suave text-xs">Início</dt>
                <dd className="text-texto">{formatarHora(jornada.iniciadaEm)}</dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Corridas encerradas</dt>
                <dd className="text-texto">{encerradas.length}</dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Km dessas corridas</dt>
                <dd className="text-texto">{formatarKm(kmAcumulado)}</dd>
              </div>
            </dl>
            {emAndamento ? (
              <p className="text-texto-suave text-xs">
                A corrida em andamento já está registrada. Ela entra nos totais quando você a
                encerrar com o odômetro do painel, mesmo sem GPS.
              </p>
            ) : null}
          </section>

          {/* Cartão da corrida em andamento — o herói da tela quando existe. */}
          {emAndamento ? (
            <section className="border-andamento bg-andamento-suave flex flex-col gap-3 rounded-[--radius-padrao] border-l-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-texto-suave text-xs">Corrida registrada · em andamento</p>
                  <p className="text-texto truncate font-medium">
                    {emAndamento.rota
                      ? emAndamento.rota.nome
                      : `${emAndamento.origemDescricao} → ${emAndamento.destinoDescricao}`}
                  </p>
                  <p className="text-texto-suave text-xs">
                    Desde {formatarHora(emAndamento.iniciadaEm)}
                  </p>
                </div>
                <Cronometro desdeIso={emAndamento.iniciadaEm.toISOString()} />
              </div>

              <Link
                href={`/app/corrida/${emAndamento.id}`}
                className="bg-primaria flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] px-6 text-lg font-medium text-white"
              >
                Ver corrida
              </Link>

              {/*
                Enquanto há corrida rodando, "Iniciar corrida" e "Encerrar meu
                dia" não aparecem — uma ação principal por estado (doc 11), e a
                RN014 permite só uma corrida por vez.

                O que faltava era **dizer isso**. Sem a frase, o motorista que
                quer a próxima viagem vê o botão simplesmente sumido e não tem
                como adivinhar que o caminho é encerrar a corrida atual. É o
                mesmo defeito dos itens mortos no menu da Sprint 3: a regra
                estava certa, a interface é que ficava calada.
              */}
              <p className="text-texto-suave text-xs">
                Se a viagem terminou, toque em Ver corrida e depois em Encerrar corrida. Você
                precisa encerrar esta corrida antes de iniciar outra ou fechar o dia.
              </p>
            </section>
          ) : jornada.status === 'ABERTA' ? (
            <Link
              href="/app/corrida/iniciar"
              className="bg-primaria flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] px-6 py-3 text-lg font-medium text-white"
            >
              Iniciar corrida
            </Link>
          ) : null}

          {encerradas.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-texto text-sm font-semibold">Corridas de hoje</h2>
              <ul className="flex flex-col gap-2">
                {encerradas.map((corrida) => (
                  <li
                    key={corrida.id}
                    className="border-borda flex items-center gap-3 rounded-[--radius-padrao] border p-3"
                  >
                    <Link
                      href={`/app/corrida/${corrida.id}`}
                      className="flex min-h-[--spacing-toque] w-full items-center gap-3"
                      aria-label={`Ver corrida ${corrida.rota?.nome ?? `${corrida.origemDescricao} para ${corrida.destinoDescricao}`}, às ${formatarHora(corrida.iniciadaEm)}`}
                    >
                      <CheckCircle2 aria-hidden className="text-sucesso size-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-texto truncate text-sm font-medium">
                          {corrida.rota
                            ? corrida.rota.nome
                            : `${corrida.origemDescricao} → ${corrida.destinoDescricao}`}
                        </p>
                        <p className="text-texto-suave text-xs">
                          {formatarHora(corrida.iniciadaEm)}
                          {corrida.encerradaEm ? ` às ${formatarHora(corrida.encerradaEm)}` : ''}
                          {corrida.quantidadePassageiros !== null
                            ? ` · ${corrida.quantidadePassageiros} passageiros`
                            : ''}
                        </p>
                      </div>
                      <span className="text-texto shrink-0 text-sm font-medium">
                        {formatarKm(corrida.kmPercorrido as number | null)}
                      </span>
                      <span className="text-primaria shrink-0 text-xs">Ver detalhes</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/*
            Ação secundária, disponível o dia inteiro — inclusive depois de
            encerrado (RN023: ocorrência não mexe no registro operacional, e o
            motorista costuma lembrar do problema quando já fechou o dia).
            Discreta de propósito: não compete com a ação principal do estado.
          */}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/ocorrencia"
              className="border-borda text-texto-suave hover:bg-superficie flex min-h-[--spacing-toque] flex-1 items-center justify-center gap-2 rounded-[--radius-padrao] border border-dashed px-4 text-sm"
            >
              <TriangleAlert aria-hidden className="size-4" />
              Registrar uma ocorrência
            </Link>

            {/*
              Abastecimento só faz sentido com o dia aberto: o registro pertence
              à jornada, e é ela que diz quem abasteceu e com que rodagem
              (US024). Depois de encerrado, o atalho sai em vez de levar a uma
              tela que vai recusar.
            */}
            {jornada.status === 'ABERTA' ? (
              <Link
                href="/app/abastecimento"
                className="border-borda text-texto-suave hover:bg-superficie flex min-h-[--spacing-toque] flex-1 items-center justify-center gap-2 rounded-[--radius-padrao] border border-dashed px-4 text-sm"
              >
                <Fuel aria-hidden className="size-4" />
                Registrar abastecimento
              </Link>
            ) : null}

            {/* Pedágio, pelo mesmo motivo: pertence ao dia aberto e à van dele. */}
            {jornada.status === 'ABERTA' ? (
              <Link
                href="/app/pedagio"
                className="border-borda text-texto-suave hover:bg-superficie flex min-h-[--spacing-toque] flex-1 items-center justify-center gap-2 rounded-[--radius-padrao] border border-dashed px-4 text-sm"
              >
                <Ticket aria-hidden className="size-4" />
                Registrar pedágio
              </Link>
            ) : null}
          </div>

          {jornada.status === 'ABERTA' && !emAndamento ? (
            <Link
              href="/app/jornada/encerrar"
              className="border-borda text-texto flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] border px-6 font-medium"
            >
              Encerrar meu dia
            </Link>
          ) : null}

          {jornada.status === 'ENCERRADA' ? (
            <section className="border-sucesso/30 bg-sucesso-suave flex flex-col gap-2 rounded-[--radius-padrao] border p-4">
              <p className="text-texto font-medium">Dia encerrado</p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-texto-suave text-xs">Km total</dt>
                  <dd className="text-texto">{formatarKm(jornada.kmTotal as number | null)}</dd>
                </div>
                <div>
                  <dt className="text-texto-suave text-xs">Odômetro final</dt>
                  <dd className="text-texto">{formatarOdometro(jornada.odometroFinal)}</dd>
                </div>
                <div>
                  <dt className="text-texto-suave text-xs">Passageiros</dt>
                  <dd className="text-texto">{jornada.totalPassageiros ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-texto-suave text-xs">Tempo</dt>
                  <dd className="text-texto">{formatarDuracao(jornada.duracaoMinutos ?? 0)}</dd>
                </div>
              </dl>
              <div className="border-borda mt-1 border-t pt-3">
                <EnviarResumo
                  jornadaId={jornada.id}
                  enviadoEm={resumoEnviadoEm ? formatarDataHora(resumoEnviadoEm) : null}
                />
              </div>
            </section>
          ) : null}
          <Link
            href={`/app/resumo/${dataOperacional(jornada.iniciadaEm)}`}
            className="border-borda text-primaria flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] border px-4 text-sm font-medium"
          >
            Ver resumo e baixar planilha
          </Link>
        </>
      )}
    </div>
  );
}
