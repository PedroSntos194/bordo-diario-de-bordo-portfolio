import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, MapPin, MapPinOff, Pencil } from 'lucide-react';
import { CodigoErro } from '@/lib/erros';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { detalheDaJornada } from '@/modulos/relatorio/relatorio.servico';
import { formatarDataOperacional, formatarDuracao, formatarHora } from '@/utilitarios/data';
import { formatarKm, formatarOdometro } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';
import { HistoricoDoRegistro } from '@/modulos/auditoria/componentes/historico-do-registro';
import { AvisoDeDivergencia } from '@/modulos/escala/componentes/aviso-de-divergencia';
import { ReabrirDia } from '@/modulos/jornada/componentes/reabrir-dia';
import { comoDataIso, dataOperacional } from '@/utilitarios/data';

export const metadata: Metadata = { title: 'Jornada' };

const STATUS_JORNADA = {
  ABERTA: { rotulo: 'Aberta', tom: 'andamento' as const },
  ENCERRADA: { rotulo: 'Encerrada', tom: 'sucesso' as const },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutro' as const },
};

const STATUS_CORRIDA = {
  EM_ANDAMENTO: { rotulo: 'Em andamento', tom: 'andamento' as const },
  ENCERRADA: { rotulo: 'Encerrada', tom: 'sucesso' as const },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutro' as const },
};

/** T16 — Detalhe da jornada (doc 10 · US028). */
export default async function PaginaDetalheJornada({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reaberto?: string }>;
}) {
  const { id } = await params;
  const { reaberto } = await searchParams;
  const resultado = await detalheDaJornada({ id });

  if (!resultado.sucesso) {
    if (resultado.erro.codigo === CodigoErro.NAO_ENCONTRADO) notFound();
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const jornada = resultado.dados;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/jornadas" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar para jornadas
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-texto text-2xl font-semibold">{jornada.motorista.nome}</h1>
          <Etiqueta tom={STATUS_JORNADA[jornada.status].tom}>
            {STATUS_JORNADA[jornada.status].rotulo}
          </Etiqueta>
        </div>

        <p className="text-texto-suave text-sm">
          {formatarDataOperacional(jornada.data)} · van {formatarPlaca(jornada.veiculo.placa)} ·{' '}
          {jornada.veiculo.modelo}
        </p>
      </div>

      {/* Só aparece quando o dia saiu diferente da escala (US014). */}
      <AvisoDeDivergencia jornadaId={id} />

      {reaberto && jornada.status === 'ABERTA' ? (
        <p
          role="status"
          className="border-sucesso/30 bg-sucesso-suave text-texto rounded-[--radius-padrao] border p-3 text-sm"
        >
          Dia reaberto. Peça ao motorista para atualizar a tela do aplicativo (puxar a tela para
          baixo ou fechar e abrir de novo): o dia aparece em andamento e ele já pode iniciar a
          corrida.
        </p>
      ) : null}

      {jornada.status === 'ENCERRADA' && comoDataIso(jornada.data) === dataOperacional() ? (
        <ReabrirDia jornadaId={id} motorista={jornada.motorista.nome.split(' ')[0] ?? ''} />
      ) : null}

      <section className="border-borda rounded-[--radius-padrao] border p-4">
        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-texto-suave text-xs">Início</dt>
            <dd className="text-texto">{formatarHora(jornada.iniciadaEm)}</dd>
          </div>
          <div>
            <dt className="text-texto-suave text-xs">Encerramento</dt>
            <dd className="text-texto">
              {jornada.encerradaEm ? formatarHora(jornada.encerradaEm) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-texto-suave text-xs">Odômetro inicial</dt>
            <dd className="text-texto font-mono">{formatarOdometro(jornada.odometroInicial)}</dd>
          </div>
          <div>
            <dt className="text-texto-suave text-xs">Odômetro final</dt>
            <dd className="text-texto font-mono">{formatarOdometro(jornada.odometroFinal)}</dd>
          </div>
          <div>
            <dt className="text-texto-suave text-xs">Km total</dt>
            <dd className="text-texto font-medium">
              {formatarKm(jornada.kmTotal as number | null)}
            </dd>
          </div>
          <div>
            <dt className="text-texto-suave text-xs">Corridas</dt>
            <dd className="text-texto">{jornada.corridas.length}</dd>
          </div>
          <div>
            <dt className="text-texto-suave text-xs">Passageiros</dt>
            <dd className="text-texto">{jornada.totalPassageiros ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-texto-suave text-xs">Duração</dt>
            <dd className="text-texto">
              {jornada.duracaoMinutos ? formatarDuracao(jornada.duracaoMinutos) : '—'}
            </dd>
          </div>
        </dl>

        {jornada.observacoes ? (
          <p className="text-texto-suave border-borda mt-4 border-t pt-3 text-sm">
            {jornada.observacoes}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-texto text-lg font-semibold">Corridas</h2>

        {jornada.corridas.length === 0 ? (
          <p className="border-borda text-texto-suave rounded-[--radius-padrao] border border-dashed p-6 text-center text-sm">
            Nenhuma corrida registrada nesta jornada.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {jornada.corridas.map((corrida) => (
              <li
                key={corrida.id}
                className="border-borda flex flex-wrap items-center gap-3 rounded-[--radius-padrao] border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-texto font-medium">
                      {corrida.rota
                        ? corrida.rota.nome
                        : `${corrida.origemDescricao} → ${corrida.destinoDescricao}`}
                    </span>
                    <Etiqueta tom={STATUS_CORRIDA[corrida.status].tom}>
                      {STATUS_CORRIDA[corrida.status].rotulo}
                    </Etiqueta>
                    {/* Registro alterado exibe marcação visível (RN019). */}
                    {corrida.editadaEm ? (
                      <Etiqueta tom="atencao">
                        <Pencil aria-hidden className="size-3" />
                        editado
                      </Etiqueta>
                    ) : null}
                  </div>

                  <p className="text-texto-suave text-xs">
                    {formatarHora(corrida.iniciadaEm)}
                    {corrida.encerradaEm ? ` às ${formatarHora(corrida.encerradaEm)}` : ''}
                    {corrida.quantidadePassageiros !== null
                      ? ` · ${corrida.quantidadePassageiros} passageiros`
                      : ''}
                    {corrida.duracaoMinutos ? ` · ${formatarDuracao(corrida.duracaoMinutos)}` : ''}
                  </p>

                  {corrida.observacoes ? (
                    <p className="text-texto-suave mt-1 text-xs italic">{corrida.observacoes}</p>
                  ) : null}
                  {corrida.motivoCancelamento ? (
                    <p className="text-texto-suave mt-1 text-xs italic">
                      Cancelada: {corrida.motivoCancelamento}
                    </p>
                  ) : null}
                </div>

                <span
                  className="text-texto-suave flex items-center gap-1 text-xs"
                  title={
                    corrida._count.localizacoes === 0
                      ? 'Corrida registrada sem localização'
                      : `${corrida._count.localizacoes} pontos de localização`
                  }
                >
                  {corrida._count.localizacoes === 0 ? (
                    <MapPinOff aria-hidden className="size-4" />
                  ) : (
                    <>
                      <MapPin aria-hidden className="text-primaria size-4" />
                      {corrida._count.localizacoes}
                    </>
                  )}
                </span>

                <span className="text-texto shrink-0 text-sm font-medium">
                  {formatarKm(corrida.kmPercorrido as number | null)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {jornada.ocorrencias.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-texto text-lg font-semibold">Ocorrências</h2>
          <ul className="flex flex-col gap-2">
            {jornada.ocorrencias.map((ocorrencia) => (
              <li
                key={ocorrencia.id}
                className="border-atencao/30 bg-atencao-suave rounded-[--radius-padrao] border p-3 text-sm"
              >
                <p className="text-texto font-medium">{ocorrencia.tipo}</p>
                <p className="text-texto-suave">{ocorrencia.descricao}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <HistoricoDoRegistro entidade="jornada" entidadeId={id} />
    </div>
  );
}
