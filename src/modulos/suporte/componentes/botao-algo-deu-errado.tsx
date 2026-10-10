'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { MessageCircleWarning } from 'lucide-react';
import { montarLinkWaMe } from '@/modulos/notificacao/notificacao.regras';
import {
  montarMensagemDeSuporte,
  type EstadoDaLocalizacao,
} from '@/modulos/suporte/suporte.regras';
import { armazenamentoLocalDisponivel, listarFila } from '@/offline/fila-local';

async function contarPendentes(): Promise<number | null> {
  try {
    if (!armazenamentoLocalDisponivel()) return null;
    return (await listarFila()).length;
  } catch {
    return null;
  }
}

async function estadoDaLocalizacao(): Promise<EstadoDaLocalizacao> {
  try {
    const estado = await navigator.permissions.query({ name: 'geolocation' });
    if (estado.state === 'granted') return 'permitida';
    if (estado.state === 'denied') return 'negada';
    return 'perguntar';
  } catch {
    // iPhone antigo sem a API de permissões: melhor dizer que não deu para ver
    // do que chutar.
    return 'desconhecida';
  }
}

/**
 * "Algo deu errado?" — abre o WhatsApp de quem atende, com a mensagem pronta.
 *
 * O motorista não precisa saber explicar em que tela estava, se tinha sinal ou
 * se a localização estava bloqueada: o texto já leva isso, e ele só completa o
 * que aconteceu. É o mesmo canal do resumo do dia, então funciona sem nada
 * novo para instalar.
 */
export function BotaoAlgoDeuErrado({
  nome,
  telefone,
  versao,
}: {
  nome: string;
  telefone: string | null;
  versao: string | null;
}) {
  const caminho = usePathname();
  const [abrindo, setAbrindo] = useState(false);

  if (!telefone) {
    return <span className="text-texto-suave text-xs">Problema? Fale com o administrador.</span>;
  }

  async function abrir(numero: string): Promise<void> {
    setAbrindo(true);
    try {
      const [pendentes, localizacao] = await Promise.all([
        contarPendentes(),
        estadoDaLocalizacao(),
      ]);
      const texto = montarMensagemDeSuporte({
        nome,
        caminho,
        instante: new Date(),
        online: navigator.onLine,
        pendentes,
        localizacao,
        versao,
      });
      window.location.assign(montarLinkWaMe(numero, texto));
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void abrir(telefone)}
      disabled={abrindo}
      className="text-texto-suave inline-flex items-center gap-1 py-1 text-xs underline disabled:opacity-60"
    >
      <MessageCircleWarning aria-hidden className="size-3.5" />
      Algo deu errado?
    </button>
  );
}
