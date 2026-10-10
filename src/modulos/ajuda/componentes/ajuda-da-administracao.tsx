'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AjudaNaTela } from '@/componentes/feedback/ajuda-na-tela';
import { ajudaAdminParaCaminho } from '@/modulos/ajuda/ajuda-admin.regras';

export function AjudaDaAdministracao() {
  const caminho = usePathname();
  if (caminho === '/admin/ajuda') return null;
  const ajuda = ajudaAdminParaCaminho(caminho);
  return (
    <div className="mb-5 flex flex-col gap-1">
      <AjudaNaTela key={ajuda.chave} titulo={ajuda.titulo} passos={[...ajuda.passos]} />
      <Link
        href="/admin/ajuda"
        className="text-primaria inline-flex min-h-[--spacing-toque] items-center self-start text-sm underline"
      >
        Ver treinamento e rotina de conferência
      </Link>
    </div>
  );
}
