import { AlertTriangle, Hourglass } from 'lucide-react';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import {
  ROTULO_DO_STATUS_DA_TAREFA,
  rotuloDoTipo,
  tarefaEmAndamento,
} from '@/modulos/exportacao/exportacao.regras';
import { minhasExportacoes } from '@/modulos/exportacao/exportacao.servico';
import { formatarDataHora } from '@/utilitarios/data';

/**
 * Exportações que ainda não viraram arquivo (US031).
 *
 * A planilha pronta já aparece na listagem de arquivos logo abaixo — é a que
 * ela **não** mostra que precisa deste bloco: o pedido que está na fila, o que
 * está sendo gerado agora e o que falhou não têm arquivo nenhum para listar, e
 * sem isto some sem deixar rastro para quem fechou a aba antes de a geração
 * terminar.
 *
 * Não aparece quando não há nada em preparo. Um cabeçalho permanente dizendo
 * "nenhuma exportação em preparo" ocuparia espaço em todos os dias normais para
 * informar o esperado.
 */
export async function ExportacoesEmPreparo() {
  const resultado = await minhasExportacoes();

  // Falha ao consultar não derruba a tela: o bloco é acessório, e a listagem de
  // arquivos abaixo é o conteúdo principal desta página.
  if (!resultado.sucesso) return null;

  const emAberto = resultado.dados.filter(
    (tarefa) => tarefaEmAndamento(tarefa.status) || tarefa.status === 'FALHA',
  );

  if (emAberto.length === 0) return null;

  return (
    <section className="border-borda flex flex-col gap-2 rounded-[--radius-padrao] border p-4">
      <h2 className="text-texto text-sm font-semibold">Exportações em preparo</h2>

      <ul className="flex flex-col gap-2">
        {emAberto.map((tarefa) => {
          const falhou = tarefa.status === 'FALHA';

          return (
            <li key={tarefa.tarefaId} className="flex flex-wrap items-center gap-3">
              {falhou ? (
                <AlertTriangle aria-hidden className="text-erro size-4 shrink-0" />
              ) : (
                <Hourglass aria-hidden className="text-texto-suave size-4 shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <p className="text-texto text-sm font-medium">
                  {rotuloDoTipo(tarefa.tipo)} · {tarefa.linhasPrevistas.toLocaleString('pt-BR')}{' '}
                  registros
                </p>
                <p className="text-texto-suave text-xs">
                  Pedida em {formatarDataHora(tarefa.criadoEm)}
                  {falhou && tarefa.erro ? ` · ${tarefa.erro}` : ''}
                </p>
              </div>

              <Etiqueta tom={falhou ? 'erro' : 'andamento'}>
                {ROTULO_DO_STATUS_DA_TAREFA[tarefa.status]}
              </Etiqueta>
            </li>
          );
        })}
      </ul>

      <p className="text-texto-suave text-xs">
        As planilhas grandes são preparadas em segundo plano e aparecem na lista abaixo quando ficam
        prontas. Você recebe um aviso quando isso acontecer.
      </p>
    </section>
  );
}
