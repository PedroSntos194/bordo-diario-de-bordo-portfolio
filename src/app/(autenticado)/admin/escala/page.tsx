import type { Metadata } from 'next';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { SeletorDeDia } from '@/componentes/dados/seletor-dia';
import { PainelDeEscala } from '@/modulos/escala/componentes/painel-de-escala';
import { painelDoDia } from '@/modulos/escala/escala.servico';
import { formatarDataOperacional } from '@/utilitarios/data';
import { FolgasDoDia } from '@/modulos/escala/componentes/folgas-do-dia';
import { RepetirEscala } from '@/modulos/escala/componentes/repetir-escala';

export const metadata: Metadata = { title: 'Escala' };

/**
 * Escala do dia (US014 · RF013 · RN013).
 *
 * O planejamento de quem dirige o quê. Serve a dois propósitos concretos:
 * pré-preencher a abertura da jornada — menos toques para quem está de pé na
 * porta da van — e dar ao painel uma referência para apontar quando o dia saiu
 * diferente do combinado.
 *
 * A escala **não impede** nada: se a van escalada quebrou, o motorista pega
 * outra e o sistema registra, sinalizando a divergência.
 */
export default async function PaginaEscala({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  const resultado = await painelDoDia({ ...(data ? { data } : {}) });

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Escala</h1>
        <SeletorDeDia permitirFuturo />
        <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Escala</h1>
        <p className="text-texto-suave text-sm">
          Quem dirige o quê em {formatarDataOperacional(resultado.dados.data)}
        </p>
      </div>

      <SeletorDeDia permitirFuturo />

      <PainelDeEscala key={`escala-${resultado.dados.data}`} painel={resultado.dados} />
      {resultado.dados.escalas.length > 0 ? (
        <RepetirEscala
          key={`repetir-${resultado.dados.data}`}
          data={resultado.dados.data}
          quantidade={resultado.dados.escalas.length}
        />
      ) : null}
      <FolgasDoDia key={`folgas-${resultado.dados.data}`} painel={resultado.dados} />
    </div>
  );
}
