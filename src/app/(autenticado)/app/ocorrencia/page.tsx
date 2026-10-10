import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioOcorrencia } from '@/modulos/ocorrencia/componentes/formulario-ocorrencia';
import { meuDia } from '@/modulos/jornada/jornada.servico';

export const metadata: Metadata = { title: 'Registrar ocorrência' };

/** T-Ocorrência — Registrar ocorrência (doc 10 · US023 · RF020). */
export default async function PaginaOcorrencia() {
  const resultado = await meuDia();

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const jornada = resultado.dados.jornada;

  // Sem dia iniciado não há a que vincular a ocorrência.
  if (!jornada) redirect('/app');

  const emAndamento = jornada.corridas.find((corrida) => corrida.status === 'EM_ANDAMENTO');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/app" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar
        </Link>
        <h1 className="text-texto text-2xl font-semibold">Registrar ocorrência</h1>
        <p className="text-texto-suave text-sm">
          {emAndamento
            ? 'Fica vinculada à corrida em andamento.'
            : 'Fica vinculada ao seu dia de hoje.'}
        </p>
      </div>

      {/*
        RN023, dita ao motorista em uma frase. Ele precisa saber que relatar um
        problema não estraga o registro do dia — senão não relata.
      */}
      <p className="border-borda bg-superficie text-texto-suave rounded-[--radius-padrao] border p-3 text-sm">
        O registro de km, horários e corridas <strong className="text-texto">não muda</strong>. A
        ocorrência é um aviso à administração.
      </p>

      <FormularioOcorrencia {...(emAndamento ? { corridaId: emAndamento.id } : {})} />
    </div>
  );
}
