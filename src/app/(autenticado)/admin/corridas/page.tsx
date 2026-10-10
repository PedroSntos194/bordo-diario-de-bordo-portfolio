import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, MapPin, MapPinOff } from 'lucide-react';
import { BarraFiltros } from '@/componentes/dados/barra-filtros';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Paginacao } from '@/componentes/dados/paginacao';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { FiltroDePeriodo } from '@/componentes/dados/filtro-periodo';
import { BotaoExportar } from '@/modulos/exportacao/componentes/botao-exportar';
import { listarCorridasDoPainel } from '@/modulos/relatorio/relatorio.servico';
import { formatarDataOperacional, formatarDuracao, formatarHora } from '@/utilitarios/data';
import { formatarKm } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Corridas' };

/** Filtros repassados à exportação (US032) — ver a nota na tela de jornadas. */
const PARAMETROS_EXPORTAVEIS = [
  'dataInicio',
  'dataFim',
  'motoristaId',
  'veiculoId',
  'rotaId',
  'status',
  'ordenar',
  'direcao',
] as const;

const STATUS = {
  EM_ANDAMENTO: { rotulo: 'Em andamento', tom: 'andamento' as const },
  ENCERRADA: { rotulo: 'Encerrada', tom: 'sucesso' as const },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutro' as const },
};

/** T17 — Corridas (doc 10 · US027). Consulta transversal, sem passar pela jornada. */
export default async function PaginaCorridas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;

  const resultado = await listarCorridasDoPainel({
    dataInicio: parametros.dataInicio,
    dataFim: parametros.dataFim,
    motoristaId: parametros.motoristaId,
    veiculoId: parametros.veiculoId,
    rotaId: parametros.rotaId,
    status: parametros.status,
    pagina: parametros.pagina,
    tamanho: parametros.tamanho,
    ordenar: parametros.ordenar ?? 'iniciadaEm',
    direcao: parametros.direcao ?? 'desc',
  });

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Corridas</h1>
        <FiltroDePeriodo />
        <MensagemErro titulo="Consulta inválida" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  const { dados: corridas, paginacao } = resultado.dados;
  const temFiltro = Object.keys(parametros).some((chave) => chave !== 'pagina');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-texto text-2xl font-semibold">Corridas</h1>
          <p className="text-texto-suave text-sm">Todos os trajetos registrados.</p>
        </div>
        <BotaoExportar tipo="CORRIDAS" parametrosAceitos={PARAMETROS_EXPORTAVEIS} />
      </div>

      <FiltroDePeriodo />

      <BarraFiltros
        placeholderBusca=""
        semBusca
        filtros={[
          {
            chave: 'status',
            rotulo: 'Status',
            opcoes: [
              { valor: 'EM_ANDAMENTO', rotulo: 'Em andamento' },
              { valor: 'ENCERRADA', rotulo: 'Encerrada' },
              { valor: 'CANCELADA', rotulo: 'Cancelada' },
            ],
          },
        ]}
      />

      {corridas.length === 0 ? (
        <EstadoVazio
          motivo={temFiltro ? 'sem-resultado' : 'sem-dados'}
          titulo={
            temFiltro ? 'Nenhum resultado para os filtros aplicados' : 'Nenhuma corrida registrada'
          }
          descricao={
            temFiltro
              ? 'Ajuste o período ou limpe os filtros.'
              : 'As corridas aparecem aqui conforme os motoristas registram.'
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {corridas.map((corrida) => (
              <li key={corrida.id}>
                <Link
                  href={`/admin/corridas/${corrida.id}`}
                  className="border-borda hover:bg-superficie flex items-center gap-3 rounded-[--radius-padrao] border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-texto font-medium">
                        {corrida.rota
                          ? corrida.rota.nome
                          : `${corrida.origemDescricao} → ${corrida.destinoDescricao}`}
                      </span>
                      <Etiqueta tom={STATUS[corrida.status].tom}>
                        {STATUS[corrida.status].rotulo}
                      </Etiqueta>
                    </div>
                    <p className="text-texto-suave text-xs">
                      {corrida.jornada.motorista.nome} · van{' '}
                      {formatarPlaca(corrida.jornada.veiculo.placa)} ·{' '}
                      {formatarDataOperacional(corrida.jornada.data)} às{' '}
                      {formatarHora(corrida.iniciadaEm)}
                      {corrida.duracaoMinutos
                        ? ` · ${formatarDuracao(corrida.duracaoMinutos)}`
                        : ''}
                    </p>
                  </div>

                  <span className="text-texto-suave hidden items-center gap-1 text-xs sm:flex">
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

                  <ChevronRight aria-hidden className="text-texto-suave size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>

          <Paginacao
            pagina={paginacao.pagina}
            totalPaginas={paginacao.totalPaginas}
            total={paginacao.total}
          />
        </>
      )}
    </div>
  );
}
