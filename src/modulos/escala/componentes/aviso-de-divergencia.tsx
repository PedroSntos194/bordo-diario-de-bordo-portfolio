import { CalendarX2 } from 'lucide-react';
import { divergenciaDaJornada } from '@/modulos/escala/escala.servico';
import { resumirDivergencia } from '@/modulos/escala/escala.regras';

/**
 * Divergência entre a escala e o dia registrado (US014 · RF013).
 *
 * "A divergência é sinalizada ao administrador" é critério de aceitação. O
 * componente **só renderiza quando há divergência**: um aviso que aparece
 * sempre, dizendo "tudo conforme o planejado", é ruído que ensina a ignorar o
 * lugar onde o aviso de verdade vai aparecer.
 *
 * Consulta sozinho, como o `HistoricoDoRegistro`: a tela de jornada o encaixa e
 * não precisa saber que existe escala.
 */
export async function AvisoDeDivergencia({ jornadaId }: { jornadaId: string }) {
  const resultado = await divergenciaDaJornada({ jornadaId });
  if (!resultado.sucesso) return null;

  const resumo = resumirDivergencia(resultado.dados);
  if (!resumo) return null;

  return (
    <div
      role="note"
      className="border-atencao/30 bg-atencao-suave flex items-start gap-3 rounded-[--radius-padrao] border p-3"
    >
      <CalendarX2 aria-hidden className="text-atencao mt-0.5 size-5 shrink-0" />
      <div>
        <p className="text-texto text-sm font-medium">O dia saiu diferente da escala</p>
        <p className="text-texto-suave text-sm">{resumo}</p>
        <p className="text-texto-suave mt-1 text-xs">
          A escala é planejamento, não trava: o registro vale como está. Este aviso existe para a
          administração saber que o combinado mudou.
        </p>
      </div>
    </div>
  );
}
