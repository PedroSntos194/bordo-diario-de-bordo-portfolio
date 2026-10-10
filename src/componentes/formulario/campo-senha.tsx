'use client';

import { useId, useState, type ChangeEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Campo de senha com alternância de visibilidade.
 *
 * O botão de mostrar existe porque a senha temporária é ditada por telefone e
 * digitada em teclado de celular: sem conferir o que digitou, o motorista gasta
 * tentativas e acaba bloqueado (RN003) por um erro de digitação.
 */
interface PropriedadesCampoSenha {
  nome: string;
  rotulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
  erro?: string;
  ajuda?: string;
  autoComplete?: 'current-password' | 'new-password';
  autoFocus?: boolean;
  desabilitado?: boolean;
}

export function CampoSenha({
  nome,
  rotulo,
  valor,
  aoAlterar,
  erro,
  ajuda,
  autoComplete = 'current-password',
  autoFocus,
  desabilitado,
}: PropriedadesCampoSenha) {
  const [visivel, setVisivel] = useState(false);
  const idBase = useId();
  const idCampo = `${idBase}-campo`;
  const idAjuda = `${idBase}-ajuda`;
  const idErro = `${idBase}-erro`;

  const descritores = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(' ');

  function tratarMudanca(evento: ChangeEvent<HTMLInputElement>): void {
    aoAlterar(evento.target.value);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="text-texto text-sm font-medium">
        {rotulo}
        <span className="text-erro ml-1" aria-hidden>
          *
        </span>
      </label>

      <div className="relative">
        <input
          id={idCampo}
          name={nome}
          type={visivel ? 'text' : 'password'}
          value={valor}
          onChange={tratarMudanca}
          required
          autoFocus={autoFocus}
          disabled={desabilitado}
          autoComplete={autoComplete}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descritores || undefined}
          className={cn(
            'bg-fundo text-texto min-h-[--spacing-toque] w-full rounded-[--radius-padrao] border py-2 pr-12 pl-3 text-base',
            erro ? 'border-erro' : 'border-borda',
          )}
        />

        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          disabled={desabilitado}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
          className="text-texto-suave absolute inset-y-0 right-0 flex w-11 items-center justify-center"
        >
          {visivel ? (
            <EyeOff aria-hidden className="size-5" />
          ) : (
            <Eye aria-hidden className="size-5" />
          )}
        </button>
      </div>

      {ajuda ? (
        <p id={idAjuda} className="text-texto-suave text-xs">
          {ajuda}
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
