'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CalendarClock } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { gerarConsolidado } from '@/modulos/consolidado/consolidado.acoes';
import { dataOperacional } from '@/utilitarios/data';

/**
 * Geração manual do consolidado (US033 · T-Arquivos).
 *
 * A rotina automática das 23h é a entrega da história; este botão existe por
 * dois motivos práticos:
 *
 *  - **reprocessar** um dia depois de o administrador corrigir um registro,
 *    sem esperar o dia seguinte (RN030 garante que nada é sobrescrito);
 *  - **conferir** que a rotina funciona sem precisar virar a noite acordado —
 *    que é como a Sprint 6 foi verificada.
 */
export function BotaoGerarConsolidado() {
  const router = useRouter();
  const [gerando, iniciar] = useTransition();

  const [data, setData] = useState(() => dataOperacional());
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function gerar(): void {
    setErro(null);
    setAviso(null);

    iniciar(async () => {
      const resultado = await gerarConsolidado({ data });

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }

      setAviso(
        resultado.dados.semRegistros
          ? 'Planilha gerada com o aviso “sem registros” — não houve jornada encerrada nesse dia.'
          : `Planilha gerada com ${resultado.dados.jornadas} ${
              resultado.dados.jornadas === 1 ? 'jornada' : 'jornadas'
            }.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-3">
      <div>
        <h2 className="text-texto text-sm font-semibold">Gerar consolidado agora</h2>
        <p className="text-texto-suave text-xs">
          A planilha do dia é gerada sozinha às 23h pelo agendador. Use isto para reprocessar um dia
          já fechado — o arquivo anterior é preservado.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="data-consolidado" className="text-texto mb-1.5 block text-sm font-medium">
            Dia
          </label>
          <input
            id="data-consolidado"
            type="date"
            value={data}
            onChange={(evento) => setData(evento.target.value)}
            disabled={gerando}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
          />
        </div>

        <Botao
          type="button"
          variante="secundaria"
          onClick={gerar}
          carregando={gerando}
          rotuloCarregando="Gerando…"
          disabled={data === ''}
        >
          <CalendarClock aria-hidden className="size-4" />
          Gerar
        </Botao>
      </div>

      {erro ? <MensagemErro mensagem={erro} /> : null}
      {aviso ? (
        <p role="status" className="text-texto text-sm">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
