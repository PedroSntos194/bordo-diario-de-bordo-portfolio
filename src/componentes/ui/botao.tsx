import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Botão do sistema (doc 11).
 *
 * `carregando` desabilita o controle e troca o rótulo: é a defesa contra o
 * duplo envio, que num sistema de registro operacional criaria uma corrida
 * duplicada — não apenas uma requisição a mais.
 */
const estilos = cva(
  'inline-flex items-center justify-center gap-2 rounded-[--radius-padrao] font-medium ' +
    'transition-[background-color,color,border-color,box-shadow,transform] duration-200 ' +
    'enabled:hover:shadow-md motion-safe:enabled:active:scale-[0.98] motion-safe:enabled:hover:-translate-y-0.5 ' +
    'motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2',
  {
    variants: {
      variante: {
        primaria: 'bg-primaria text-sobre-primaria shadow-primaria/20 hover:opacity-90',
        secundaria: 'border border-borda bg-superficie text-texto hover:bg-borda/40',
        destrutiva: 'bg-erro text-white hover:opacity-90',
        discreta: 'text-texto-suave hover:bg-superficie',
      },
      tamanho: {
        // Altura mínima de toque na área do motorista (RNF022).
        grande: 'min-h-[--spacing-toque] w-full px-6 text-lg',
        padrao: 'min-h-[--spacing-toque] px-4 text-base',
        compacto: 'min-h-9 px-3 text-sm',
      },
    },
    defaultVariants: { variante: 'primaria', tamanho: 'padrao' },
  },
);

interface PropriedadesBotao
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof estilos> {
  carregando?: boolean;
  rotuloCarregando?: string;
  children: ReactNode;
}

export function Botao({
  variante,
  tamanho,
  carregando = false,
  rotuloCarregando = 'Salvando…',
  className,
  children,
  disabled,
  ...resto
}: PropriedadesBotao) {
  return (
    <button
      className={cn(estilos({ variante, tamanho }), className)}
      disabled={disabled || carregando}
      aria-busy={carregando}
      {...resto}
    >
      {carregando ? (
        <>
          <Loader2 aria-hidden className="size-4 animate-spin" />
          {rotuloCarregando}
        </>
      ) : (
        children
      )}
    </button>
  );
}
