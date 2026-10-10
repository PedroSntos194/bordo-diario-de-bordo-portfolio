import type { Metadata } from 'next';
import Link from 'next/link';
import { SeletorDeDia } from '@/componentes/dados/seletor-dia';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { meuResumoDoDia } from '@/modulos/relatorio/relatorio.servico';
import { formatarDataOperacional, formatarHora } from '@/utilitarios/data';
import { formatarKm } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Meu histórico' };

export default async function PaginaHistorico({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const parametros = await searchParams;
  const resultado = await meuResumoDoDia({ ...(parametros.data ? { data: parametros.data } : {}) });
  if (!resultado.sucesso)
    return (
      <MensagemErro
        titulo="Não foi possível carregar o histórico"
        mensagem={resultado.erro.mensagem}
      />
    );
  const { data, jornadas } = resultado.dados;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-texto text-2xl font-semibold">Meu histórico</h1>
      <p className="text-texto-suave text-sm">
        Escolha o dia e toque na viagem para consultar ou corrigir.
      </p>
      <SeletorDeDia />
      <h2 className="text-texto text-lg font-medium">{formatarDataOperacional(data)}</h2>
      {jornadas.length === 0 ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nada registrado neste dia"
          descricao="Escolha outra data para consultar suas viagens."
        />
      ) : (
        <>
          <Link
            href={`/app/resumo/${data}`}
            className="border-borda text-primaria flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] border p-3 font-medium"
          >
            Ver resumo e baixar planilha
          </Link>
          {jornadas.map((jornada) => (
            <section key={jornada.id} className="flex flex-col gap-3">
              <p className="text-texto font-medium">
                Van {formatarPlaca(jornada.veiculo.placa)} ·{' '}
                {jornada.status === 'ENCERRADA'
                  ? 'Dia encerrado'
                  : jornada.status === 'ABERTA'
                    ? 'Dia em andamento'
                    : 'Dia cancelado'}
              </p>
              {jornada.corridas.length === 0 ? (
                <p className="text-texto-suave text-sm">Nenhuma corrida registrada.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {jornada.corridas.map((corrida) => (
                    <li key={corrida.id}>
                      <Link
                        href={`/app/corrida/${corrida.id}`}
                        className="border-borda hover:bg-superficie flex min-h-[--spacing-toque] items-center justify-between gap-3 rounded-[--radius-padrao] border p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-texto text-sm font-medium">
                            {corrida.rota?.nome ??
                              `${corrida.origemDescricao} → ${corrida.destinoDescricao}`}
                          </p>
                          <p className="text-texto-suave text-xs">
                            {formatarHora(corrida.iniciadaEm)} ·{' '}
                            {corrida.status === 'ENCERRADA'
                              ? 'Encerrada'
                              : corrida.status === 'CANCELADA'
                                ? 'Cancelada'
                                : 'Em andamento'}{' '}
                            · {formatarKm(corrida.kmPercorrido as number | null)}
                          </p>
                        </div>
                        <span className="text-primaria shrink-0 text-sm">Ver detalhes</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
