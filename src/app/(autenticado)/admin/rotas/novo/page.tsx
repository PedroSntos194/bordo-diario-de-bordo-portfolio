import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { FormularioRota } from '@/modulos/rota/componentes/formulario-rota';

export const metadata: Metadata = { title: 'Nova rota' };

/** T24 — Cadastro de rota (doc 10 · US012). */
export default function PaginaNovaRota() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/rotas" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar para rotas
        </Link>
        <h1 className="text-texto text-2xl font-semibold">Nova rota</h1>
        <p className="text-texto-suave text-sm">
          Depois de criar, você define os pontos de parada na ordem do trajeto.
        </p>
      </div>

      <FormularioRota />
    </div>
  );
}
