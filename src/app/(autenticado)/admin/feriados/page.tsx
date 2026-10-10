import type { Metadata } from 'next';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ListaFeriados } from '@/modulos/feriado/componentes/lista-feriados';
import { feriadosDoAno } from '@/modulos/feriado/feriado.servico';

export const metadata: Metadata = { title: 'Feriados' };

/** Calendário de feriados do fechamento mensal (pedido do cliente de 07/10). */
export default async function PaginaFeriados({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const { ano } = await searchParams;
  const resultado = await feriadosDoAno({ ...(ano ? { ano } : {}) });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Feriados</h1>
        <p className="text-texto-suave text-sm">
          Feriado conta como dia extra no boletim de medição e usa o horário de saída de feriado na
          hora extra.
        </p>
      </div>
      {resultado.sucesso ? (
        <ListaFeriados key={resultado.dados.ano} dados={resultado.dados} />
      ) : (
        <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />
      )}
    </div>
  );
}
