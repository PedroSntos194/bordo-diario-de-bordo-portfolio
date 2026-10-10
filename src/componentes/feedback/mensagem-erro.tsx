import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Alerta de erro no topo de um formulário ou tela (doc 18).
 *
 * `acao` existe para os conflitos: quando o sistema recusa porque já há uma
 * corrida em andamento, a mensagem sozinha deixa o usuário parado. O caminho de
 * saída precisa vir junto do impedimento.
 */
interface PropriedadesMensagemErro {
  titulo?: string;
  mensagem: string;
  acao?: ReactNode;
  className?: string;
}

export function MensagemErro({ titulo, mensagem, acao, className }: PropriedadesMensagemErro) {
  return (
    <div
      role="alert"
      className={cn(
        'border-erro/30 bg-erro-suave flex items-start gap-3 rounded-[--radius-padrao] border p-3',
        className,
      )}
    >
      <AlertTriangle aria-hidden className="text-erro mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-2">
        {titulo ? <p className="text-erro text-sm font-semibold">{titulo}</p> : null}
        <p className="text-texto text-sm">{mensagem}</p>
        {acao ? <div>{acao}</div> : null}
      </div>
    </div>
  );
}
