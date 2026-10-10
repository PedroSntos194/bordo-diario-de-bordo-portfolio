'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, CloudUpload, TriangleAlert } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import { ROTULO_DA_OPERACAO } from '@/modulos/sincronizacao/sincronizacao.regras';
import { useOffline } from '@/offline/use-offline';
import { formatarDataHora } from '@/utilitarios/data';

/**
 * Registros que o servidor recusou (US025 · RF022 · RN025).
 *
 * O critério de aceitação é categórico: *"conflito com o servidor é apresentado
 * ao usuário com opção de resolução, **nunca descartado silenciosamente**"*. É
 * a diferença entre um sistema em que o motorista confia e um em que ele
 * desconfia — e desconfiança, aqui, significa voltar para o papel.
 *
 * Por isso o descarte existe, mas é **explícito**: o motorista lê o que o
 * servidor respondeu, entende por que aquele registro não entra, e decide. O
 * sistema não decide por ele, e também não fica tentando para sempre um envio
 * que vai ser recusado do mesmo jeito.
 */
export function PendenciasDeEnvio() {
  const { online, pendentes, conflitos, sincronizando, sincronizar, descartar } = useOffline();
  const [paraDescartar, setParaDescartar] = useState<string | null>(null);

  const emConflito = conflitos.find((operacao) => operacao.clientUuid === paraDescartar);

  if (conflitos.length === 0 && pendentes.length === 0) {
    return (
      <div className="border-sucesso/30 bg-sucesso-suave flex items-start gap-3 rounded-[--radius-padrao] border p-4">
        <CheckCircle2 aria-hidden className="text-sucesso mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-texto font-medium">Nada pendente</p>
          <p className="text-texto-suave text-sm">
            Todos os registros feitos neste aparelho já estão no servidor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {conflitos.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-texto text-lg font-semibold">
            Não aceitos pelo servidor ({conflitos.length})
          </h2>
          <p className="text-texto-suave text-sm">
            Estes registros chegaram ao servidor e foram recusados. Leia o motivo e decida: se o
            registro não faz mais sentido, descarte; se fizer, procure a administração — ela
            consegue corrigir o que você não consegue.
          </p>

          <ul className="flex flex-col gap-2">
            {conflitos.map((operacao) => (
              <li
                key={operacao.clientUuid}
                className="border-erro/30 bg-erro-suave flex flex-col gap-2 rounded-[--radius-padrao] border p-3"
              >
                <div className="flex items-start gap-3">
                  <TriangleAlert aria-hidden className="text-erro mt-0.5 size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-texto text-sm font-medium">
                      {ROTULO_DA_OPERACAO[operacao.tipo]}
                    </p>
                    <p className="text-texto-suave text-xs">
                      Registrado em {formatarDataHora(new Date(operacao.ocorridoEm))}
                    </p>
                    <p className="text-texto mt-1 text-sm">{operacao.conflito?.mensagem}</p>
                  </div>
                </div>

                <Botao
                  type="button"
                  variante="secundaria"
                  tamanho="compacto"
                  className="self-start"
                  onClick={() => setParaDescartar(operacao.clientUuid)}
                >
                  Descartar este registro
                </Botao>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pendentes.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-texto text-lg font-semibold">
              Esperando envio ({pendentes.length})
            </h2>
            <Botao
              type="button"
              variante="secundaria"
              tamanho="compacto"
              onClick={sincronizar}
              carregando={sincronizando}
              rotuloCarregando="Enviando…"
              disabled={!online}
            >
              <CloudUpload aria-hidden className="size-4" />
              Enviar agora
            </Botao>
          </div>

          {!online ? (
            <p className="text-texto-suave text-sm">
              Sem conexão. Estes registros estão guardados no aparelho e sobem sozinhos quando o
              sinal voltar — inclusive se você fechar o aplicativo.
            </p>
          ) : null}

          <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
            {pendentes.map((operacao) => (
              <li key={operacao.clientUuid} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-texto flex-1">{ROTULO_DA_OPERACAO[operacao.tipo]}</span>
                <span className="text-texto-suave text-xs">
                  {formatarDataHora(new Date(operacao.ocorridoEm))}
                  {operacao.tentativas > 0 ? ` · ${operacao.tentativas} tentativa(s)` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link
        href="/app"
        className="border-borda text-texto flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] border px-6 text-sm font-medium"
      >
        Voltar para o meu dia
      </Link>

      <ModalConfirmacao
        aberto={paraDescartar !== null}
        titulo="Descartar este registro?"
        descricao={
          <>
            {emConflito ? `${ROTULO_DA_OPERACAO[emConflito.tipo]}: ` : ''}
            {emConflito?.conflito?.mensagem} Descartar apaga o registro{' '}
            <strong>deste aparelho</strong> de vez. Nada é gravado no servidor, e não há como
            desfazer.
          </>
        }
        rotuloConfirmar="Descartar"
        destrutiva
        aoConfirmar={() => {
          if (paraDescartar) void descartar(paraDescartar);
          setParaDescartar(null);
        }}
        aoCancelar={() => setParaDescartar(null)}
      />
    </div>
  );
}
