'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { BellRing } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { cobrarPendenciasAgora } from '@/modulos/pendencia/pendencia.acoes';

/**
 * Cobrança manual das pendências (US038).
 *
 * A rotina das 20h é a entrega da história. Este botão existe pelos mesmos dois
 * motivos do "gerar consolidado agora": **conferir** que a rotina funciona sem
 * esperar o horário, e **cobrar de novo** um dia que o administrador acabou de
 * revisar.
 *
 * Só que aqui a repetição é barrada pela própria regra: a segunda execução do
 * mesmo dia reconhece que já cobrou e não manda nada. O botão diz isso em vez
 * de fingir que fez.
 */
interface Propriedades {
  data: string;
  /** Nada a cobrar — o botão continua visível, mas explica o que vai acontecer. */
  semPendencias: boolean;
}

export function BotaoCobrarPendencias({ data, semPendencias }: Propriedades) {
  const router = useRouter();
  const [cobrando, iniciar] = useTransition();

  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function cobrar(): void {
    setErro(null);
    setAviso(null);

    iniciar(async () => {
      const resultado = await cobrarPendenciasAgora({ data });

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }

      const { jaExecutado, notificacoes } = resultado.dados;

      setAviso(
        jaExecutado
          ? 'As pendências deste dia já haviam sido cobradas. Nada foi enviado de novo.'
          : notificacoes === 0
            ? 'Nenhuma pendência neste dia — não havia o que cobrar.'
            : `${notificacoes} ${notificacoes === 1 ? 'notificação criada' : 'notificações criadas'}. Veja a fila em Notificações.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-3">
      <div>
        <h2 className="text-texto text-sm font-semibold">Cobrar agora</h2>
        <p className="text-texto-suave text-xs">
          A cobrança sai sozinha no horário configurado em Configurações. Use isto para conferir ou
          para adiantar. Cada dia é cobrado uma única vez.
        </p>
      </div>

      <Botao
        type="button"
        variante="secundaria"
        onClick={cobrar}
        carregando={cobrando}
        rotuloCarregando="Cobrando…"
      >
        <BellRing aria-hidden className="size-4" />
        {semPendencias ? 'Cobrar (sem pendências no dia)' : 'Cobrar pendências deste dia'}
      </Botao>

      {erro ? <MensagemErro mensagem={erro} /> : null}
      {aviso ? (
        <p role="status" className="text-texto text-sm">
          {aviso}
        </p>
      ) : null}
    </div>
  );
}
