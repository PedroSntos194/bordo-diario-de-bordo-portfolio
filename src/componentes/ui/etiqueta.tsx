import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

/**
 * Etiqueta de estado (doc 11).
 *
 * Regra de acessibilidade do projeto: **estado nunca é comunicado só por cor**
 * (RNF022). Por isso a etiqueta sempre carrega texto — a cor reforça, não
 * substitui.
 */
const estilos = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tom: {
        neutro: 'bg-superficie text-texto-suave border border-borda',
        sucesso: 'bg-sucesso-suave text-sucesso',
        atencao: 'bg-atencao-suave text-atencao',
        erro: 'bg-erro-suave text-erro',
        info: 'bg-primaria-suave text-primaria',
        andamento: 'bg-andamento-suave text-andamento',
      },
    },
    defaultVariants: { tom: 'neutro' },
  },
);

interface Propriedades extends VariantProps<typeof estilos> {
  children: React.ReactNode;
  className?: string;
}

export function Etiqueta({ tom, children, className }: Propriedades) {
  return <span className={cn(estilos({ tom }), className)}>{children}</span>;
}

const TOM_POR_STATUS = {
  ATIVO: 'sucesso',
  INATIVO: 'neutro',
  BLOQUEADO: 'atencao',
  EXCLUIDO: 'erro',
} as const;

const ROTULO_POR_STATUS = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  BLOQUEADO: 'Bloqueado',
  EXCLUIDO: 'Excluído',
} as const;

export type StatusDeUsuario = keyof typeof TOM_POR_STATUS;

export function EtiquetaDeStatus({ status }: { status: StatusDeUsuario }) {
  return <Etiqueta tom={TOM_POR_STATUS[status]}>{ROTULO_POR_STATUS[status]}</Etiqueta>;
}
