import type { Metadata } from 'next';
import { SeletorDeDia } from '@/componentes/dados/seletor-dia';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ChecklistPreparacao } from '@/modulos/preparacao/componentes/checklist-preparacao';
import { esquemaDia } from '@/modulos/relatorio/relatorio.schema';

export const metadata: Metadata = { title: 'Preparação da operação' };

export default async function PaginaPreparacao({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const parametros = await searchParams;
  const resultado = esquemaDia.safeParse(parametros);
  if (!resultado.success) return <MensagemErro mensagem="Escolha uma data válida." />;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-texto text-2xl font-semibold">Checklist da operação</h1>
      <SeletorDeDia permitirFuturo />
      <ChecklistPreparacao data={resultado.data.data} />
    </div>
  );
}
