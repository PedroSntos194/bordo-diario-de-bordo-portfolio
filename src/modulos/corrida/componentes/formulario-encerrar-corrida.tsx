'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import { CodigoErro, type ErrosDeCampo } from '@/lib/erros';
import { encerrarCorrida } from '@/modulos/corrida/corrida.acoes';
import { capturarLocalizacao, explicarFalha } from '@/modulos/localizacao/localizacao';
import { formatarOdometro } from '@/utilitarios/numero';

/**
 * Encerramento da corrida (T08 · US019 · RF018).
 *
 * O km percorrido aparece **enquanto o motorista digita**, antes de confirmar.
 * É a checagem mais barata contra erro de digitação: um dígito a mais no
 * odômetro vira um número absurdo na tela, e a pessoa corrige sozinha — em vez
 * de o erro só aparecer semanas depois, no relatório de custo por rota.
 */
interface Propriedades {
  corridaId: string;
  odometroInicial: number;
  capacidadeDoVeiculo: number;
  descricao: string;
}

export function FormularioEncerrarCorrida({
  corridaId,
  odometroInicial,
  capacidadeDoVeiculo,
  descricao,
}: Propriedades) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const [odometro, setOdometro] = useState('');
  const [passageiros, setPassageiros] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [avisoGps, setAvisoGps] = useState<string | null>(null);
  const [excesso, setExcesso] = useState<string | null>(null);

  const odometroNumero = odometro === '' ? null : Number(odometro);
  const kmPrevisto =
    odometroNumero !== null && odometroNumero >= odometroInicial
      ? odometroNumero - odometroInicial
      : null;

  function enviar(confirmaExcessoPassageiros: boolean): void {
    setErroGeral(null);
    setErrosDeCampo({});

    iniciar(async () => {
      const captura = await capturarLocalizacao();
      if (captura.situacao !== 'CAPTURADA') setAvisoGps(explicarFalha(captura.situacao));

      const resultado = await encerrarCorrida({
        id: corridaId,
        odometroFinal: odometro,
        ...(passageiros === '' ? {} : { quantidadePassageiros: passageiros }),
        observacoes,
        confirmaExcessoPassageiros,
        ...(captura.situacao === 'CAPTURADA' ? { localizacao: captura.localizacao } : {}),
      });

      if (!resultado.sucesso) {
        if (resultado.erro.codigo === CodigoErro.EXCESSO_PASSAGEIROS_NAO_CONFIRMADO) {
          setExcesso(resultado.erro.mensagem);
          return;
        }

        setExcesso(null);
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
          enviar(false);
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}
        {avisoGps ? (
          <p className="border-borda bg-superficie text-texto-suave rounded-[--radius-padrao] border p-3 text-sm">
            {avisoGps}
          </p>
        ) : null}

        <div className="border-borda bg-superficie rounded-[--radius-padrao] border p-3">
          <p className="text-texto-suave text-xs">Encerrando</p>
          <p className="text-texto font-medium">{descricao}</p>
        </div>

        <CampoTexto
          rotulo="Odômetro do painel agora"
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
          referencia={`No início da corrida: ${formatarOdometro(odometroInicial)} km`}
        />

        {kmPrevisto !== null ? (
          <p
            role="status"
            className="border-primaria/30 bg-primaria-suave text-texto rounded-[--radius-padrao] border p-3 text-center"
          >
            Esta corrida terá <strong>{formatarOdometro(kmPrevisto)} km</strong>
          </p>
        ) : null}

        <CampoTexto
          rotulo="Passageiros transportados"
          value={passageiros}
          onChange={(evento) => setPassageiros(evento.target.value.replace(/\D/g, '').slice(0, 3))}
          erro={errosDeCampo.quantidadePassageiros}
          disabled={enviando}
          inputMode="numeric"
          ajuda={`Opcional. A van tem ${capacidadeDoVeiculo} lugares.`}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="campo-observacoes" className="text-texto text-sm font-medium">
            Observações
          </label>
          <textarea
            id="campo-observacoes"
            value={observacoes}
            onChange={(evento) => setObservacoes(evento.target.value)}
            disabled={enviando}
            maxLength={500}
            rows={3}
            placeholder="Algo fora do normal nesta corrida?"
            className="border-borda bg-fundo text-texto rounded-[--radius-padrao] border px-3 py-2 text-base"
          />
        </div>

        <Botao
          type="submit"
          tamanho="grande"
          carregando={enviando}
          rotuloCarregando="Encerrando…"
          disabled={odometro === ''}
        >
          Encerrar corrida
        </Botao>
      </form>

      <ModalConfirmacao
        aberto={excesso !== null}
        titulo="Confirmar passageiros"
        descricao={<>{excesso} Se o número estiver certo, confirme.</>}
        rotuloConfirmar="Confirmar e encerrar"
        processando={enviando}
        aoConfirmar={() => enviar(true)}
        aoCancelar={() => setExcesso(null)}
      />
    </>
  );
}
