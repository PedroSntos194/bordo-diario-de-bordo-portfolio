'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, MessageCircle, Send } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { confirmarEnvio, prepararResumo } from '@/modulos/notificacao/notificacao.acoes';
import type { ResumoPreparado } from '@/modulos/notificacao/notificacao.servico';

/**
 * Envio do resumo do dia ao administrador (US036 · T04).
 *
 * O fluxo tem **dois toques** de propósito, e o motivo é a abordagem V-05a: o
 * sistema não envia a mensagem, ele prepara. Quem envia é o WhatsApp do
 * motorista. Então:
 *
 *   1 · "Enviar resumo"  → o servidor monta a mensagem e devolve o link
 *   2 · "Abrir WhatsApp" → sai do aplicativo, com tudo pronto
 *   3 · "Já enviei"      → de volta, confirma, e o sistema grava a data/hora
 *
 * O passo 3 é uma afirmação do motorista, não uma verificação. Se um dia o
 * V-05 virar Cloud API, o servidor passa a devolver `situacao: 'ENVIADA'` e
 * este componente pula direto para o estado final — **sem mudar a tela
 * anterior**, que é o critério de aceitação da história.
 */
interface Propriedades {
  jornadaId: string;
  /** Data/hora do último envio já confirmado, quando houver. */
  enviadoEm: string | null;
}

export function EnviarResumo({ jornadaId, enviadoEm }: Propriedades) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();

  const [preparado, setPreparado] = useState<ResumoPreparado | null>(null);
  const [confirmado, setConfirmado] = useState(Boolean(enviadoEm));
  const [erro, setErro] = useState<string | null>(null);

  function preparar(): void {
    setErro(null);
    iniciar(async () => {
      const resultado = await prepararResumo({ jornadaId });

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }

      setPreparado(resultado.dados);

      // Canal automático (V-05b): não há nada para o motorista tocar.
      if (resultado.dados.situacao === 'ENVIADA') {
        setConfirmado(true);
        router.refresh();
      }
    });
  }

  function confirmar(): void {
    if (!preparado) return;
    setErro(null);

    iniciar(async () => {
      const resultado = await confirmarEnvio({ notificacaoId: preparado.notificacaoId });

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }

      setConfirmado(true);
      router.refresh();
    });
  }

  if (confirmado) {
    return (
      <p className="text-texto flex items-center gap-2 text-sm">
        <Check aria-hidden className="text-sucesso size-4 shrink-0" />
        Resumo enviado ao administrador
        {enviadoEm ? ` em ${enviadoEm}` : ''}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {erro ? <MensagemErro mensagem={erro} /> : null}

      {preparado === null ? (
        <Botao
          type="button"
          variante="secundaria"
          onClick={preparar}
          carregando={processando}
          rotuloCarregando="Preparando…"
        >
          <Send aria-hidden className="size-4" />
          Enviar resumo ao administrador
        </Botao>
      ) : (
        <>
          <p className="text-texto-suave text-xs">
            Mensagem pronta para <strong className="text-texto">{preparado.destinatario}</strong>.
            Toque abaixo para abrir o WhatsApp e enviar.
          </p>

          <pre className="border-borda bg-superficie text-texto max-h-48 overflow-auto rounded-[--radius-padrao] border p-3 text-xs whitespace-pre-wrap">
            {preparado.mensagem}
          </pre>

          {preparado.situacao === 'FALHA' ? (
            <MensagemErro
              titulo="Não foi possível preparar o envio"
              mensagem="O registro do seu dia está salvo. A pendência ficou anotada para a administração reenviar."
            />
          ) : null}

          {preparado.url ? (
            <a
              href={preparado.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primaria flex min-h-[--spacing-toque] items-center justify-center gap-2 rounded-[--radius-padrao] px-6 font-medium text-white"
            >
              <MessageCircle aria-hidden className="size-5" />
              Abrir WhatsApp
            </a>
          ) : null}

          <Botao
            type="button"
            variante="secundaria"
            onClick={confirmar}
            carregando={processando}
            rotuloCarregando="Registrando…"
          >
            <Check aria-hidden className="size-4" />
            Já enviei
          </Botao>
        </>
      )}
    </div>
  );
}
