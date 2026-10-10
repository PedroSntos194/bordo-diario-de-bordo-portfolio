import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { BotaoExportar } from '@/modulos/exportacao/componentes/botao-exportar';
import { resumoDoDia } from '@/modulos/relatorio/relatorio.servico';
import { formatarDataOperacional, formatarDuracao, formatarHora } from '@/utilitarios/data';
import { formatarKm } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Resumo do dia' };

/**
 * T10 — Resumo do dia do motorista (doc 10 · US030).
 *
 * O serviço já filtra pelo próprio usuário (RN009): o motorista nunca recebe
 * o dado de um colega, mesmo pedindo a mesma data.
 */
export default async function PaginaResumoDoMotorista({
  params,
}: {
  params: Promise<{ data: string }>;
}) {
  const { data } = await params;
  const resultado = await resumoDoDia({ data });

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const jornada = resultado.dados.encerradas[0] ?? resultado.dados.emAberto[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/app" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Meu dia
        </Link>
        <h1 className="text-texto text-2xl font-semibold">{formatarDataOperacional(data)}</h1>

        {/*
          US035 — o motorista exporta o próprio dia, para guardar comprovação do
          que registrou. É o mesmo componente e o mesmo arquivo da exportação
          administrativa; o recorte por motorista é imposto no servidor
          (RN009), não aqui.
        */}
        <BotaoExportar tipo="RESUMO_DIA" parametrosAceitos={[]} filtrosFixos={{ data }} />
      </div>

      {!jornada ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nada registrado neste dia"
          descricao="Você não abriu jornada nesta data."
        />
      ) : (
        <>
          <section className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
            <p className="text-texto font-medium">Van {formatarPlaca(jornada.veiculo.placa)}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-texto-suave text-xs">Corridas</dt>
                <dd className="text-texto text-lg font-medium">{jornada.totalCorridas ?? 0}</dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Km rodado</dt>
                <dd className="text-texto text-lg font-medium">
                  {formatarKm(jornada.kmTotal as number | null)}
                </dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Passageiros</dt>
                <dd className="text-texto text-lg font-medium">{jornada.totalPassageiros ?? 0}</dd>
              </div>
              <div>
                <dt className="text-texto-suave text-xs">Tempo</dt>
                <dd className="text-texto text-lg font-medium">
                  {jornada.duracaoMinutos ? formatarDuracao(jornada.duracaoMinutos) : '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-texto text-sm font-semibold">Corridas do dia</h2>
            <ul className="flex flex-col gap-2">
              {jornada.corridas.map((corrida) => (
                <li
                  key={corrida.id}
                  className="border-borda flex items-center justify-between gap-3 rounded-[--radius-padrao] border p-3 text-sm"
                >
                  <Link
                    href={`/app/corrida/${corrida.id}`}
                    className="flex min-h-[--spacing-toque] w-full items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-texto truncate">
                        {corrida.rota
                          ? corrida.rota.nome
                          : `${corrida.origemDescricao} → ${corrida.destinoDescricao}`}
                      </p>
                      <p className="text-texto-suave text-xs">
                        {formatarHora(corrida.iniciadaEm)}
                        {corrida.encerradaEm ? ` às ${formatarHora(corrida.encerradaEm)}` : ''}
                      </p>
                    </div>
                    <span className="text-texto shrink-0 font-medium">
                      {formatarKm(corrida.kmPercorrido as number | null)}
                    </span>
                    <span className="text-primaria shrink-0 text-xs">Ver detalhes</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
