'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITENS = [
  { href: '/app', rotulo: 'Meu dia' },
  { href: '/app/historico', rotulo: 'Histórico' },
  { href: '/app/aprender', rotulo: 'Aprender' },
  { href: '/app/ajuda', rotulo: 'Ajuda' },
];

export function NavegacaoMotorista() {
  const caminho = usePathname();
  return (
    <nav aria-label="Navegação do motorista" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ITENS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={caminho === item.href ? 'page' : undefined}
          className={`flex min-h-[--spacing-toque] min-w-0 items-center justify-center rounded-[--radius-padrao] border px-3 text-sm font-medium ${caminho === item.href ? 'border-primaria bg-primaria-suave text-primaria' : 'border-borda text-texto'}`}
        >
          {item.rotulo}
        </Link>
      ))}
    </nav>
  );
}
