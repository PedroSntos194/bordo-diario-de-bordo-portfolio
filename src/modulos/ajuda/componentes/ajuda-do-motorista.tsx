'use client';

import { usePathname } from 'next/navigation';
import { AjudaNaTela } from '@/componentes/feedback/ajuda-na-tela';
import { ajudaParaCaminho } from '@/modulos/ajuda/ajuda.regras';

export function AjudaDoMotorista() {
  const caminho = usePathname();
  if (caminho === '/app/ajuda' || caminho === '/app/aprender') return null;
  const ajuda = ajudaParaCaminho(caminho);
  return <AjudaNaTela key={ajuda.chave} titulo={ajuda.titulo} passos={[...ajuda.passos]} />;
}
