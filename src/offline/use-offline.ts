'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TipoDeOperacao } from '@/modulos/sincronizacao/sincronizacao.regras';
import {
  armazenamentoLocalDisponivel,
  enfileirar,
  lerRetrato,
  removerDaFila,
  type OperacaoNaFila,
} from '@/offline/fila-local';
import { atualizarRetrato, estadoDaFila, sincronizarAgora } from '@/offline/sincronizador';
import type { RetratoDoDia } from '@/modulos/sincronizacao/sincronizacao.regras';

/**
 * Ponte entre a fila local e a interface (US025 · RF022).
 *
 * **`useOffline`, e não `usarOffline`.** É a única exceção à regra de nomes em
 * português deste projeto, e ela cabe na justificativa que a própria regra dá:
 * palavra-chave de linguagem ou framework permanece em inglês porque não é
 * nossa. O prefixo `use` é exatamente isso — o React e o seu verificador de
 * Rules of Hooks reconhecem um hook **pelo nome**, e um `usarOffline` desligaria
 * a checagem que impede chamada condicional de hook. Trocar uma verificação
 * real por coerência de vocabulário seria mau negócio.
 *
 * A fila vive fora do React — ela precisa sobreviver ao fechamento do
 * aplicativo, o que nenhum estado de componente faz. O que existe aqui é a
 * assinatura: um evento próprio avisa **todas** as telas montadas quando a fila
 * muda, para o indicador do topo e a tela de pendências nunca discordarem sobre
 * quantos registros faltam. Ver dois números diferentes na mesma tela é o
 * suficiente para o motorista deixar de confiar nos dois.
 */

const EVENTO_DE_MUDANCA = 'bordo:fila-offline';

function avisarMudanca(): void {
  window.dispatchEvent(new CustomEvent(EVENTO_DE_MUDANCA));
}

/** Intervalo da tentativa de fundo, em milissegundos. */
const INTERVALO_DE_TENTATIVA = 30_000;

export interface EstadoOffline {
  online: boolean;
  sincronizando: boolean;
  pendentes: OperacaoNaFila[];
  conflitos: OperacaoNaFila[];
  retrato: RetratoDoDia | null;
  /** O aparelho consegue guardar registro sem rede? */
  suportado: boolean;
  sincronizar: () => void;
  descartar: (clientUuid: string) => Promise<void>;
}

export function useOffline(): EstadoOffline {
  const [online, setOnline] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [pendentes, setPendentes] = useState<OperacaoNaFila[]>([]);
  const [conflitos, setConflitos] = useState<OperacaoNaFila[]>([]);
  const [retrato, setRetrato] = useState<RetratoDoDia | null>(null);

  const recarregar = useCallback(async () => {
    const fila = await estadoDaFila();
    setPendentes(fila.pendentes);
    setConflitos(fila.conflitos);
    setRetrato(await lerRetrato());
  }, []);

  const sincronizar = useCallback(() => {
    setSincronizando(true);
    void sincronizarAgora()
      .then(() => recarregar())
      .finally(() => setSincronizando(false));
  }, [recarregar]);

  const descartar = useCallback(
    async (clientUuid: string) => {
      await removerDaFila(clientUuid);
      await recarregar();
      avisarMudanca();
    },
    [recarregar],
  );

  useEffect(() => {
    // `navigator.onLine` só existe no navegador; ler durante a renderização do
    // servidor produziria HTML divergente e quebraria a hidratação.
    setOnline(navigator.onLine);
    void recarregar();
    void atualizarRetrato().then(() => void recarregar());

    // Voltou o sinal: sincroniza sozinho, que é o critério de aceitação.
    const aoConectar = (): void => {
      setOnline(true);
      setSincronizando(true);
      void sincronizarAgora()
        .then(() => atualizarRetrato())
        .then(() => recarregar())
        .finally(() => setSincronizando(false));
    };

    const aoDesconectar = (): void => setOnline(false);

    window.addEventListener('online', aoConectar);
    window.addEventListener('offline', aoDesconectar);
    window.addEventListener(EVENTO_DE_MUDANCA, recarregar as EventListener);

    // O evento `online` não é confiável sozinho: ele dispara quando a interface
    // de rede volta, não quando a internet volta. Numa van entrando na garagem
    // com Wi-Fi fraco os dois momentos são bem diferentes, e sem esta tentativa
    // periódica a fila ficaria parada com o aparelho "conectado".
    const relogio = window.setInterval(() => {
      void sincronizarAgora().then((resumo) => {
        if (!resumo.ociosa) void recarregar();
      });
    }, INTERVALO_DE_TENTATIVA);

    return () => {
      window.removeEventListener('online', aoConectar);
      window.removeEventListener('offline', aoDesconectar);
      window.removeEventListener(EVENTO_DE_MUDANCA, recarregar as EventListener);
      window.clearInterval(relogio);
    };
  }, [recarregar]);

  return {
    online,
    sincronizando,
    pendentes,
    conflitos,
    retrato,
    suportado: armazenamentoLocalDisponivel(),
    sincronizar,
    descartar,
  };
}

export interface OperacaoParaRegistrar {
  tipo: TipoDeOperacao;
  dados: Record<string, unknown>;
}

/**
 * Guarda a operação no aparelho e avisa a interface.
 *
 * O identificador é gerado **aqui**, antes de qualquer tentativa de rede: é ele
 * que torna o reenvio inofensivo (RN025). Gerá-lo no servidor derrotaria o
 * propósito — sem rede não há servidor a quem pedir.
 */
export async function registrarOffline(operacao: OperacaoParaRegistrar): Promise<string> {
  const clientUuid = crypto.randomUUID();

  await enfileirar({
    clientUuid,
    tipo: operacao.tipo,
    ocorridoEm: new Date().toISOString(),
    dados: operacao.dados,
  });

  avisarMudanca();
  return clientUuid;
}
