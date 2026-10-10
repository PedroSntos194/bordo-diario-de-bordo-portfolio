'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { reenviarNotificacao } from '@/modulos/notificacao/notificacao.acoes';

/**
 * Reenvio manual de uma notificação (US037).
 *
 * Confirmação antes, porque reenviar é ação de saída: a mensagem chega a uma
 * pessoa de verdade, e o administrador pode estar duplicando algo que já foi
 * entregue por outro caminho.
 */
interface Propriedades {
  notificacaoId: string;
  descricao: string;
}

export function BotaoReenviar({ notificacaoId, descricao }: Propriedades) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();

  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function confirmar(): void {
    setErro(null);
    setUrl(null);
    setAviso(null);

    iniciar(async () => {
      const resultado = await reenviarNotificacao({ id: notificacaoId });
      setConfirmando(false);

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }

      setAviso(resultado.dados.mensagem);
      setUrl(resultado.dados.url);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Botao
        type="button"
        variante="secundaria"
        tamanho="compacto"
        onClick={() => setConfirmando(true)}
        carregando={processando}
        rotuloCarregando="Reenviando…"
      >
        <RefreshCw aria-hidden className="size-4" />
        Reenviar
      </Botao>

      {aviso ? (
        <p role="status" className="text-texto-suave text-xs">
          {aviso}
        </p>
      ) : null}

      {/* Canal de link: o servidor preparou, quem manda é quem está na tela. */}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primaria flex min-h-9 items-center gap-1.5 rounded-[--radius-padrao] px-3 text-sm font-medium text-white"
        >
          <MessageCircle aria-hidden className="size-4" />
          Abrir WhatsApp
        </a>
      ) : null}

      {erro ? <MensagemErro mensagem={erro} /> : null}

      <ModalConfirmacao
        aberto={confirmando}
        titulo="Reenviar notificação"
        descricao={<>A mensagem de {descricao} será enviada de novo ao destinatário.</>}
        rotuloConfirmar="Reenviar"
        processando={processando}
        aoConfirmar={confirmar}
        aoCancelar={() => setConfirmando(false)}
      />
    </div>
  );
}
