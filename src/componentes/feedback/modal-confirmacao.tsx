'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Botao } from '@/componentes/ui/botao';

/**
 * Confirmação de ação irreversível (RN024 · doc 11).
 *
 * Usado **apenas** nas ações listadas em RN024. Excesso de modal treina o
 * usuário a confirmar sem ler, e aí a confirmação deixa de proteger o que
 * importa — encerrar uma jornada, excluir um usuário.
 *
 * O botão primário carrega o **verbo da ação** ("Excluir usuário"), nunca "OK":
 * quem lê só o botão precisa saber o que vai acontecer.
 */
interface Propriedades {
  aberto: boolean;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  destrutiva?: boolean;
  processando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

export function ModalConfirmacao({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar,
  destrutiva = false,
  processando = false,
  aoConfirmar,
  aoCancelar,
}: Propriedades) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;

    // `showModal` dá foco preso, fechamento por Esc e camada de sobreposição
    // sem precisar reimplementar nada disso (RNF022).
    if (aberto && !elemento.open) elemento.showModal();
    if (!aberto && elemento.open) elemento.close();
  }, [aberto]);

  function tratarCancelamento(evento: React.SyntheticEvent<HTMLDialogElement>): void {
    evento.preventDefault();
    // Ação destrutiva não fecha por Esc: é fácil demais apertar sem querer.
    if (destrutiva || processando) return;
    aoCancelar();
  }

  return (
    <dialog
      ref={dialogo}
      onCancel={tratarCancelamento}
      aria-labelledby="titulo-confirmacao"
      className="bg-fundo text-texto border-borda m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[--radius-padrao] border p-0 backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id="titulo-confirmacao" className="text-lg font-semibold">
          {titulo}
        </h2>

        <div className="text-texto-suave text-sm">{descricao}</div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao
            variante="secundaria"
            tamanho="compacto"
            onClick={aoCancelar}
            disabled={processando}
            type="button"
          >
            Cancelar
          </Botao>
          <Botao
            variante={destrutiva ? 'destrutiva' : 'primaria'}
            tamanho="compacto"
            onClick={aoConfirmar}
            carregando={processando}
            rotuloCarregando="Confirmando…"
            type="button"
          >
            {rotuloConfirmar}
          </Botao>
        </div>
      </div>
    </dialog>
  );
}
