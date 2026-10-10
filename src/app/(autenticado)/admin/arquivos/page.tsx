import type { Metadata } from 'next';
import { Download, FileSpreadsheet, FileX } from 'lucide-react';
import { BarraFiltros } from '@/componentes/dados/barra-filtros';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Paginacao } from '@/componentes/dados/paginacao';
import { FiltroDePeriodo } from '@/componentes/dados/filtro-periodo';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { BotaoGerarConsolidado } from '@/modulos/consolidado/componentes/botao-gerar-consolidado';
import { ExportacoesEmPreparo } from '@/modulos/exportacao/componentes/exportacoes-em-preparo';
import { listar } from '@/modulos/arquivo/arquivo.servico';
import { formatarDataHora, formatarDataOperacional } from '@/utilitarios/data';

export const metadata: Metadata = { title: 'Arquivos' };

/**
 * Histórico de arquivos gerados (US033 · RF036 · RN030).
 *
 * A US033 exige que o consolidado "fique disponível no histórico, com data,
 * parâmetros e link de download" — é esta tela. A **US034**, da Sprint 8,
 * completa o quadro com filtro por período, tamanho de página e o tratamento de
 * arquivo expirado.
 */

const TIPO = {
  RELATORIO_DIARIO: { rotulo: 'Consolidado do dia', tom: 'sucesso' as const },
  EXPORTACAO: { rotulo: 'Exportação', tom: 'andamento' as const },
  IMPORTACAO: { rotulo: 'Importação', tom: 'neutro' as const },
  RELATORIO_ERROS: { rotulo: 'Erros de importação', tom: 'neutro' as const },
  FECHAMENTO_MENSAL: { rotulo: 'Fechamento do mês', tom: 'sucesso' as const },
};

/** `8.134` → `7,9 kB`. Tamanho em bytes não diz nada a quem lê a tela. */
function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** Descreve o recorte gravado em `parametros` (RN030). */
function descreverParametros(parametros: unknown): string {
  if (!parametros || typeof parametros !== 'object') return '—';
  const dados = parametros as Record<string, unknown>;

  if (typeof dados.data === 'string') return formatarDataOperacional(dados.data);

  const filtros = (dados.filtros ?? {}) as Record<string, unknown>;
  const inicio = typeof filtros.dataInicio === 'string' ? filtros.dataInicio : undefined;
  const fim = typeof filtros.dataFim === 'string' ? filtros.dataFim : undefined;

  if (inicio && fim) return `${formatarDataOperacional(inicio)} a ${formatarDataOperacional(fim)}`;
  if (inicio) return `A partir de ${formatarDataOperacional(inicio)}`;
  if (fim) return `Até ${formatarDataOperacional(fim)}`;
  return 'Todo o período';
}

export default async function PaginaArquivos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;

  const resultado = await listar({
    tipo: parametros.tipo,
    dataInicio: parametros.dataInicio,
    dataFim: parametros.dataFim,
    pagina: parametros.pagina,
    tamanho: parametros.tamanho,
  });

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Arquivos</h1>
        <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  const { dados: arquivos, paginacao } = resultado.dados;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Arquivos</h1>
        <p className="text-texto-suave text-sm">
          Planilhas geradas pelo sistema e pelas exportações. Nenhuma é sobrescrita.
        </p>
      </div>

      <BotaoGerarConsolidado />

      {/* US031 — o que foi pedido e ainda não virou arquivo não tem linha na
          listagem abaixo, e sumiria sem deixar rastro. */}
      <ExportacoesEmPreparo />

      {/* US034 — filtro pelo período de **geração** do arquivo. */}
      <FiltroDePeriodo />

      <BarraFiltros
        placeholderBusca=""
        semBusca
        filtros={[
          {
            chave: 'tipo',
            rotulo: 'Tipo',
            opcoes: [
              { valor: 'RELATORIO_DIARIO', rotulo: 'Consolidado do dia' },
              { valor: 'EXPORTACAO', rotulo: 'Exportação' },
            ],
          },
        ]}
      />

      {arquivos.length === 0 ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nenhum arquivo gerado ainda"
          descricao="O consolidado do dia aparece aqui automaticamente, e as exportações que você fizer também."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {arquivos.map((arquivo) => (
              <li
                key={arquivo.id}
                className="border-borda flex items-center gap-3 rounded-[--radius-padrao] border p-3"
              >
                <FileSpreadsheet aria-hidden className="text-texto-suave size-5 shrink-0" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-texto truncate font-medium">{arquivo.nomeOriginal}</span>
                    <Etiqueta tom={TIPO[arquivo.tipo].tom}>{TIPO[arquivo.tipo].rotulo}</Etiqueta>
                  </div>
                  <p className="text-texto-suave text-xs">
                    {descreverParametros(arquivo.parametros)} ·{' '}
                    {/* Sem autor = rotina automática. É o que a US034 chama de "sistema". */}
                    {arquivo.autor ? arquivo.autor.nome : 'Sistema'} ·{' '}
                    {formatarDataHora(arquivo.criadoEm)} · {formatarTamanho(arquivo.tamanhoBytes)}
                  </p>
                </div>

                {/*
                  Arquivo cujo binário sumiu — expurgo por retenção ou limpeza
                  manual — mostra o motivo, não um link que só falha depois do
                  clique (US034).
                */}
                {arquivo.disponivel ? (
                  <a
                    href={`/api/arquivos/${arquivo.id}/download`}
                    className="border-borda text-texto hover:bg-superficie flex min-h-9 shrink-0 items-center gap-1.5 rounded-[--radius-padrao] border px-3 text-sm"
                  >
                    <Download aria-hidden className="size-4" />
                    Baixar
                  </a>
                ) : (
                  <span className="text-texto-suave flex min-h-9 shrink-0 items-center gap-1.5 px-3 text-sm">
                    <FileX aria-hidden className="size-4" />
                    Indisponível
                  </span>
                )}
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
