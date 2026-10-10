'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  BookOpen,
  Bus,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileSpreadsheet,
  ListChecks,
  LayoutDashboard,
  Map,
  Navigation,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Navegação da área administrativa (doc 11).
 *
 * Agrupada por assunto — *Operação*, *Cadastros*, *Saídas*, *Sistema* — em vez
 * de uma lista corrida de doze itens. Itens ainda não implementados aparecem
 * desabilitados com a sprint prevista: some-los faria o administrador achar que
 * o escopo encolheu.
 */
interface ItemDeMenu {
  rotulo: string;
  href: string;
  Icone: typeof Users;
  disponivel: boolean;
  previsto?: string;
}

const GRUPOS: { titulo: string; itens: ItemDeMenu[] }[] = [
  {
    titulo: 'Operação',
    itens: [
      { rotulo: 'Dashboard', href: '/admin', Icone: LayoutDashboard, disponivel: true },
      {
        rotulo: 'Situação dos motoristas',
        href: '/admin/motoristas',
        Icone: Users,
        disponivel: true,
      },
      { rotulo: 'Checklist', href: '/admin/preparacao', Icone: ListChecks, disponivel: true },
      { rotulo: 'Jornadas', href: '/admin/jornadas', Icone: ClipboardList, disponivel: true },
      { rotulo: 'Corridas', href: '/admin/corridas', Icone: Navigation, disponivel: true },
      { rotulo: 'Resumo do dia', href: '/admin/resumo', Icone: CalendarCheck, disponivel: true },
      { rotulo: 'Pendências', href: '/admin/pendencias', Icone: ListChecks, disponivel: true },
      { rotulo: 'Escala', href: '/admin/escala', Icone: CalendarRange, disponivel: true },
    ],
  },
  {
    titulo: 'Cadastros',
    itens: [
      { rotulo: 'Usuários', href: '/admin/usuarios', Icone: Users, disponivel: true },
      { rotulo: 'Veículos', href: '/admin/veiculos', Icone: Bus, disponivel: true },
      { rotulo: 'Rotas', href: '/admin/rotas', Icone: Map, disponivel: true },
      { rotulo: 'Feriados', href: '/admin/feriados', Icone: CalendarDays, disponivel: true },
    ],
  },
  {
    titulo: 'Saídas',
    itens: [
      {
        rotulo: 'Fechamento do mês',
        href: '/admin/fechamento',
        Icone: Receipt,
        disponivel: true,
      },
      { rotulo: 'Arquivos', href: '/admin/arquivos', Icone: FileSpreadsheet, disponivel: true },
      { rotulo: 'Relatórios', href: '/admin/relatorios', Icone: BarChart3, disponivel: true },
      { rotulo: 'Importar', href: '/admin/importar', Icone: Upload, disponivel: true },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [
      { rotulo: 'Como usar', href: '/admin/ajuda', Icone: BookOpen, disponivel: true },
      { rotulo: 'Notificações', href: '/admin/notificacoes', Icone: Bell, disponivel: true },
      { rotulo: 'Auditoria', href: '/admin/auditoria', Icone: ScrollText, disponivel: true },
      { rotulo: 'Configurações', href: '/admin/configuracoes', Icone: Settings, disponivel: true },
      { rotulo: 'Retenção', href: '/admin/retencao', Icone: ShieldCheck, disponivel: true },
    ],
  },
];

export function MenuLateral() {
  const caminho = usePathname();

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-5 p-4">
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <h2 className="text-texto-suave px-2 text-xs font-semibold tracking-wide uppercase">
            {grupo.titulo}
          </h2>

          {grupo.itens.map((item) => {
            const ativo =
              item.href === '/admin' ? caminho === '/admin' : caminho.startsWith(item.href);

            if (!item.disponivel) {
              return (
                <span
                  key={item.href}
                  aria-disabled
                  title={`Disponível na ${item.previsto}`}
                  className="text-texto-suave/50 flex items-center gap-2 rounded-[--radius-padrao] px-2 py-2 text-sm"
                >
                  <item.Icone aria-hidden className="size-4 shrink-0" />
                  <span className="flex-1">{item.rotulo}</span>
                  <span className="text-[0.65rem]">{item.previsto}</span>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-[--radius-padrao] px-2 py-2 text-sm',
                  ativo
                    ? 'bg-primaria-suave text-primaria font-medium'
                    : 'text-texto hover:bg-superficie',
                )}
              >
                <item.Icone aria-hidden className="size-4 shrink-0" />
                {item.rotulo}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
