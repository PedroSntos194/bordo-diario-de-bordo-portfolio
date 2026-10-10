'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';

/**
 * Exibição da senha temporária (US004, US008).
 *
 * Mostrada **uma única vez**: a senha só existe em texto puro neste instante,
 * porque o que foi gravado é o hash Argon2id (RNF001). Se o administrador
 * fechar sem anotar, o caminho é gerar outra — não recuperar esta.
 *
 * O aviso disso precisa estar na tela, não só na documentação.
 */
interface Propriedades {
  aberto: boolean;
  nomeDoUsuario: string;
  senha: string;
  aoFechar: () => void;
}

export function ModalSenhaTemporaria({ aberto, nomeDoUsuario, senha, aoFechar }: Propriedades) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto && !elemento.open) elemento.showModal();
    if (!aberto && elemento.open) elemento.close();
    if (!aberto) setCopiado(false);
  }, [aberto]);

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // Área de transferência bloqueada pelo navegador: a senha continua
      // visível na tela para transcrição manual, então não é um erro fatal.
      setCopiado(false);
    }
  }

  return (
    <dialog
      ref={dialogo}
      // Fechar sem querer aqui custa uma senha perdida — só pelo botão.
      onCancel={(evento) => evento.preventDefault()}
      aria-labelledby="titulo-senha-temporaria"
      className="bg-fundo text-texto border-borda m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[--radius-padrao] border p-0 backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id="titulo-senha-temporaria" className="text-lg font-semibold">
          Senha temporária de {nomeDoUsuario}
        </h2>

        <p className="text-texto-suave text-sm">
          Anote ou copie agora. Esta senha <strong className="text-texto">não</strong> poderá ser
          consultada depois — se for perdida, será preciso gerar outra.
        </p>

        <div className="border-borda bg-superficie flex items-center justify-between gap-3 rounded-[--radius-padrao] border p-3">
          <code className="text-texto font-mono text-xl tracking-widest select-all">{senha}</code>
          <button
            type="button"
            onClick={copiar}
            aria-label="Copiar senha"
            className="text-texto-suave hover:bg-borda/40 flex min-h-9 items-center gap-1 rounded-[--radius-padrao] px-2 text-sm"
          >
            {copiado ? (
              <>
                <Check aria-hidden className="text-sucesso size-4" />
                Copiado
              </>
            ) : (
              <>
                <Copy aria-hidden className="size-4" />
                Copiar
              </>
            )}
          </button>
        </div>

        <p className="text-texto-suave text-xs">
          O usuário deverá trocá-la no primeiro acesso. Ela expira em 72 horas.
        </p>

        <div className="flex justify-end">
          <Botao tamanho="compacto" onClick={aoFechar} type="button">
            Já anotei
          </Botao>
        </div>
      </div>
    </dialog>
  );
}
