'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import type { ErrosDeCampo } from '@/lib/erros';
import { encerrarJornada } from '@/modulos/corrida/corrida.acoes';
import { formatarOdometro } from '@/utilitarios/numero';
import { formatarDuracao } from '@/utilitarios/data';

/**
 * Encerramento do dia (T09 · US017 · RF019).
 *
 * O modal de confirmação mostra os **totais consolidados** antes de fechar.
 * Não é cerimônia: encerrar é irreversível para o motorista (RN024), e este é
 * o último instante em que ele pode notar que esqueceu uma corrida ou digitou
 * um odômetro errado — antes de o dia virar relatório para a administração.
 */
interface Propriedades {
  odometroInicial: number;
  totalCorridas: number;
  kmAteAgora: number;
  totalPassageiros: number;
  duracaoMinutos: number;
}

export function FormularioEncerrarJornada({
  odometroInicial,
  totalCorridas,
  kmAteAgora,
  totalPassageiros,
  duracaoMinutos,
}: Propriedades) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const [odometro, setOdometro] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});

  const odometroNumero = odometro === '' ? null : Number(odometro);
  const kmDoDia =
    odometroNumero !== null && odometroNumero >= odometroInicial
      ? odometroNumero - odometroInicial
      : null;

  function confirmar(): void {
    setErroGeral(null);
    setErrosDeCampo({});

    iniciar(async () => {
      const resultado = await encerrarJornada({ odometroFinal: odometro, observacoes });
      setConfirmando(false);

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }

      router.replace('/app');
      router.refresh();
    });
  }

  return (
    <>
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          setConfirmando(true);
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}

        <section className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
          <h2 className="text-texto text-sm font-semibold">Seu dia até agora</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-texto-suave text-xs">Corridas encerradas</dt>
              <dd className="text-texto text-lg font-medium">{totalCorridas}</dd>
            </div>
            <div>
              <dt className="text-texto-suave text-xs">Km das corridas</dt>
              <dd className="text-texto text-lg font-medium">{formatarOdometro(kmAteAgora)}</dd>
            </div>
            <div>
              <dt className="text-texto-suave text-xs">Passageiros</dt>
              <dd className="text-texto text-lg font-medium">{totalPassageiros}</dd>
            </div>
            <div>
              <dt className="text-texto-suave text-xs">Tempo</dt>
              <dd className="text-texto text-lg font-medium">{formatarDuracao(duracaoMinutos)}</dd>
            </div>
          </dl>
        </section>

        <CampoTexto
          rotulo="Odômetro do painel ao encerrar"
          value={odometro}
          onChange={(evento) => setOdometro(evento.target.value.replace(/\D/g, '').slice(0, 7))}
          erro={errosDeCampo.odometroFinal}
          disabled={enviando}
          required
          autoFocus
          inputMode="numeric"
          className="text-2xl"
          placeholder="000000"
          ajuda="Número total do painel. Exemplo: 125.462 km → digite 125462."
          referencia={`No início do dia: ${formatarOdometro(odometroInicial)} km`}
        />

        {kmDoDia !== null ? (
          <p
            role="status"
            className="border-primaria/30 bg-primaria-suave text-texto rounded-[--radius-padrao] border p-3 text-center"
          >
            Total do dia: <strong>{formatarOdometro(kmDoDia)} km</strong>
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="observacoes-dia" className="text-texto text-sm font-medium">
            Observações do dia
          </label>
          <textarea
            id="observacoes-dia"
            value={observacoes}
            onChange={(evento) => setObservacoes(evento.target.value)}
            disabled={enviando}
            maxLength={500}
            rows={3}
            className="border-borda bg-fundo text-texto rounded-[--radius-padrao] border px-3 py-2 text-base"
          />
        </div>

        <Botao type="submit" tamanho="grande" disabled={odometro === ''} carregando={enviando}>
          Encerrar meu dia
        </Botao>
      </form>

      <ModalConfirmacao
        aberto={confirmando}
        titulo="Encerrar o dia"
        descricao={
          <>
            Você vai fechar o dia com <strong className="text-texto">{totalCorridas}</strong>{' '}
            {totalCorridas === 1 ? 'corrida' : 'corridas'} e{' '}
            <strong className="text-texto">{formatarOdometro(kmDoDia ?? 0)} km</strong> rodados.
            Depois disso, só o administrador pode alterar o registro.
          </>
        }
        rotuloConfirmar="Encerrar meu dia"
        processando={enviando}
        aoConfirmar={confirmar}
        aoCancelar={() => setConfirmando(false)}
      />
    </>
  );
}
