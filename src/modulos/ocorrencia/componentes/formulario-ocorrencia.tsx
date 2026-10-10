'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import type { ErrosDeCampo } from '@/lib/erros';
import { capturarLocalizacao } from '@/modulos/localizacao/localizacao';
import { registrarOcorrencia } from '@/modulos/ocorrencia/ocorrencia.acoes';
import {
  ROTULO_DA_OCORRENCIA,
  TAMANHO_MINIMO_DESCRICAO,
  TIPOS_DE_OCORRENCIA,
  type TipoDeOcorrencia,
} from '@/modulos/ocorrencia/ocorrencia.regras';

/**
 * Registro de ocorrência (US023 · T-Ocorrência).
 *
 * Dois campos e um botão. O motorista que está registrando um acidente ou uma
 * pane não está sentado numa mesa — quanto mais campos, maior a chance de o
 * relato ir para o WhatsApp do supervisor em vez de para o sistema.
 *
 * A localização é anexada quando o navegador entrega, e a ausência dela **não**
 * impede o registro (RN022): num subsolo ou numa estrada sem sinal, o relato
 * importa mais que a coordenada.
 */
interface Propriedades {
  /** Vincula a ocorrência a uma corrida específica, quando houver uma aberta. */
  corridaId?: string;
  aoConcluir?: () => void;
}

export function FormularioOcorrencia({ corridaId, aoConcluir }: Propriedades) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  const [tipo, setTipo] = useState<TipoDeOcorrencia | ''>('');
  const [descricao, setDescricao] = useState('');
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [registrada, setRegistrada] = useState(false);

  function enviar(evento: React.FormEvent): void {
    evento.preventDefault();
    setErroGeral(null);
    setErrosDeCampo({});

    iniciar(async () => {
      const captura = await capturarLocalizacao({ tempoLimiteMs: 8000, idadeMaximaMs: 30000 });

      const resultado = await registrarOcorrencia({
        ...(corridaId ? { corridaId } : {}),
        tipo,
        descricao,
        ...(captura.situacao === 'CAPTURADA' ? { localizacao: captura.localizacao } : {}),
      });

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErroGeral(resultado.erro.mensagem);
        return;
      }

      setRegistrada(true);
      setTipo('');
      setDescricao('');
      router.refresh();
      aoConcluir?.();
    });
  }

  if (registrada) {
    return (
      <div className="border-sucesso/30 bg-sucesso-suave flex flex-col gap-2 rounded-[--radius-padrao] border p-4">
        <p className="text-texto font-medium">Ocorrência registrada</p>
        <p className="text-texto-suave text-sm">
          A administração já consegue ver. Seu registro de km e horários não mudou.
        </p>
        <Botao type="button" variante="secundaria" onClick={() => setRegistrada(false)}>
          Registrar outra
        </Botao>
      </div>
    );
  }

  const faltam = TAMANHO_MINIMO_DESCRICAO - descricao.trim().length;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-texto mb-2 text-sm font-medium">O que aconteceu?</legend>

        <div className="grid grid-cols-2 gap-2">
          {TIPOS_DE_OCORRENCIA.map((opcao) => (
            <label
              key={opcao}
              className={`flex min-h-[--spacing-toque] cursor-pointer items-center justify-center rounded-[--radius-padrao] border px-3 text-center text-sm ${
                tipo === opcao
                  ? 'border-primaria bg-primaria-suave text-primaria font-medium'
                  : 'border-borda text-texto'
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={opcao}
                checked={tipo === opcao}
                onChange={() => setTipo(opcao)}
                disabled={enviando}
                className="sr-only"
              />
              {ROTULO_DA_OCORRENCIA[opcao]}
            </label>
          ))}
        </div>

        {errosDeCampo.tipo ? (
          <p role="alert" className="text-erro text-sm">
            {errosDeCampo.tipo}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="descricao-ocorrencia" className="text-texto text-sm font-medium">
          Descreva o que houve
        </label>
        <textarea
          id="descricao-ocorrencia"
          value={descricao}
          onChange={(evento) => setDescricao(evento.target.value)}
          disabled={enviando}
          maxLength={1000}
          rows={4}
          required
          aria-describedby="ajuda-descricao"
          className="border-borda bg-fundo text-texto rounded-[--radius-padrao] border px-3 py-2 text-base"
        />
        <p id="ajuda-descricao" className="text-texto-suave text-xs">
          {errosDeCampo.descricao
            ? errosDeCampo.descricao
            : faltam > 0
              ? `Faltam ${faltam} caracteres.`
              : 'A data, a hora e a localização entram sozinhas.'}
        </p>
      </div>

      <Botao
        type="submit"
        tamanho="grande"
        disabled={tipo === '' || descricao.trim().length < TAMANHO_MINIMO_DESCRICAO}
        carregando={enviando}
        rotuloCarregando="Registrando…"
      >
        Registrar ocorrência
      </Botao>
    </form>
  );
}
