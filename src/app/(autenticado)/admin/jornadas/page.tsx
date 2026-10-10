import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BarraFiltros } from '@/componentes/dados/barra-filtros';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Paginacao } from '@/componentes/dados/paginacao';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { FiltroDePeriodo } from '@/componentes/dados/filtro-periodo';
import { BotaoExportar } from '@/modulos/exportacao/componentes/botao-exportar';
import { listarJornadasDoPainel } from '@/modulos/relatorio/relatorio.servico';
import { formatarDataOperacional, formatarDuracao, formatarHora } from '@/utilitarios/data';
import { formatarKm } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Jornadas' };

/**
 * Filtros que a exportação repassa (US032).
 *
 * A lista é explícita, e não "tudo o que estiver na URL": `pagina` e `tamanho`
 * descrevem a tela, não o recorte — exportar apenas a página visível seria o
 * contrário do que o administrador pediu ao clicar em "exportar o que estou
 * vendo".
 */
const PARAMETROS_EXPORTAVEIS = [
  'dataInicio',
  'dataFim',
  'motoristaId',
  'veiculoId',
  'status',
  'ordenar',
  'direcao',
] as const;

const STATUS = {
  ABERTA: { rotulo: 'Aberta', tom: 'andamento' as const },
  ENCERRADA: { rotulo: 'Encerrada', tom: 'sucesso' as const },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutro' as const },
};

/** T15 — Jornadas (doc 10 · US027 · RF029). */
export default async function PaginaJornadas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;

  const resultado = await listarJornadasDoPainel({
    dataInicio: parametros.dataInicio,
    dataFim: parametros.dataFim,
    motoristaId: parametros.motoristaId,
    veiculoId: parametros.veiculoId,
    status: parametros.status,
    pagina: parametros.pagina,
    tamanho: parametros.tamanho,
    ordenar: parametros.ordenar ?? 'data',
    direcao: parametros.direcao ?? 'desc',
  });

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Jornadas</h1>
        <FiltroDePeriodo />
        <MensagemErro titulo="Consulta inválida" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  const { dados: jornadas, paginacao } = resultado.dados;
  const temFiltro = Object.keys(parametros).some((chave) => chave !== 'pagina');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-texto text-2xl font-semibold">Jornadas</h1>
          <p className="text-texto-suave text-sm">O dia de trabalho de cada motorista.</p>
        </div>
        <BotaoExportar tipo="JORNADAS" parametrosAceitos={PARAMETROS_EXPORTAVEIS} />
      </div>

      <FiltroDePeriodo />

      <BarraFiltros
        placeholderBusca="Não usado nesta tela"
        filtros={[
          {
            chave: 'status',
            rotulo: 'Status',
            opcoes: [
              { valor: 'ABERTA', rotulo: 'Aberta' },
              { valor: 'ENCERRADA', rotulo: 'Encerrada' },
              { valor: 'CANCELADA', rotulo: 'Cancelada' },
            ],
          },
        ]}
        semBusca
      />

      {jornadas.length === 0 ? (
        <EstadoVazio
          motivo={temFiltro ? 'sem-resultado' : 'sem-dados'}
          titulo={
            temFiltro ? 'Nenhum resultado para os filtros aplicados' : 'Nenhuma jornada registrada'
          }
          descricao={
            temFiltro
              ? 'Ajuste o período ou limpe os filtros.'
              : 'As jornadas aparecem aqui assim que os motoristas começarem a registrar.'
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {jornadas.map((jornada) => (
              <li key={jornada.id}>
                <Link
                  href={`/admin/jornadas/${jornada.id}`}
                  className="border-borda hover:bg-superficie flex items-center gap-3 rounded-[--radius-padrao] border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-texto font-medium">{jornada.motorista.nome}</span>
                      <Etiqueta tom={STATUS[jornada.status].tom}>
                        {STATUS[jornada.status].rotulo}
                      </Etiqueta>
                    </div>
                    <p className="text-texto-suave text-xs">
                      {formatarDataOperacional(jornada.data)} · van{' '}
                      {formatarPlaca(jornada.veiculo.placa)} · {formatarHora(jornada.iniciadaEm)}
                      {jornada.encerradaEm ? ` às ${formatarHora(jornada.encerradaEm)}` : ''}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-texto text-sm font-medium">
                      {formatarKm(jornada.kmTotal as number | null)}
                    </p>
                    <p className="text-texto-suave text-xs">
                      {jornada._count.corridas}{' '}
                      {jornada._count.corridas === 1 ? 'corrida' : 'corridas'}
                      {jornada.duracaoMinutos
                        ? ` · ${formatarDuracao(jornada.duracaoMinutos)}`
                        : ''}
                    </p>
                  </div>

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
