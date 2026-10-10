'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import type { ErrosDeCampo } from '@/lib/erros';
import {
  adicionarNacionaisNaTela,
  cadastrarFeriadoNaTela,
  excluirFeriadoNaTela,
} from '@/modulos/feriado/feriado.acoes';
import type { FeriadosDoAno } from '@/modulos/feriado/feriado.servico';
import { formatarDataOperacional } from '@/utilitarios/data';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaDaSemana = (data: string): string => DIAS[new Date(`${data}T12:00:00Z`).getUTCDay()] ?? '';

/**
 * Calendário de feriados (pedido do cliente de 07/10).
 *
 * Feriado cadastrado vira dia extra (S/D/F) no boletim de medição e usa o
 * horário de saída de feriado na hora extra. Os nacionais entram com um toque;
 * os municipais e estaduais, que só a operação sabe quais valem, à mão.
 */
export function ListaFeriados({ dados }: { dados: FeriadosDoAno }) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();
  const [data, setData] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [removerId, setRemoverId] = useState<string | null>(null);
  const alvo = dados.feriados.find((feriado) => feriado.id === removerId);

  function limparMensagens(): void {
    setErro(null);
    setErrosDeCampo({});
    setAviso(null);
  }

  function adicionar(): void {
    limparMensagens();
    iniciar(async () => {
      const resultado = await cadastrarFeriadoNaTela({ data, nome });
      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        setErro(resultado.erro.mensagem);
        return;
      }
      setData('');
      setNome('');
      setAviso('Feriado cadastrado.');
      router.refresh();
    });
  }

  function adicionarNacionais(): void {
    limparMensagens();
    iniciar(async () => {
      const resultado = await adicionarNacionaisNaTela({ ano: dados.ano });
      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }
      setAviso(
        resultado.dados.adicionados === 1
          ? '1 feriado nacional adicionado.'
          : `${resultado.dados.adicionados} feriados nacionais adicionados.`,
      );
      router.refresh();
    });
  }

  function remover(): void {
    if (!alvo) return;
    limparMensagens();
    iniciar(async () => {
      const resultado = await excluirFeriadoNaTela({ id: alvo.id });
      setRemoverId(null);
      if (!resultado.sucesso) setErro(resultado.erro.mensagem);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/feriados?ano=${dados.ano - 1}`}
          aria-label={`Ano ${dados.ano - 1}`}
          className="text-texto-suave hover:bg-borda/40 flex size-9 items-center justify-center rounded-[--radius-padrao]"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Link>
        <span className="text-texto text-lg font-semibold">{dados.ano}</span>
        <Link
          href={`/admin/feriados?ano=${dados.ano + 1}`}
          aria-label={`Ano ${dados.ano + 1}`}
          className="text-texto-suave hover:bg-borda/40 flex size-9 items-center justify-center rounded-[--radius-padrao]"
        >
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>

      {erro ? <MensagemErro mensagem={erro} /> : null}
      {aviso ? (
        <p
          role="status"
          className="border-sucesso/30 bg-sucesso-suave text-texto rounded-[--radius-padrao] border p-3 text-sm"
        >
          {aviso}
        </p>
      ) : null}

      {dados.nacionaisQueFaltam > 0 ? (
        <section className="border-primaria/30 bg-primaria-suave flex flex-wrap items-center justify-between gap-3 rounded-[--radius-padrao] border p-4">
          <p className="text-texto text-sm">
            {dados.nacionaisQueFaltam === 1
              ? `Falta 1 feriado nacional de ${dados.ano}.`
              : `Faltam ${dados.nacionaisQueFaltam} feriados nacionais de ${dados.ano}.`}{' '}
            Carnaval e Corpus Christi são ponto facultativo: cadastre à mão se forem folga.
          </p>
          <Botao type="button" onClick={adicionarNacionais} carregando={processando}>
            <CalendarPlus aria-hidden className="size-4" />
            Adicionar os nacionais
          </Botao>
        </section>
      ) : null}

      <section className="border-borda flex flex-col gap-4 rounded-[--radius-padrao] border p-4">
        <h2 className="text-texto text-sm font-semibold">Adicionar feriado</h2>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feriado-data" className="text-texto text-sm font-medium">
              Data
            </label>
            <input
              id="feriado-data"
              type="date"
              value={data}
              onChange={(evento) => setData(evento.target.value)}
              disabled={processando}
              aria-invalid={Boolean(errosDeCampo.data)}
              className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feriado-nome" className="text-texto text-sm font-medium">
              Nome
            </label>
            <input
              id="feriado-nome"
              type="text"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              disabled={processando}
              maxLength={80}
              placeholder="Aniversário de São Paulo"
              aria-invalid={Boolean(errosDeCampo.nome)}
              className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
            />
          </div>
          <Botao
            type="button"
            onClick={adicionar}
            carregando={processando}
            disabled={!data || !nome.trim()}
          >
            Adicionar
          </Botao>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-texto text-lg font-semibold">
          Feriados de {dados.ano} ({dados.feriados.length})
        </h2>
        {dados.feriados.length === 0 ? (
          <p className="text-texto-suave text-sm">Nenhum feriado cadastrado neste ano.</p>
        ) : (
          <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
            {dados.feriados.map((feriado) => (
              <li key={feriado.id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-texto w-24 shrink-0 text-sm tabular-nums">
                  {formatarDataOperacional(feriado.data)}
                </span>
                <span className="text-texto-suave hidden w-16 shrink-0 text-xs sm:inline">
                  {diaDaSemana(feriado.data)}
                </span>
                <span className="text-texto min-w-0 flex-1 text-sm">{feriado.nome}</span>
                <button
                  type="button"
                  onClick={() => setRemoverId(feriado.id)}
                  disabled={processando}
                  aria-label={`Remover ${feriado.nome}`}
                  className="text-texto-suave hover:bg-borda/40 flex size-9 shrink-0 items-center justify-center rounded-[--radius-padrao] disabled:opacity-50"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ModalConfirmacao
        aberto={removerId !== null}
        titulo="Remover este feriado?"
        destrutiva
        descricao={
          alvo
            ? `${formatarDataOperacional(alvo.data)} (${alvo.nome}) volta a ser dia normal no fechamento.`
            : ''
        }
        rotuloConfirmar="Remover"
        processando={processando}
        aoConfirmar={remover}
        aoCancelar={() => setRemoverId(null)}
      />
    </div>
  );
}
