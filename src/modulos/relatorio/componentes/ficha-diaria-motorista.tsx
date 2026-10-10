import Link from 'next/link';
import type { JornadaDoResumo } from '@/modulos/relatorio/relatorio.repositorio';
import { formatarDataOperacional, formatarDuracao, formatarHora } from '@/utilitarios/data';
import { formatarKm, formatarOdometro } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';

const plural = (quantidade: number, um: string, varios: string): string =>
  `${quantidade} ${quantidade === 1 ? um : varios}`;

interface Propriedades {
  jornada: JornadaDoResumo;
  dia: string;
}

/** A ficha mostra os valores registrados; totais finais só existem no dia encerrado. */
export function FichaDiariaMotorista({ jornada, dia }: Propriedades) {
  const encerrada = jornada.status === 'ENCERRADA';
  const corridas = jornada.corridas.filter((corrida) => corrida.status !== 'CANCELADA');

  return (
    <article
      data-ficha-motorista
      className="border-borda flex flex-col gap-4 rounded-[--radius-padrao] border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-texto text-lg font-semibold">{jornada.motorista.nome}</h3>
          <p className="text-texto-suave text-sm">
            {formatarDataOperacional(dia)} · Van {formatarPlaca(jornada.veiculo.placa)} ·{' '}
            {jornada.veiculo.modelo}
          </p>
        </div>
        <span className={encerrada ? 'text-sucesso font-medium' : 'text-atencao font-medium'}>
          {encerrada ? 'Dia encerrado' : 'Dia em andamento'}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-texto-suave">Início do dia</dt>
          <dd className="text-texto font-medium">{formatarHora(jornada.iniciadaEm)}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Encerramento do dia</dt>
          <dd className="text-texto font-medium">
            {jornada.encerradaEm ? formatarHora(jornada.encerradaEm) : 'Ainda não encerrado'}
          </dd>
        </div>
        <div>
          <dt className="text-texto-suave">Odômetro inicial</dt>
          <dd className="text-texto font-mono">{formatarOdometro(jornada.odometroInicial)}</dd>
        </div>
        <div>
          <dt className="text-texto-suave">Odômetro final</dt>
          <dd className="text-texto font-mono">{formatarOdometro(jornada.odometroFinal)}</dd>
        </div>
      </dl>
      {!encerrada ? (
        <p className="border-atencao/30 bg-atencao-suave text-texto rounded-[--radius-padrao] border p-3 text-sm">
          Este dia ainda está em andamento. As viagens já registradas aparecem abaixo; os totais
          finais dependem do encerramento.
        </p>
      ) : null}
      {corridas.length > 0 ? (
        <div
          data-tabela-viagens
          className="border-borda overflow-x-auto rounded-[--radius-padrao] border"
          role="region"
          aria-label={`Viagens de ${jornada.motorista.nome}`}
          tabIndex={0}
        >
          <table className="w-full min-w-[56rem] text-sm">
            <caption className="sr-only">
              Viagens de {jornada.motorista.nome} em {formatarDataOperacional(dia)}, na ordem de
              saída.
            </caption>
            <thead className="bg-superficie text-texto-suave text-left">
              <tr>
                <th scope="col" className="p-3 font-medium">
                  Trajeto
                </th>
                <th scope="col" className="p-3 font-medium">
                  Saída
                </th>
                <th scope="col" className="p-3 font-medium">
                  Odômetro inicial
                </th>
                <th scope="col" className="p-3 font-medium">
                  Chegada
                </th>
                <th scope="col" className="p-3 font-medium">
                  Odômetro final
                </th>
                <th scope="col" className="p-3 font-medium">
                  Km
                </th>
                <th scope="col" className="p-3 font-medium">
                  Observações
                </th>
              </tr>
            </thead>
            <tbody className="divide-borda divide-y">
              {corridas.map((corrida) => (
                <tr key={corrida.id}>
                  <td className="text-texto min-w-48 p-3">
                    {corrida.rota ? (
                      <p className="font-medium">
                        {corrida.rota.codigo} · {corrida.rota.nome}
                      </p>
                    ) : null}
                    <p>
                      {corrida.origemDescricao || corrida.rota?.origem || '—'} →{' '}
                      {corrida.destinoDescricao || corrida.rota?.destino || '—'}
                    </p>
                  </td>
                  <td className="text-texto p-3 whitespace-nowrap">
                    {formatarHora(corrida.iniciadaEm)}
                  </td>
                  <td className="text-texto p-3 font-mono">
                    {formatarOdometro(corrida.odometroInicial)}
                  </td>
                  <td className="text-texto p-3 whitespace-nowrap">
                    {corrida.encerradaEm ? formatarHora(corrida.encerradaEm) : 'Em andamento'}
                  </td>
                  <td className="text-texto p-3 font-mono">
                    {formatarOdometro(corrida.odometroFinal)}
                  </td>
                  <td className="text-texto p-3 whitespace-nowrap">
                    {formatarKm(corrida.kmPercorrido as number | null)}
                  </td>
                  <td className="text-texto min-w-36 p-3 whitespace-pre-line">
                    {corrida.observacoes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-texto-suave text-sm">Nenhuma viagem registrada neste dia.</p>
      )}
      <div className="border-borda flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <div className="text-texto-suave text-sm">
          {encerrada ? (
            <p>
              {plural(jornada.totalCorridas ?? 0, 'viagem', 'viagens')} ·{' '}
              {plural(jornada.totalPassageiros ?? 0, 'passageiro', 'passageiros')}
              {jornada.duracaoMinutos !== null
                ? ` · ${formatarDuracao(jornada.duracaoMinutos)}`
                : ''}
            </p>
          ) : (
            <p>Totais do dia aguardando encerramento.</p>
          )}
        </div>
        <p className="text-texto text-base font-semibold">
          Total do dia:{' '}
          {encerrada ? formatarKm(jornada.kmTotal as number | null) : 'Aguardando encerramento'}
        </p>
      </div>
      {jornada.observacoes ? (
        <div className="text-texto text-sm">
          <h4 className="font-medium">Observações do dia</h4>
          <p className="whitespace-pre-line">{jornada.observacoes}</p>
        </div>
      ) : null}
      {jornada.ocorrencias.length > 0 ? (
        <div className="text-texto text-sm">
          <h4 className="font-medium">Ocorrências</h4>
          <ul className="flex flex-col gap-1">
            {jornada.ocorrencias.map((ocorrencia) => (
              <li key={ocorrencia.id}>
                {ocorrencia.tipo}: {ocorrencia.descricao}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        data-nao-imprimir
        href={`/admin/jornadas/${jornada.id}`}
        className="text-primaria inline-flex min-h-[--spacing-toque] items-center self-start font-medium underline"
      >
        Abrir detalhes da jornada
      </Link>
    </article>
  );
}
