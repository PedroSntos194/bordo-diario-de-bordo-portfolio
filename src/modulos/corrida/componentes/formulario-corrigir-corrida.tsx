'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { ErrosDeCampo } from '@/lib/erros';
import { corrigirCorrida } from '@/modulos/corrida/corrida.acoes';
import { TAMANHO_MINIMO_JUSTIFICATIVA } from '@/modulos/corrida/corrida.regras';
import { formatarOdometro } from '@/utilitarios/numero';

/**
 * Correção de uma corrida encerrada (US022 · T-Correção · RN019).
 *
 * O campo obrigatório aqui não é o número: é a **justificativa**. Ela é o que
 * dá sentido ao "valor anterior" guardado na auditoria — sem ela, seis meses
 * depois, o registro mostra que o km mudou de 32 para 41 e ninguém sabe se foi
 * conserto de digitação ou maquiagem de relatório.
 */
interface Propriedades {
  corridaId: string;
  odometroInicial: number | null;
  odometroFinal: number | null;
  quantidadePassageiros: number | null;
  observacoes: string | null;
  /** Texto que explica de onde vem o direito de corrigir, por perfil. */
  avisoDePrazo: string;
}

export function FormularioCorrigirCorrida({
  corridaId,
  odometroInicial,
  odometroFinal,
  quantidadePassageiros,
  observacoes,
  avisoDePrazo,
}: Propriedades) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const [odometro, setOdometro] = useState(odometroFinal === null ? '' : String(odometroFinal));
  const [passageiros, setPassageiros] = useState(
    quantidadePassageiros === null ? '' : String(quantidadePassageiros),
  );
  const [observacao, setObservacao] = useState(observacoes ?? '');
  const [justificativa, setJustificativa] = useState('');
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});

  const odometroNumero = odometro === '' ? null : Number(odometro);
  const kmPrevisto =
    odometroNumero !== null && odometroInicial !== null && odometroNumero >= odometroInicial
      ? odometroNumero - odometroInicial
      : null;

  const faltam = TAMANHO_MINIMO_JUSTIFICATIVA - justificativa.trim().length;

  function enviar(evento: React.FormEvent): void {
    evento.preventDefault();
    setErroGeral(null);
    setErrosDeCampo({});

    iniciar(async () => {
      const resultado = await corrigirCorrida({
        id: corridaId,
        odometroFinal: odometro,
        quantidadePassageiros: passageiros === '' ? null : passageiros,
        observacoes: observacao,
        justificativa,
      });

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }

      router.replace(`/app/corrida/${corridaId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}

      <p className="border-borda bg-superficie text-texto-suave rounded-[--radius-padrao] border p-3 text-sm">
        {avisoDePrazo}
      </p>

      <CampoTexto
        rotulo="Odômetro no fim da corrida"
        value={odometro}
        onChange={(evento) => setOdometro(evento.target.value.replace(/\D/g, '').slice(0, 7))}
        erro={errosDeCampo.odometroFinal}
        disabled={enviando}
        required
        inputMode="numeric"
        className="text-2xl"
        referencia={
          odometroInicial === null
            ? undefined
            : `No início da corrida: ${formatarOdometro(odometroInicial)} km`
        }
      />

      {kmPrevisto !== null ? (
        <p
          role="status"
          className="border-primaria/30 bg-primaria-suave text-texto rounded-[--radius-padrao] border p-3 text-center"
        >
          Km da corrida: <strong>{formatarOdometro(kmPrevisto)} km</strong>
        </p>
      ) : null}

      <CampoTexto
        rotulo="Passageiros transportados"
        value={passageiros}
        onChange={(evento) => setPassageiros(evento.target.value.replace(/\D/g, '').slice(0, 3))}
        erro={errosDeCampo.quantidadePassageiros}
        disabled={enviando}
        inputMode="numeric"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="observacao-correcao" className="text-texto text-sm font-medium">
          Observações
        </label>
        <textarea
          id="observacao-correcao"
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
          disabled={enviando}
          maxLength={500}
          rows={2}
          className="border-borda bg-fundo text-texto rounded-[--radius-padrao] border px-3 py-2 text-base"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="justificativa-correcao" className="text-texto text-sm font-medium">
          Por que está corrigindo? <span className="text-erro">*</span>
        </label>
        <textarea
          id="justificativa-correcao"
          value={justificativa}
          onChange={(evento) => setJustificativa(evento.target.value)}
          disabled={enviando}
          maxLength={500}
          rows={3}
          required
          aria-describedby="ajuda-justificativa"
          className="border-borda bg-fundo text-texto rounded-[--radius-padrao] border px-3 py-2 text-base"
        />
        <p id="ajuda-justificativa" className="text-texto-suave text-xs">
          {errosDeCampo.justificativa
            ? errosDeCampo.justificativa
            : faltam > 0
              ? `Faltam ${faltam} caracteres.`
              : 'Fica registrado junto com o valor anterior.'}
        </p>
      </div>

      <Botao
        type="submit"
        tamanho="grande"
        disabled={odometro === '' || justificativa.trim().length < TAMANHO_MINIMO_JUSTIFICATIVA}
        carregando={enviando}
        rotuloCarregando="Corrigindo…"
      >
        Salvar correção
      </Botao>
    </form>
  );
}
