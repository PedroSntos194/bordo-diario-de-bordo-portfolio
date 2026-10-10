'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { cancelarCorrida } from '@/modulos/corrida/corrida.acoes';

/**
 * Cancelamento de corrida (US018 · RN024).
 *
 * Cancelar é diferente de encerrar: a corrida não entra nos totais nem no
 * relatório de quilometragem, mas **continua existindo** com o motivo
 * registrado. Apagar seria perder a informação de que algo foi tentado e não
 * aconteceu — que é justamente o que a operação precisa saber.
 */
export function BotaoCancelarCorrida({
  corridaId,
  descricao,
}: {
  corridaId: string;
  descricao: string;
}) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function confirmar(): void {
    setErro(null);

    iniciar(async () => {
      const resultado = await cancelarCorrida({ id: corridaId, motivo });

      if (!resultado.sucesso) {
        setErro(resultado.erro.campos?.motivo ?? resultado.erro.mensagem);
        return;
      }

      setAberto(false);
      router.replace('/app');
      router.refresh();
    });
  }

  return (
    <>
      {erro && !aberto ? <MensagemErro mensagem={erro} /> : null}

      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-erro min-h-[--spacing-toque] text-sm font-medium"
      >
        Cancelar esta corrida
      </button>

      <ModalConfirmacao
        aberto={aberto}
        titulo="Cancelar corrida"
        destrutiva
        descricao={
          <div className="flex flex-col gap-3">
            <p>
              A corrida <strong className="text-texto">{descricao}</strong> não entrará nos totais
              do dia. O registro fica guardado com o motivo.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-texto text-sm font-medium">O que aconteceu?</span>
              <textarea
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                disabled={processando}
                rows={3}
                maxLength={240}
                placeholder="A van quebrou antes de sair do terminal"
                className="border-borda bg-fundo text-texto rounded-[--radius-padrao] border px-3 py-2 text-base"
              />
            </label>

            {erro ? (
              <p role="alert" className="text-erro text-xs font-medium">
                {erro}
              </p>
            ) : null}
          </div>
        }
        rotuloConfirmar="Cancelar corrida"
        processando={processando}
        aoConfirmar={confirmar}
        aoCancelar={() => {
          setAberto(false);
          setErro(null);
        }}
      />
    </>
  );
}
