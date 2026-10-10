import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { FormularioUsuario } from '@/modulos/usuario/componentes/formulario-usuario';

export const metadata: Metadata = { title: 'Novo usuário' };

/** T20 — Cadastro de usuário (doc 10 · US004). */
export default function PaginaNovoUsuario() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/usuarios" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar para usuários
        </Link>
        <h1 className="text-texto text-2xl font-semibold">Novo usuário</h1>
        <p className="text-texto-suave text-sm">
          Ao salvar, o sistema gera uma senha temporária que será exibida uma única vez.
        </p>
      </div>

      <FormularioUsuario />
    </div>
  );
}
