import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, MapPinOff } from 'lucide-react';
import { CodigoErro } from '@/lib/erros';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Cronometro } from '@/modulos/corrida/componentes/cronometro';
import { BotaoCancelarCorrida } from '@/modulos/corrida/componentes/botao-cancelar-corrida';
import { ParadasDaCorrida } from '@/modulos/evento/componentes/paradas-da-corrida';
import { MapaTrajeto } from '@/componentes/mapa/mapa-trajeto';
import { ROTULO_DO_EVENTO } from '@/modulos/evento/evento.regras';
import { janelaDeCorrecao, obter } from '@/modulos/corrida/corrida.servico';
import { JANELA_EDICAO_HORAS_PADRAO, podeCorrigirAgora } from '@/modulos/corrida/corrida.regras';
import { formatarDataHora, formatarDuracao, formatarHora } from '@/utilitarios/data';
import { formatarKm, formatarOdometro } from '@/utilitarios/numero';
import { precisaoEhRuim } from '@/utilitarios/geo';
import { HistoricoDoRegistro } from '@/modulos/auditoria/componentes/historico-do-registro';

export const metadata: Metadata = { title: 'Corrida' };

/** T07 — Corrida em andamento (doc 10 · US018, US019, US020). */
export default async function PaginaCorrida({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [resultado, janela] = await Promise.all([obter({ id }), janelaDeCorrecao()]);

  if (!resultado.sucesso) {
    if (resultado.erro.codigo === CodigoErro.NAO_ENCONTRADO) notFound();
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const corrida = resultado.dados;
  const emAndamento = corrida.status === 'EM_ANDAMENTO';

  /**
   * Os pontos do trajeto, rotulados **uma vez só** e consumidos pelo mapa e
   * pela lista. Duas passagens de rotulagem divergiriam no dia em que uma
   * delas passasse a conhecer os eventos e a outra não — foi exatamente o que
   * aconteceu no primeiro rascunho desta tela.
   *
   * O número é o elo entre as duas: quem clica no marcador 3 no mapa encontra
   * o mesmo 3 no texto abaixo.
   */
  const pontosDoTrajeto = corrida.localizacoes.map((ponto, indice) => ({
    id: String(ponto.id),
    numero: indice + 1,
    latitude: Number(ponto.latitude),
    longitude: Number(ponto.longitude),
    precisaoMetros: ponto.precisaoMetros === null ? null : Number(ponto.precisaoMetros),
    capturadoEm: ponto.capturadoEm,
    rotulo: ponto.evento
      ? `${ROTULO_DO_EVENTO[ponto.evento.tipo]}${
          ponto.evento.pontoParada
            ? ` · ${ponto.evento.pontoParada.nome}`
            : ponto.evento.descricao
              ? ` · ${ponto.evento.descricao}`
              : ''
        }`
      : indice === 0
        ? 'Início'
        : indice === corrida.localizacoes.length - 1 && corrida.status !== 'EM_ANDAMENTO'
          ? 'Encerramento'
          : 'Ponto',
  }));

  const horasDeCorrecao = janela.sucesso ? janela.dados.horas : JANELA_EDICAO_HORAS_PADRAO;
  const podeCorrigir =
    corrida.status === 'ENCERRADA' &&
    podeCorrigirAgora({
      perfil: janela.sucesso ? janela.dados.perfil : 'MOTORISTA',
      encerradaEm: corrida.encerradaEm,
      agora: new Date(),
      janelaHoras: horasDeCorrecao,
    });
  const descricao = corrida.rota
    ? corrida.rota.nome
    : `${corrida.origemDescricao} → ${corrida.destinoDescricao}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/app" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Meu dia
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-texto text-2xl font-semibold">{descricao}</h1>
          <Etiqueta
            tom={
              corrida.status === 'EM_ANDAMENTO'
                ? 'andamento'
                : corrida.status === 'ENCERRADA'
                  ? 'sucesso'
                  : 'neutro'
            }
          >
            {corrida.status === 'EM_ANDAMENTO'
              ? 'Em andamento'
              : corrida.status === 'ENCERRADA'
                ? 'Encerrada'
                : 'Cancelada'}
          </Etiqueta>
        </div>

        {corrida.rota ? (
          <p className="text-texto-suave text-sm">
            {corrida.rota.origem} → {corrida.rota.destino}
          </p>
        ) : null}
      </div>

      {emAndamento ? (
        <section className="border-andamento bg-andamento-suave flex items-center justify-between gap-3 rounded-[--radius-padrao] border-l-4 p-4">
          <div>
            <p className="text-texto-suave text-xs">Rodando desde</p>
            <p className="text-texto font-medium">{formatarHora(corrida.iniciadaEm)}</p>
          </div>
          <Cronometro desdeIso={corrida.iniciadaEm.toISOString()} />
        </section>
      ) : null}

      <section className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-texto-suave text-xs">Odômetro no início</dt>
            <dd className="text-texto font-mono">{formatarOdometro(corrida.odometroInicial)}</dd>
          </div>
          {corrida.encerradaEm ? (
            <>
              <div>
                <dt className="text-texto-suave text-xs">Odômetro no fim</dt>
                <dd className="text-texto font-mono">{formatarOdometro(corrida.odometroFinal)}</dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Percorrido</dt>
                <dd className="text-texto font-medium">
                  {formatarKm(corrida.kmPercorrido as number | null)}
                </dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Duração</dt>
                <dd className="text-texto">{formatarDuracao(corrida.duracaoMinutos ?? 0)}</dd>
              </div>
              {corrida.quantidadePassageiros !== null ? (
                <div>
                  <dt className="text-texto-suave text-xs">Passageiros</dt>
                  <dd className="text-texto">{corrida.quantidadePassageiros}</dd>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>

        {corrida.observacoes ? (
          <p className="text-texto-suave border-borda border-t pt-3 text-sm">
            {corrida.observacoes}
          </p>
        ) : null}

        {corrida.motivoCancelamento ? (
          <p className="text-texto-suave border-borda border-t pt-3 text-sm">
            Cancelada: {corrida.motivoCancelamento}
          </p>
        ) : null}
      </section>

      {/* Localização é registro de fato e não pode ser editada (RN022). */}
      <section className="flex flex-col gap-3">
        <h2 className="text-texto text-sm font-semibold">Localização registrada</h2>

        {corrida.localizacoes.length === 0 ? (
          <div className="border-borda text-texto-suave flex items-start gap-2 rounded-[--radius-padrao] border border-dashed p-3 text-sm">
            <MapPinOff aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-2">
              <p>
                {emAndamento
                  ? 'Corrida registrada sem localização até agora. Você pode continuar e encerrar normalmente.'
                  : 'Corrida registrada sem localização. O registro continua válido.'}
              </p>
              {emAndamento ? (
                <p>
                  Para registrar a posição nas próximas paradas e no encerramento, ative a
                  localização do celular e permita o acesso nas configurações do site. Isso não
                  recupera a posição do início.
                </p>
              ) : null}
              <Link href="/app/ajuda#localizacao" className="text-primaria underline">
                Como permitir a localização
              </Link>
            </div>
          </div>
        ) : null}

        {/*
          US029 — o mapa mostra por onde a van passou, na ordem cronológica e
          numerado. A numeração é o que amarra cada marcador à linha
          correspondente na lista logo abaixo: quem clica no ponto 3 no mapa
          encontra o mesmo 3 no texto, com precisão e horário.
        */}
        <MapaTrajeto
          pontos={pontosDoTrajeto.map((ponto) => ({
            id: ponto.id,
            latitude: ponto.latitude,
            longitude: ponto.longitude,
            precisaoMetros: ponto.precisaoMetros,
            capturadoEm: formatarHora(ponto.capturadoEm),
            rotulo: ponto.rotulo,
          }))}
        />

        {corrida.localizacoes.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {pontosDoTrajeto.map((ponto) => (
              <li
                key={ponto.id}
                className="border-borda flex items-center gap-3 rounded-[--radius-padrao] border p-3 text-sm"
              >
                <span
                  aria-hidden
                  className="bg-primaria flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                >
                  {ponto.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-texto">
                    {ponto.rotulo}
                    {' · '}
                    {formatarHora(ponto.capturadoEm)}
                  </p>
                  <p className="text-texto-suave font-mono text-xs">
                    {Number(ponto.latitude).toFixed(5)}, {Number(ponto.longitude).toFixed(5)}
                  </p>
                </div>
                {precisaoEhRuim(ponto.precisaoMetros) ? (
                  <Etiqueta tom="atencao">baixa precisão</Etiqueta>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/*
        Paradas vêm antes de "Encerrar corrida": o motorista marca os pontos ao
        longo do trajeto e encerra no fim. A ordem na tela acompanha a ordem
        real do trabalho.
      */}
      <ParadasDaCorrida
        corridaId={corrida.id}
        pontos={corrida.rota?.pontos ?? []}
        temRota={corrida.rota !== null}
        eventos={corrida.eventos}
        editavel={emAndamento}
      />

      {/*
        Marcação "editado" (US022). Fica visível para qualquer um que abra a
        corrida: quem lê o número precisa saber que ele foi ajustado depois do
        fato, e a justificativa está na trilha de auditoria.
      */}
      {corrida.editadaEm ? (
        <p className="border-atencao/30 bg-atencao-suave text-texto rounded-[--radius-padrao] border p-3 text-sm">
          Este registro foi <strong>corrigido</strong> em {formatarDataHora(corrida.editadaEm)}. O
          motivo está na trilha de auditoria.
        </p>
      ) : null}

      {podeCorrigir ? (
        <Link
          href={`/app/corrida/${corrida.id}/corrigir`}
          className="border-borda text-texto-suave hover:bg-superficie flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] border border-dashed px-6 text-sm"
        >
          Corrigir esta corrida
        </Link>
      ) : null}

      {emAndamento ? (
        <div className="flex flex-col gap-3">
          <Link
            href={`/app/corrida/${corrida.id}/encerrar`}
            className="bg-primaria flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] px-6 py-3 text-lg font-medium text-white"
          >
            Encerrar corrida
          </Link>

          <BotaoCancelarCorrida corridaId={corrida.id} descricao={descricao} />
        </div>
      ) : null}

      {/*
        US041 — o histórico só é montado para o administrador: o componente
        exige perfil ADMIN e devolve nulo para o motorista, que não deve ver a
        trilha de quem alterou o quê (RN029).
      */}
      <HistoricoDoRegistro entidade="corrida" entidadeId={corrida.id} />
    </div>
  );
}
