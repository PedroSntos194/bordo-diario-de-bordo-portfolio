import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioIniciarCorrida } from '@/modulos/corrida/componentes/formulario-iniciar-corrida';
import { meuDia } from '@/modulos/jornada/jornada.servico';
import { ativas } from '@/modulos/rota/rota.servico';
import { minhaEscalaDeHoje } from '@/modulos/escala/escala.servico';

export const metadata: Metadata = { title: 'Iniciar corrida' };

/** T06 — Iniciar corrida (doc 10 · US018). */
export default async function PaginaIniciarCorrida() {
  const [rotas, dia, escala] = await Promise.all([ativas(), meuDia(), minhaEscalaDeHoje()]);

  if (!rotas.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={rotas.erro.mensagem} />;
  }

  /**
   * RN014 — uma corrida em andamento por vez.
   *
   * A recusa já existia no caso de uso, mas só aparecia **depois** de o
   * motorista escolher a rota e tocar em "Iniciar corrida". Quem chega aqui com
   * uma corrida aberta — pelo botão "voltar", por uma aba antiga ou pelo
   * endereço direto — preenchia o formulário inteiro para então descobrir que
   * não podia. O impedimento e o caminho de saída precisam vir antes do
   * trabalho, como já acontece na tela de encerrar o dia.
   */
  const emAndamento = dia.sucesso
    ? dia.dados.jornada?.corridas.find((corrida) => corrida.status === 'EM_ANDAMENTO')
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/app" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar
        </Link>
        <h1 className="text-texto text-2xl font-semibold">Iniciar corrida</h1>
      </div>

      {emAndamento ? (
        <MensagemErro
          titulo="Você já tem uma corrida em andamento"
          mensagem="Encerre a corrida aberta para iniciar a próxima."
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
        <FormularioIniciarCorrida
          rotas={rotas.dados}
          rotasEscaladas={escala.sucesso ? escala.dados.rotaIds : []}
        />
      )}
    </div>
  );
}
