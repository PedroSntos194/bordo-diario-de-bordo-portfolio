import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { CodigoErro } from '@/lib/erros';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioCorrigirCorrida } from '@/modulos/corrida/componentes/formulario-corrigir-corrida';
import { JANELA_EDICAO_HORAS_PADRAO, podeCorrigirAgora } from '@/modulos/corrida/corrida.regras';
import { janelaDeCorrecao, obter } from '@/modulos/corrida/corrida.servico';
import { formatarDataHora } from '@/utilitarios/data';

export const metadata: Metadata = { title: 'Corrigir corrida' };

/** T-Correção — Corrigir uma corrida encerrada (doc 10 · US022 · RF023). */
export default async function PaginaCorrigirCorrida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [resultado, janela] = await Promise.all([obter({ id }), janelaDeCorrecao()]);

  if (!resultado.sucesso) {
    if (resultado.erro.codigo === CodigoErro.NAO_ENCONTRADO) notFound();
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const corrida = resultado.dados;
  const horas = janela.sucesso ? janela.dados.horas : JANELA_EDICAO_HORAS_PADRAO;
  const perfil = janela.sucesso ? janela.dados.perfil : 'MOTORISTA';
  const podeCorrigir = podeCorrigirAgora({
    perfil,
    encerradaEm: corrida.encerradaEm,
    agora: new Date(),
    janelaHoras: horas,
  });

  if (corrida.status !== 'ENCERRADA') {
    return (
      <MensagemErro
        titulo="Esta corrida não está encerrada"
        mensagem="Só é possível corrigir uma corrida já encerrada."
        acao={
          <Link href={`/app/corrida/${id}`} className="text-primaria text-sm font-medium underline">
            Voltar para a corrida
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link
          href={`/app/corrida/${id}`}
          className="text-texto-suave flex items-center gap-1 text-sm"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Voltar para a corrida
        </Link>
        <h1 className="text-texto text-2xl font-semibold">Corrigir corrida</h1>
      </div>

      {/*
        RN019 — fora da janela o motorista não corrige, e a mensagem precisa
        dizer o caminho: procurar o administrador, que corrige a qualquer
        momento. Recusar sem apontar a saída deixa o registro errado para sempre.
      */}
      {podeCorrigir ? (
        <FormularioCorrigirCorrida
          corridaId={corrida.id}
          odometroInicial={corrida.odometroInicial}
          odometroFinal={corrida.odometroFinal}
          quantidadePassageiros={corrida.quantidadePassageiros}
          observacoes={corrida.observacoes}
          avisoDePrazo={
            perfil === 'ADMIN'
              ? 'Como administrador, você corrige a qualquer momento. A justificativa fica na trilha de auditoria.'
              : `Você pode corrigir até ${horas} horas depois de encerrar a corrida.` +
                (corrida.encerradaEm
                  ? ` Encerrada em ${formatarDataHora(corrida.encerradaEm)}.`
                  : '')
          }
        />
      ) : (
        <MensagemErro
          titulo="O prazo para corrigir já passou"
          mensagem={
            `A correção pelo motorista vale por ${horas} horas depois do encerramento. ` +
            'Procure o administrador, que pode corrigir a qualquer momento.'
          }
          acao={
            <Link
              href={`/app/corrida/${id}`}
              className="text-primaria text-sm font-medium underline"
            >
              Voltar para a corrida
            </Link>
          }
        />
      )}
    </div>
  );
}
