'use client';

import { useEffect, useState } from 'react';

/**
 * Tempo decorrido da corrida (T07 · doc 11).
 *
 * Client Component isolado de propósito: só ele re-renderiza a cada segundo. Se
 * o cronômetro morasse dentro do cartão da corrida, a tela inteira do motorista
 * seria recalculada sessenta vezes por minuto — em aparelho modesto isso é
 * bateria e travamento por nada.
 *
 * O horário de início vem em ISO, não como `Date`: valores atravessam a
 * fronteira servidor→cliente serializados.
 */
export function Cronometro({ desdeIso }: { desdeIso: string }) {
  const [segundos, setSegundos] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(desdeIso).getTime()) / 1000)),
  );

  useEffect(() => {
    const inicio = new Date(desdeIso).getTime();

    // Recalcula a partir do relógio a cada tique, em vez de somar 1: se o
    // aparelho suspender a tela, um contador incremental atrasaria.
    const atualizar = (): void =>
      setSegundos(Math.max(0, Math.floor((Date.now() - inicio) / 1000)));

    atualizar();
    const intervalo = setInterval(atualizar, 1000);
    return () => clearInterval(intervalo);
  }, [desdeIso]);

  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = segundos % 60;

  const doisDigitos = (valor: number): string => String(valor).padStart(2, '0');
  const texto =
    horas > 0
      ? `${horas}:${doisDigitos(minutos)}:${doisDigitos(resto)}`
      : `${doisDigitos(minutos)}:${doisDigitos(resto)}`;

  return (
    <span
      className="text-andamento font-mono text-2xl tabular-nums"
      // Sem isto, um leitor de tela anunciaria o valor a cada segundo.
      aria-live="off"
      aria-label={`Tempo decorrido: ${horas > 0 ? `${horas} horas e ` : ''}${minutos} minutos`}
    >
      {texto}
    </span>
  );
}
