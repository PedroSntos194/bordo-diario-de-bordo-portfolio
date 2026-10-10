'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { chaveDispensaTreinamento } from '@/modulos/ajuda/treinamento.regras';

export function ConviteTreinamentoMotorista({
  usuarioId,
  sugerir = true,
}: {
  usuarioId: string;
  sugerir?: boolean;
}) {
  const caminho = usePathname();
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    let dispensado = false;
    try {
      dispensado = window.localStorage.getItem(chaveDispensaTreinamento(usuarioId)) === '1';
    } catch {
      // A demonstração continua disponível quando o navegador bloqueia armazenamento.
    }
    setVisivel(sugerir && !dispensado);
  }, [usuarioId, sugerir]);

  function dispensar() {
    try {
      window.localStorage.setItem(chaveDispensaTreinamento(usuarioId), '1');
    } catch {
      // A dispensa ainda vale nesta visita.
    }
    setVisivel(false);
  }

  if (!visivel || !sugerir || caminho === '/app/aprender' || caminho === '/app/ajuda') return null;

  return (
    <aside
      aria-label="Convite para aprender a rotina"
      className="border-primaria/30 bg-primaria-suave flex items-start gap-3 rounded-[--radius-padrao] border p-3"
    >
      <BookOpen aria-hidden className="text-primaria mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-texto text-sm font-semibold">Quer praticar antes de começar?</p>
        <p className="text-texto-suave mt-1 text-sm">
          Aprenda a iniciar o dia, registrar uma corrida e fechar o dia com um exemplo. Nada é
          enviado.
        </p>
        <Link
          href="/app/aprender"
          onClick={dispensar}
          className="text-primaria inline-flex min-h-[--spacing-toque] items-center text-sm font-medium underline"
        >
          Fazer demonstração
        </Link>
        <p className="text-texto-suave text-xs">Você pode voltar pela opção Aprender.</p>
      </div>
      <button
        type="button"
        aria-label="Dispensar convite para aprender"
        onClick={dispensar}
        className="text-texto-suave hover:bg-borda/40 flex min-h-[--spacing-toque] min-w-[--spacing-toque] shrink-0 items-center justify-center rounded-[--radius-padrao]"
      >
        <X aria-hidden className="size-4" />
      </button>
    </aside>
  );
}
