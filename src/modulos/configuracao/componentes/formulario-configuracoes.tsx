'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { ErrosDeCampo } from '@/lib/erros';
import { salvarConfiguracoes } from '@/modulos/configuracao/configuracao.acoes';
import { ROTULO_DO_GRUPO, type GrupoDeParametro } from '@/modulos/configuracao/configuracao.regras';
import type { ParametroDaTela } from '@/modulos/configuracao/configuracao.servico';
import { formatarDataHora } from '@/utilitarios/data';

/**
 * Parâmetros do sistema (US042 · T-Configurações).
 *
 * Cada campo vem com a explicação do que muda na operação, não só o rótulo. O
 * administrador que mexe na tolerância do odômetro precisa saber que um valor
 * baixo demais transforma a confirmação de divergência em ruído diário — e essa
 * informação não está em lugar nenhum além daqui.
 */
interface Propriedades {
  parametros: ParametroDaTela[];
  /** Avisa que o agendador precisa reiniciar para o horário novo valer. */
  chavesQueExigemReinicio: string[];
}

export function FormularioConfiguracoes({ parametros, chavesQueExigemReinicio }: Propriedades) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();

  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(parametros.map((parametro) => [parametro.chave, parametro.valor])),
  );
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const sujo = parametros.some((parametro) => valores[parametro.chave] !== parametro.valor);

  function enviar(evento: React.FormEvent): void {
    evento.preventDefault();
    setErroGeral(null);
    setErrosDeCampo({});
    setAviso(null);

    iniciar(async () => {
      const resultado = await salvarConfiguracoes({ valores });

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }

      const { alterados } = resultado.dados;

      if (alterados.length === 0) {
        setAviso('Nenhuma alteração a salvar.');
      } else {
        const exigemReinicio = alterados.filter((chave) => chavesQueExigemReinicio.includes(chave));

        setAviso(
          exigemReinicio.length > 0
            ? `${alterados.length} parâmetro(s) salvo(s). Atenção: o horário do agendador só vale ` +
                'depois de reiniciar aquele processo (npm run agendador).'
            : `${alterados.length} parâmetro(s) salvo(s). Já está valendo.`,
        );
      }

      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6" noValidate>
      {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}

      {aviso ? (
        <p
          role="status"
          className="border-sucesso/30 bg-sucesso-suave text-texto rounded-[--radius-padrao] border p-3 text-sm"
        >
          {aviso}
        </p>
      ) : null}

      {(Object.keys(ROTULO_DO_GRUPO) as GrupoDeParametro[]).map((grupo) => {
        const doGrupo = parametros.filter((parametro) => parametro.grupo === grupo);
        if (doGrupo.length === 0) return null;
        return (
          <fieldset key={grupo} className="border-borda flex flex-col gap-6 border-t pt-4">
            <legend className="text-texto pr-2 text-base font-semibold">
              {ROTULO_DO_GRUPO[grupo]}
            </legend>
            {doGrupo.map((parametro) => campo(parametro))}
          </fieldset>
        );
      })}

      <Botao type="submit" disabled={!sujo} carregando={salvando} className="self-start">
        Salvar alterações
      </Botao>
    </form>
  );

  function campo(parametro: ParametroDaTela) {
    const id = `parametro-${parametro.chave}`;
    const erro = errosDeCampo[parametro.chave];
    const mudar = (valor: string): void =>
      setValores((atual) => ({ ...atual, [parametro.chave]: valor }));

    return (
      <div key={parametro.chave} className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-texto text-sm font-medium">
          {parametro.rotulo}
          {parametro.unidade ? (
            <span className="text-texto-suave font-normal"> ({parametro.unidade})</span>
          ) : null}
        </label>

        <p className="text-texto-suave text-xs">{parametro.explicacao}</p>

        {parametro.tipo === 'telefones' ? (
          <textarea
            id={id}
            value={valores[parametro.chave] ?? ''}
            onChange={(evento) =>
              setValores((atual) => ({ ...atual, [parametro.chave]: evento.target.value }))
            }
            disabled={salvando}
            rows={3}
            placeholder="(11) 99999-8888"
            className="border-borda bg-fundo text-texto rounded-[--radius-padrao] border px-3 py-2 font-mono text-sm"
          />
        ) : parametro.tipo === 'sim-nao' ? (
          <select
            id={id}
            value={valores[parametro.chave] ?? 'nao'}
            onChange={(evento) => mudar(evento.target.value)}
            disabled={salvando}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] max-w-48 rounded-[--radius-padrao] border px-3 text-base"
          >
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        ) : parametro.tipo === 'texto' ? (
          <input
            id={id}
            type="text"
            value={valores[parametro.chave] ?? ''}
            onChange={(evento) => mudar(evento.target.value)}
            disabled={salvando}
            {...(parametro.maximo !== null ? { maxLength: parametro.maximo } : {})}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] w-full max-w-xl rounded-[--radius-padrao] border px-3 text-base"
          />
        ) : parametro.tipo === 'dinheiro' ? (
          <input
            id={id}
            type="text"
            inputMode="decimal"
            value={valores[parametro.chave] ?? ''}
            onChange={(evento) => mudar(evento.target.value)}
            disabled={salvando}
            placeholder="0,00"
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] max-w-48 rounded-[--radius-padrao] border px-3 text-base"
          />
        ) : (
          <input
            id={id}
            type={parametro.tipo === 'horario' ? 'time' : 'number'}
            value={valores[parametro.chave] ?? ''}
            onChange={(evento) =>
              setValores((atual) => ({ ...atual, [parametro.chave]: evento.target.value }))
            }
            disabled={salvando}
            {...(parametro.minimo !== null ? { min: parametro.minimo } : {})}
            {...(parametro.maximo !== null ? { max: parametro.maximo } : {})}
            className="border-borda bg-fundo text-texto min-h-[--spacing-toque] max-w-48 rounded-[--radius-padrao] border px-3 text-base"
          />
        )}

        {erro ? (
          <p role="alert" className="text-erro text-sm">
            {erro}
          </p>
        ) : parametro.atualizadoEm ? (
          <p className="text-texto-suave text-xs">
            Alterado em {formatarDataHora(parametro.atualizadoEm)}.
          </p>
        ) : null}
      </div>
    );
  }
}
