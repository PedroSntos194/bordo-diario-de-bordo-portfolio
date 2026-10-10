import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { CodigoErro } from '@/lib/erros';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioEncerrarCorrida } from '@/modulos/corrida/componentes/formulario-encerrar-corrida';
import { obter } from '@/modulos/corrida/corrida.servico';

export const metadata: Metadata = { title: 'Encerrar corrida' };

/** T08 — Encerrar corrida (doc 10 · US019). */
export default async function PaginaEncerrarCorrida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resultado = await obter({ id });

  if (!resultado.sucesso) {
    if (resultado.erro.codigo === CodigoErro.NAO_ENCONTRADO) notFound();
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const corrida = resultado.dados;

  // Corrida já encerrada não tem o que encerrar: volta ao detalhe.
  if (corrida.status !== 'EM_ANDAMENTO') redirect(`/app/corrida/${corrida.id}`);

  const descricao = corrida.rota
    ? corrida.rota.nome
    : `${corrida.origemDescricao} → ${corrida.destinoDescricao}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link
          href={`/app/corrida/${corrida.id}`}
          className="text-texto-suave flex items-center gap-1 text-sm"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Voltar
        </Link>
        <h1 className="text-texto text-2xl font-semibold">Encerrar corrida</h1>
      </div>

      <FormularioEncerrarCorrida
        corridaId={corrida.id}
        odometroInicial={corrida.odometroInicial ?? 0}
        capacidadeDoVeiculo={corrida.jornada.veiculo.capacidadePassageiros}
        descricao={descricao}
      />
    </div>
  );
}
