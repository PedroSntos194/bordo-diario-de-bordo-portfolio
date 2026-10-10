'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Circle, MapPin, Undo2 } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { capturarLocalizacao } from '@/modulos/localizacao/localizacao';
import { desfazerEvento, registrarEvento } from '@/modulos/evento/evento.acoes';
import {
  JANELA_DESFAZER_MINUTOS,
  ROTULO_DO_EVENTO,
  podeDesfazer,
  type TipoDeEvento,
} from '@/modulos/evento/evento.regras';
import { formatarHora } from '@/utilitarios/data';

/**
 * Paradas e eventos da corrida (US021 · T07).
 *
 * Com rota cadastrada, cada ponto vira um botão: **um toque registra chegada**,
 * o segundo registra a saída. Em corrida avulsa há um campo de nome livre.
 *
 * O botão de desfazer some sozinho quando a janela de 2 minutos fecha. Isso é
 * deliberado: mostrar um botão que vai recusar quando tocado é pior do que não
 * mostrar botão nenhum — a recusa chega depois da expectativa.
 */
interface PontoDaRota {
  id: string;
  nome: string;
  ordem: number;
}

interface EventoRegistrado {
  id: string;
  tipo: TipoDeEvento;
  descricao: string | null;
  ocorridoEm: Date;
  pontoParada: { id: string; nome: string; ordem: number } | null;
}

interface Propriedades {
  corridaId: string;
  pontos: PontoDaRota[];
  /**
   * A corrida tem rota cadastrada — mesmo que a rota não tenha paradas.
   *
   * Sem isto, rota sem paradas e corrida avulsa caíam na mesma mensagem, "esta
   * corrida não tem rota cadastrada", que é falsa no primeiro caso: o motorista
   * escolheu a rota, ela aparece no cabeçalho da própria tela, e a frase o faz
   * pensar que a corrida saiu sem ela.
   */
  temRota: boolean;
  eventos: EventoRegistrado[];
  /** Corrida encerrada mostra a linha do tempo, sem os controles. */
  editavel: boolean;
}

export function ParadasDaCorrida({ corridaId, pontos, temRota, eventos, editavel }: Propriedades) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [nomeAvulso, setNomeAvulso] = useState('');

  /**
   * Releitura periódica do relógio.
   *
   * Sem isto, o botão "desfazer" ficaria visível para sempre depois de
   * renderizado: o componente não teria motivo para recalcular a janela.
   */
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  function registrar(tipo: 'CHEGADA' | 'SAIDA', ponto?: PontoDaRota): void {
    setErro(null);

    iniciar(async () => {
      const captura = await capturarLocalizacao({ tempoLimiteMs: 8000, idadeMaximaMs: 30000 });

      const resultado = await registrarEvento({
        corridaId,
        tipo,
        ...(ponto ? { pontoParadaId: ponto.id } : { descricao: nomeAvulso }),
        ...(captura.situacao === 'CAPTURADA' ? { localizacao: captura.localizacao } : {}),
      });

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }

      if (!ponto) setNomeAvulso('');
      setAgora(Date.now());
      router.refresh();
    });
  }

  function desfazer(id: string): void {
    setErro(null);

    iniciar(async () => {
      const resultado = await desfazerEvento({ id });
      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }
      router.refresh();
    });
  }

  /** Último evento de cada ponto, para saber se o próximo toque é chegada ou saída. */
  function ultimoTipoNoPonto(pontoId: string): TipoDeEvento | null {
    const doPonto = eventos.filter((evento) => evento.pontoParada?.id === pontoId);
    return doPonto.length > 0 ? (doPonto[doPonto.length - 1]?.tipo ?? null) : null;
  }

  const ultimoEvento = eventos.length > 0 ? eventos[eventos.length - 1] : undefined;
  const desfazivel =
    editavel && ultimoEvento ? podeDesfazer(ultimoEvento.ocorridoEm, new Date(agora)) : false;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-texto text-sm font-semibold">Paradas</h2>

      {erro ? <MensagemErro mensagem={erro} /> : null}

      {editavel ? (
        pontos.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {pontos.map((ponto) => {
              const ultimo = ultimoTipoNoPonto(ponto.id);
              const proximo = ultimo === 'CHEGADA' ? 'SAIDA' : 'CHEGADA';

              return (
                <li key={ponto.id}>
                  <button
                    type="button"
                    onClick={() => registrar(proximo, ponto)}
                    disabled={enviando}
                    className="border-borda hover:bg-superficie flex min-h-[--spacing-toque] w-full items-center gap-3 rounded-[--radius-padrao] border px-3 text-left disabled:opacity-60"
                  >
                    <MapPin aria-hidden className="text-texto-suave size-4 shrink-0" />
                    <span className="text-texto flex-1 truncate">
                      {ponto.ordem}. {ponto.nome}
                    </span>
                    <span className="text-primaria shrink-0 text-sm font-medium">
                      {proximo === 'CHEGADA' ? 'Cheguei' : 'Saí'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          // Sem pontos cadastrados — corrida avulsa, ou rota sem paradas —, o
          // nome da parada vem do motorista. Só a frase muda entre os dois.
          <div className="flex flex-col gap-2">
            <label htmlFor="parada-avulsa" className="text-texto-suave text-xs">
              {temRota
                ? 'Esta rota não tem paradas cadastradas. Informe o nome da parada.'
                : 'Esta corrida não tem rota cadastrada. Informe o nome da parada.'}
            </label>
            <div className="flex gap-2">
              <input
                id="parada-avulsa"
                value={nomeAvulso}
                onChange={(evento) => setNomeAvulso(evento.target.value)}
                disabled={enviando}
                maxLength={160}
                placeholder="Ex.: Portaria 2"
                className="border-borda bg-fundo text-texto min-h-[--spacing-toque] flex-1 rounded-[--radius-padrao] border px-3 text-base"
              />
              <Botao
                type="button"
                variante="secundaria"
                onClick={() => registrar('CHEGADA')}
                disabled={nomeAvulso.trim() === ''}
                carregando={enviando}
                rotuloCarregando="…"
              >
                Cheguei
              </Botao>
            </div>
          </div>
        )
      ) : null}

      {eventos.length === 0 ? (
        <p className="text-texto-suave text-sm">
          {editavel
            ? 'Nenhuma parada registrada ainda.'
            : 'Nenhuma parada foi registrada nesta corrida.'}
        </p>
      ) : (
        <ol className="border-borda flex flex-col gap-0 border-l pl-4">
          {eventos.map((evento) => (
            <li key={evento.id} className="relative py-2">
              <Circle
                aria-hidden
                className="text-primaria absolute top-3 -left-[1.4rem] size-2 fill-current"
              />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-texto text-sm">
                  <strong className="font-medium">{ROTULO_DO_EVENTO[evento.tipo]}</strong>
                  {evento.pontoParada ? ` · ${evento.pontoParada.nome}` : ''}
                  {evento.descricao ? ` · ${evento.descricao}` : ''}
                </span>
                <span className="text-texto-suave shrink-0 font-mono text-xs">
                  {formatarHora(evento.ocorridoEm)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {desfazivel && ultimoEvento ? (
        <button
          type="button"
          onClick={() => desfazer(ultimoEvento.id)}
          disabled={enviando}
          className="text-texto-suave hover:bg-superficie flex min-h-9 items-center justify-center gap-2 self-start rounded-[--radius-padrao] px-3 text-sm underline disabled:opacity-60"
        >
          <Undo2 aria-hidden className="size-4" />
          Desfazer &ldquo;{ROTULO_DO_EVENTO[ultimoEvento.tipo]}
          {ultimoEvento.pontoParada ? ` · ${ultimoEvento.pontoParada.nome}` : ''}&rdquo;
          <span className="text-xs">(até {JANELA_DESFAZER_MINUTOS} min)</span>
        </button>
      ) : null}
    </section>
  );
}
