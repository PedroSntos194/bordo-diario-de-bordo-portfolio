'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Repeat } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { ErrosDeCampo } from '@/lib/erros';
import { repetirEscalaDoDia } from '@/modulos/escala/escala.acoes';
import {
  DIAS_DA_SEMANA,
  LIMITE_DE_DIAS_DA_REPETICAO,
  ROTULO_DO_MOTIVO,
} from '@/modulos/escala/escala.regras';
import type { ResultadoDaRepeticao } from '@/modulos/escala/escala.servico';
import { formatarDataOperacional, somarDias } from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

/** Quantas linhas puladas a tela lista antes de resumir o resto. */
const PULADAS_VISIVEIS = 8;

/**
 * Repetir a escala do dia (US014).
 *
 * Fica abaixo da escala do dia porque o modelo é exatamente o que está na
 * lista: o administrador monta um dia, confere e repete. Começa com segunda a
 * sexta e quatro semanas, que é o caso mais comum numa frota de fretamento.
 */
export function RepetirEscala({ data, quantidade }: { data: string; quantidade: number }) {
  const router = useRouter();
  const [repetindo, iniciarRepeticao] = useTransition();

  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [ate, setAte] = useState(() => somarDias(data, 28));
  const [erro, setErro] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [resultado, setResultado] = useState<ResultadoDaRepeticao | null>(null);

  function alternarDia(valor: number): void {
    setDias((atual) =>
      atual.includes(valor) ? atual.filter((outro) => outro !== valor) : [...atual, valor],
    );
  }

  function repetir(): void {
    setErro(null);
    setErrosDeCampo({});
    setResultado(null);

    iniciarRepeticao(async () => {
      const resposta = await repetirEscalaDoDia({ dataOrigem: data, ate, diasDaSemana: dias });
      if (!resposta.sucesso) {
        setErrosDeCampo(resposta.erro.campos ?? {});
        setErro(resposta.erro.mensagem);
        return;
      }
      setResultado(resposta.dados);
      router.refresh();
    });
  }

  return (
    <section className="border-borda flex flex-col gap-4 rounded-[--radius-padrao] border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-texto text-sm font-semibold">Repetir esta escala</h2>
        <p className="text-texto-suave text-sm">
          Copia {quantidade === 1 ? 'a escala' : `as ${quantidade} escalas`} de{' '}
          {formatarDataOperacional(data)} para os próximos dias. O que já estiver planejado e quem
          estiver de folga não são alterados.
        </p>
      </div>

      {erro ? <MensagemErro mensagem={erro} /> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-texto mb-1.5 text-sm font-medium">Nos dias</legend>
        <div className="flex flex-wrap gap-2">
          {DIAS_DA_SEMANA.map((dia) => {
            const marcado = dias.includes(dia.valor);
            return (
              <label
                key={dia.valor}
                className={`flex min-h-[--spacing-toque] cursor-pointer items-center gap-2 rounded-[--radius-padrao] border px-3 text-sm ${
                  marcado
                    ? 'border-primaria bg-primaria-suave text-texto'
                    : 'border-borda text-texto-suave'
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternarDia(dia.valor)}
                  disabled={repetindo}
                  className="accent-primaria"
                />
                {dia.rotulo}
              </label>
            );
          })}
        </div>
        {errosDeCampo.diasDaSemana ? (
          <p className="text-erro text-sm">{errosDeCampo.diasDaSemana}</p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <label htmlFor="repetir-ate" className="text-texto text-sm font-medium">
          Até
        </label>
        <input
          id="repetir-ate"
          type="date"
          value={ate}
          min={somarDias(data, 1)}
          max={somarDias(data, LIMITE_DE_DIAS_DA_REPETICAO)}
          onChange={(evento) => setAte(evento.target.value)}
          disabled={repetindo}
          aria-invalid={Boolean(errosDeCampo.ate)}
          className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
        />
        {errosDeCampo.ate ? <p className="text-erro text-sm">{errosDeCampo.ate}</p> : null}
      </div>

      <Botao
        type="button"
        className="self-start"
        onClick={repetir}
        carregando={repetindo}
        disabled={dias.length === 0 || ate === ''}
      >
        <Repeat aria-hidden className="size-4" />
        Repetir escala
      </Botao>

      {resultado ? <ResumoDaRepeticao resultado={resultado} /> : null}
    </section>
  );
}

function ResumoDaRepeticao({ resultado }: { resultado: ResultadoDaRepeticao }) {
  const restantes = resultado.puladas.length - PULADAS_VISIVEIS;

  return (
    <div
      role="status"
      className="border-sucesso/30 bg-sucesso-suave flex flex-col gap-2 rounded-[--radius-padrao] border p-3 text-sm"
    >
      <p className="text-texto font-medium">
        {resultado.criadas === 0
          ? 'Nenhuma escala nova foi criada.'
          : `${resultado.criadas} ${resultado.criadas === 1 ? 'escala criada' : 'escalas criadas'} em ${resultado.datas} ${resultado.datas === 1 ? 'dia' : 'dias'}.`}
      </p>

      {resultado.ignoradas.length > 0 ? (
        <p className="text-texto-suave">
          Fora da cópia por motorista ou van inativos: {resultado.ignoradas.join('; ')}.
        </p>
      ) : null}

      {resultado.puladas.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-texto-suave">
            {resultado.puladas.length === 1
              ? '1 dia ficou como estava:'
              : `${resultado.puladas.length} dias ficaram como estavam:`}
          </p>
          <ul className="text-texto-suave list-disc pl-5">
            {resultado.puladas.slice(0, PULADAS_VISIVEIS).map((pulo) => (
              <li key={`${pulo.data}-${pulo.motorista}-${pulo.placa}`}>
                {formatarDataOperacional(pulo.data)} · {pulo.motorista} (van{' '}
                {formatarPlaca(pulo.placa)}) {ROTULO_DO_MOTIVO[pulo.motivo]}
              </li>
            ))}
          </ul>
          {restantes > 0 ? <p className="text-texto-suave">E mais {restantes}.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
