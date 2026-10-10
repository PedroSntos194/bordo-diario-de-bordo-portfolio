'use client';

import { useEffect } from 'react';
import { definirVersaoDoRelato, relatarErro } from '@/modulos/suporte/relato';

/**
 * Escuta os erros que escapam no navegador e os relata ao servidor.
 *
 * Sem isto, um erro no celular do motorista morre ali: ninguém fica sabendo
 * até ele reclamar — se reclamar. Fica no layout das áreas autenticadas, onde
 * existe sessão para dizer de quem é o aparelho.
 *
 * Os erros de renderização que o React captura não passam por aqui; a tela de
 * erro (`app/error.tsx`) relata esses.
 */
export function RelatorDeErros({ versao }: { versao: string | null }) {
  useEffect(() => {
    definirVersaoDoRelato(versao);

    const aoErro = (evento: ErrorEvent): void => {
      relatarErro(evento.error ?? evento.message, evento.filename);
    };
    const aoRejeitar = (evento: PromiseRejectionEvent): void => {
      relatarErro(evento.reason);
    };

    window.addEventListener('error', aoErro);
    window.addEventListener('unhandledrejection', aoRejeitar);
    return () => {
      window.removeEventListener('error', aoErro);
      window.removeEventListener('unhandledrejection', aoRejeitar);
    };
  }, [versao]);

  return null;
}
