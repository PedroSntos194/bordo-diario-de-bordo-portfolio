'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { aceitarPrivacidade } from '@/modulos/autenticacao/autenticacao.acoes';
import type { SecaoDoAviso } from '@/modulos/privacidade/aviso-privacidade';

/**
 * Aceite do aviso de privacidade (T03 · US043 · RF042).
 *
 * A caixa de aceite começa desmarcada e o botão só habilita depois de marcada.
 * Aceite pré-marcado não é aceite informado — e o registro precisa valer como
 * demonstração de transparência (LGPD, V-09).
 */
interface Propriedades {
  versao: string;
  secoes: SecaoDoAviso[];
  destino: string;
}

export function AceitePrivacidade({ versao, secoes, destino }: Propriedades) {
  const router = useRouter();
  const [enviando, iniciarEnvio] = useTransition();
  const [marcado, setMarcado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function confirmar(): void {
    setErro(null);

    iniciarEnvio(async () => {
      const resultado = await aceitarPrivacidade({ versaoTexto: versao });

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }

      router.replace(destino);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {erro ? <MensagemErro mensagem={erro} /> : null}

      <div className="border-borda bg-superficie max-h-[50vh] overflow-y-auto rounded-[--radius-padrao] border p-4">
        <div className="flex flex-col gap-5">
          {secoes.map((secao) => (
            <section key={secao.titulo} className="flex flex-col gap-2">
              <h2 className="text-texto text-sm font-semibold">{secao.titulo}</h2>
              {secao.paragrafos.map((paragrafo) => (
                <p key={paragrafo} className="text-texto-suave text-sm leading-relaxed">
                  {paragrafo}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(evento) => setMarcado(evento.target.checked)}
          disabled={enviando}
          className="mt-0.5 size-5 shrink-0"
        />
        <span className="text-texto">
          Li e entendi quais dados o sistema coleta, para que servem e por quanto tempo ficam
          guardados.
        </span>
      </label>

      <Botao
        type="button"
        tamanho="grande"
        onClick={confirmar}
        disabled={!marcado}
        carregando={enviando}
        rotuloCarregando="Registrando…"
      >
        Aceitar e continuar
      </Botao>

      <p className="text-texto-suave text-center text-xs">Versão {versao} do aviso.</p>
    </div>
  );
}
