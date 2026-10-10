'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker da área do motorista (US025 · RF022).
 *
 * Componente sem interface: só existe para o efeito. Fica montado no layout do
 * motorista, e não no layout raiz, porque o modo sem conexão é uma necessidade
 * de **campo** — o administrador trabalha sentado, com rede, e guardar telas
 * administrativas no disco do navegador levaria dado da frota inteira para
 * onde ele não precisa estar (RN029).
 *
 * O registro é tolerante a falha de propósito: navegador sem suporte, janela
 * anônima ou permissão negada não podem impedir o motorista de registrar o dia
 * com rede. Sem service worker o sistema perde o modo sem conexão, não o
 * funcionamento.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let cancelado = false;

    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registro) => {
        if (cancelado) return;

        // Pede ao worker já ativo que refresque a tela de modo sem conexão.
        // Sem isto, um deploy novo deixaria o motorista com a tela da versão
        // anterior guardada — que é o tipo de coisa que só aparece quando o
        // sinal cai, no pior momento possível.
        registro.active?.postMessage('atualizar-tela-sem-conexao');
      })
      .catch(() => {
        /* sem service worker: o aplicativo continua funcionando com rede */
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return null;
}
