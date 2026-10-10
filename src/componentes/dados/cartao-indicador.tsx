import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Cartão de indicador do dashboard (T14 · doc 11).
 *
 * **O número vem primeiro, o rótulo abaixo** — quem olha o painel de manhã lê
 * os valores, não as descrições.
 *
 * Todo indicador é clicável e leva à listagem já filtrada. Um número sem
 * caminho para o detalhe obriga o administrador a refazer o filtro na mão para
 * descobrir *quais* são os registros por trás dele.
 */
interface Propriedades {
  rotulo: string;
  valor: string | number;
  Icone: LucideIcon;
  href?: string;
  tom?: 'neutro' | 'andamento' | 'sucesso' | 'atencao';
  detalhe?: string;
}

const TONS = {
  neutro: 'text-texto',
  andamento: 'text-andamento',
  sucesso: 'text-sucesso',
  atencao: 'text-atencao',
} as const;

export function CartaoIndicador({
  rotulo,
  valor,
  Icone,
  href,
  tom = 'neutro',
  detalhe,
}: Propriedades) {
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-3xl font-semibold tabular-nums', TONS[tom])}>{valor}</span>
        <Icone aria-hidden className="text-texto-suave size-5 shrink-0" />
      </div>
      <span className="text-texto-suave text-sm">{rotulo}</span>
      {detalhe ? <span className="text-texto-suave text-xs">{detalhe}</span> : null}
    </>
  );

  const classes =
    'border-borda flex flex-col gap-1 rounded-[--radius-padrao] border p-4 transition-colors';

  if (!href) return <div className={classes}>{conteudo}</div>;

  return (
    <Link href={href} className={cn(classes, 'hover:bg-superficie')}>
      {conteudo}
    </Link>
  );
}
