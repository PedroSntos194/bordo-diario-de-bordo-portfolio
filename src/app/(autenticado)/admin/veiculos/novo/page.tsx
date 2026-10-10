import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { FormularioVeiculo } from '@/modulos/veiculo/componentes/formulario-veiculo';

export const metadata: Metadata = { title: 'Novo veículo' };

/** T22 — Cadastro de veículo (doc 10 · US011). */
export default function PaginaNovoVeiculo() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/veiculos" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar para veículos
        </Link>
        <h1 className="text-texto text-2xl font-semibold">Novo veículo</h1>
        <p className="text-texto-suave text-sm">
          O odômetro informado aqui é a leitura de partida. A partir daí, quem o atualiza é o
          encerramento das jornadas.
        </p>
      </div>

      <FormularioVeiculo />
    </div>
  );
}
