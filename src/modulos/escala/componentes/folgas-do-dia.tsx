'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import { registrarFolgaDoDia, removerFolgaDoDia } from '@/modulos/escala/escala.acoes';
import type { PainelDaEscala } from '@/modulos/escala/escala.servico';

export function FolgasDoDia({ painel }: { painel: PainelDaEscala }) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();
  const [motoristaId, setMotoristaId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [removerId, setRemoverId] = useState<string | null>(null);
  const alvo = painel.folgas.find((folga) => folga.id === removerId);

  function salvar() {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const resultado = await registrarFolgaDoDia({ data: painel.data, motoristaId, observacoes });
      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }
      setMotoristaId('');
      setObservacoes('');
      setAviso('Folga registrada. Não haverá cobrança por falta de registro neste dia.');
      router.refresh();
    });
  }

  function remover() {
    if (!alvo) return;
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const resultado = await removerFolgaDoDia({ id: alvo.id });
      setRemoverId(null);
      if (!resultado.sucesso) setErro(resultado.erro.mensagem);
      else {
        setAviso(
          'Folga removida. Se houver escala, a cobrança por falta de registro volta a valer.',
        );
        router.refresh();
      }
    });
  }

  return (
    <section className="border-borda flex flex-col gap-4 rounded-[--radius-padrao] border p-4">
      <h2 className="text-texto text-lg font-semibold">Folgas do dia</h2>
      <p className="text-texto-suave text-sm">
        Quem está de folga não será cobrado por falta de registro, mesmo se ainda estiver na escala.
        A folga não encerra jornadas que já foram abertas.
      </p>
      {erro ? <MensagemErro mensagem={erro} /> : null}
      {aviso ? (
        <p
          role="status"
          className="bg-sucesso-suave text-texto rounded-[--radius-padrao] p-3 text-sm"
        >
          {aviso}
        </p>
      ) : null}
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          salvar();
        }}
        className="flex flex-col gap-3"
      >
        <label className="text-texto flex flex-col gap-1 text-sm">
          Motorista
          <select
            value={motoristaId}
            onChange={(evento) => setMotoristaId(evento.target.value)}
            disabled={processando}
            className="border-borda bg-fundo min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
          >
            <option value="">Escolha…</option>
            {painel.motoristas.map((motorista) => (
              <option key={motorista.id} value={motorista.id}>
                {motorista.nome}
              </option>
            ))}
          </select>
        </label>
        <CampoTexto
          rotulo="Observação"
          value={observacoes}
          onChange={(evento) => setObservacoes(evento.target.value)}
          maxLength={240}
          disabled={processando}
          ajuda="Opcional."
        />
        <Botao type="submit" disabled={!motoristaId} carregando={processando}>
          Registrar folga
        </Botao>
      </form>
      {painel.folgas.length === 0 ? (
        <p className="text-texto-suave text-sm">Nenhuma folga registrada nesta data.</p>
      ) : (
        <ul className="divide-borda divide-y">
          {painel.folgas.map((folga) => (
            <li key={folga.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-texto text-sm font-medium">{folga.motorista.nome}</p>
                {folga.observacoes ? (
                  <p className="text-texto-suave text-xs">{folga.observacoes}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setRemoverId(folga.id)}
                disabled={processando}
                className="text-primaria min-h-[--spacing-toque] px-2 text-sm underline"
              >
                Remover folga<span className="sr-only"> de {folga.motorista.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ModalConfirmacao
        aberto={Boolean(alvo)}
        titulo="Remover folga"
        descricao={`A folga de ${alvo?.motorista.nome ?? ''} será desativada. Se houver escala, a cobrança por falta de registro volta a valer.`}
        rotuloConfirmar="Remover folga"
        processando={processando}
        aoConfirmar={remover}
        aoCancelar={() => setRemoverId(null)}
      />
    </section>
  );
}
