'use client';

import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Campo de formulário com rótulo, ajuda e erro (doc 11 · RNF022).
 *
 * O rótulo é sempre um `<label>` real — `placeholder` nunca substitui rótulo,
 * porque desaparece ao digitar e não é lido de forma confiável por leitores de
 * tela. O erro é ligado ao campo por `aria-describedby`, e não apenas colorido.
 */
interface PropriedadesCampoTexto extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  rotulo: string;
  erro?: string;
  ajuda?: string;
  /** Texto exibido abaixo do campo como referência (ex.: último odômetro). */
  referencia?: string;
}

export function CampoTexto({
  rotulo,
  erro,
  ajuda,
  referencia,
  className,
  required,
  ...resto
}: PropriedadesCampoTexto) {
  const idBase = useId();
  const idCampo = `${idBase}-campo`;
  const idAjuda = `${idBase}-ajuda`;
  const idErro = `${idBase}-erro`;

  const descritores = [ajuda || referencia ? idAjuda : null, erro ? idErro : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="text-texto text-sm font-medium">
        {rotulo}
        {required ? (
          <span className="text-erro ml-1" aria-hidden>
            *
          </span>
        ) : null}
      </label>

      <input
        id={idCampo}
        required={required}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritores || undefined}
        className={cn(
          'bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base',
          'placeholder:text-texto-suave/60',
          erro ? 'border-erro' : 'border-borda',
          className,
        )}
        {...resto}
      />

      {ajuda || referencia ? (
        <p id={idAjuda} className="text-texto-suave text-xs">
          {ajuda ? <span className="block">{ajuda}</span> : null}
          {referencia ? <span className="block">{referencia}</span> : null}
        </p>
      ) : null}

      {erro ? (
        <p id={idErro} role="alert" className="text-erro text-xs font-medium">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
