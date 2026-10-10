import type { Metadata } from 'next';
import { ScrollText } from 'lucide-react';
import { BarraFiltros } from '@/componentes/dados/barra-filtros';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { FiltroDePeriodo } from '@/componentes/dados/filtro-periodo';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Paginacao } from '@/componentes/dados/paginacao';
import { consultar } from '@/modulos/auditoria/auditoria.consulta';
import {
  ACOES,
  ENTIDADES,
  ROTULO_DA_ACAO,
  compararValores,
  formatarValorDaTrilha,
  rotularCampo,
  rotularEntidade,
  type AcaoDaTrilha,
} from '@/modulos/auditoria/auditoria.regras';
import { formatarDataHora, formatarDataOperacional } from '@/utilitarios/data';

export const metadata: Metadata = { title: 'Auditoria' };

/**
 * T-Auditoria — trilha de atividades (US040 · RF038 · RN027).
 *
 * A tabela não tem ação de escrita, edição ou exclusão em lugar nenhum do
 * sistema — nem aqui. É uma tela de leitura, e é isso que dá valor à trilha.
 */
export default async function PaginaAuditoria({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;

  const resultado = await consultar({
    usuarioId: parametros.usuarioId,
    acao: parametros.acao,
    entidade: parametros.entidade,
    entidadeId: parametros.entidadeId,
    dataInicio: parametros.dataInicio,
    dataFim: parametros.dataFim,
    pagina: parametros.pagina,
    tamanho: parametros.tamanho,
  });

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Auditoria</h1>
        <FiltroDePeriodo />
        <MensagemErro titulo="Consulta inválida" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  const { dados: registros, paginacao, periodo, autores } = resultado.dados;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Auditoria</h1>
        <p className="text-texto-suave text-sm">
          Quem fez o quê, quando, e qual era o valor anterior. Somente leitura.
        </p>
      </div>

      <FiltroDePeriodo />

      {/* Sem período na URL, a consulta aplica os últimos 7 dias — e diz isso. */}
      {!parametros.dataInicio && !parametros.dataFim ? (
        <p className="text-texto-suave text-xs">
          Mostrando os últimos 7 dias ({formatarDataOperacional(periodo.dataInicio)} a{' '}
          {formatarDataOperacional(periodo.dataFim)}). Use o filtro acima para ampliar.
        </p>
      ) : null}

      <BarraFiltros
        placeholderBusca=""
        semBusca
        filtros={[
          {
            chave: 'acao',
            rotulo: 'Ação',
            opcoes: ACOES.map((acao) => ({ valor: acao, rotulo: ROTULO_DA_ACAO[acao] })),
          },
          {
            chave: 'entidade',
            rotulo: 'Registro',
            opcoes: ENTIDADES.map((entidade) => ({
              valor: entidade,
              rotulo: rotularEntidade(entidade),
            })),
          },
          {
            chave: 'usuarioId',
            rotulo: 'Usuário',
            opcoes: autores.map((autor) => ({ valor: autor.id, rotulo: autor.nome })),
          },
        ]}
      />

      {registros.length === 0 ? (
        <EstadoVazio
          motivo="sem-resultado"
          titulo="Nada registrado neste recorte"
          descricao="Amplie o período ou limpe os filtros."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {registros.map((registro) => {
              const campos = compararValores(registro.valorAnterior, registro.valorNovo);

              return (
                <li
                  key={registro.id}
                  className="border-borda rounded-[--radius-padrao] border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <ScrollText aria-hidden className="text-texto-suave size-4 shrink-0" />
                    <span className="text-texto font-medium">
                      {ROTULO_DA_ACAO[registro.acao as AcaoDaTrilha] ?? registro.acao}{' '}
                      {rotularEntidade(registro.entidade).toLowerCase()}
                    </span>
                    <span className="text-texto-suave text-xs">
                      {registro.usuario?.nome ?? 'Sistema'} ·{' '}
                      {formatarDataHora(registro.ocorridoEm)}
                      {registro.ip ? ` · ${registro.ip}` : ''}
                    </span>
                  </div>

                  {registro.justificativa ? (
                    <p className="text-texto mt-1.5 text-xs italic">“{registro.justificativa}”</p>
                  ) : null}

                  {/*
                    `details` em vez de estado no cliente: a comparação
                    antes × depois é um detalhe sob demanda, e uma lista de 20
                    linhas não deveria carregar componente interativo para cada
                    uma só por isso.
                  */}
                  {campos.length > 0 ? (
                    <details className="mt-1.5">
                      <summary className="text-primaria cursor-pointer text-xs">
                        Ver antes × depois ({campos.length}{' '}
                        {campos.length === 1 ? 'campo' : 'campos'})
                      </summary>
                      <dl className="mt-1.5 flex flex-col gap-0.5 text-xs">
                        {campos.map((campo) => (
                          <div key={campo.campo} className="flex flex-wrap gap-x-2">
                            <dt className="text-texto-suave">{rotularCampo(campo.campo)}:</dt>
                            <dd className="text-texto">
                              <span className="text-texto-suave line-through">
                                {formatarValorDaTrilha(campo.anterior)}
                              </span>
                              {' → '}
                              <strong className="font-medium">
                                {formatarValorDaTrilha(campo.novo)}
                              </strong>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ) : null}
                </li>
              );
            })}
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
