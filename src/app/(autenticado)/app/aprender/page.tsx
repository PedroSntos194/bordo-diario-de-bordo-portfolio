import type { Metadata } from 'next';
import { DemonstracaoMotorista } from '@/modulos/ajuda/componentes/demonstracao-motorista';

export const metadata: Metadata = { title: 'Aprender a rotina' };

export default function PaginaAprender() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Aprender a rotina</h1>
        <p className="text-texto-suave mt-1 text-sm">
          Pratique em quatro etapas. Avance no seu ritmo e volte quando precisar.
        </p>
      </div>
      <DemonstracaoMotorista />
    </div>
  );
}
