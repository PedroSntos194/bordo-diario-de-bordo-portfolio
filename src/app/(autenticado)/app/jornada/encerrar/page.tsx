import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioEncerrarJornada } from '@/modulos/jornada/componentes/formulario-encerrar-jornada';
import { diaParaEncerrar } from '@/modulos/jornada/jornada.servico';
import { diferencaEmMinutos, formatarDataOperacional } from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Encerrar meu dia' };

/** T09 — Encerrar jornada (doc 10 · US017). */
export default async function PaginaEncerrarJornada() {
  // Não é o `meuDia`: ele só devolve a jornada de hoje no campo `jornada`, e o
  // dia esquecido de ontem — justamente o caso do aviso "Encerrar aquele dia" —
  // fazia esta tela voltar para o início. Ver `diaParaEncerrar`.
  const resultado = await diaParaEncerrar();

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  // Sem dia aberto não há o que encerrar — volta para a tela inicial.
  if (!resultado.dados || resultado.dados.jornada.status !== 'ABERTA') redirect('/app');

  const { jornada, deOutroDia } = resultado.dados;

  const emAndamento = jornada.corridas.find((corrida) => corrida.status === 'EM_ANDAMENTO');
  const encerradas = jornada.corridas.filter((corrida) => corrida.status === 'ENCERRADA');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/app" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar
        </Link>
        <h1 className="text-texto text-2xl font-semibold">
          {deOutroDia
            ? `Encerrar o dia ${formatarDataOperacional(jornada.data)}`
            : 'Encerrar meu dia'}
        </h1>
        {deOutroDia ? (
          // O motorista precisa saber que está fechando um dia que ficou para
          // trás — e que o odômetro pedido é o de agora, no painel.
          <p className="text-texto-suave text-sm">
            Este dia ficou aberto. Informe o odômetro que aparece agora no painel da van
            {` ${formatarPlaca(jornada.veiculo.placa)}`}.
          </p>
        ) : null}
      </div>

      {emAndamento ? (
        <MensagemErro
          titulo="Há uma corrida em andamento"
          mensagem="Encerre a corrida aberta antes de finalizar o dia."
          acao={
            <Link
              href={`/app/corrida/${emAndamento.id}`}
              className="text-primaria text-sm font-medium underline"
            >
              Ir para a corrida
            </Link>
          }
        />
      ) : (
        <FormularioEncerrarJornada
          odometroInicial={jornada.odometroInicial}
          totalCorridas={encerradas.length}
          kmAteAgora={encerradas.reduce((soma, c) => soma + Number(c.kmPercorrido ?? 0), 0)}
          totalPassageiros={encerradas.reduce(
            (soma, c) => soma + (c.quantidadePassageiros ?? 0),
            0,
          )}
          duracaoMinutos={diferencaEmMinutos(jornada.iniciadaEm, new Date())}
        />
      )}
    </div>
  );
}
