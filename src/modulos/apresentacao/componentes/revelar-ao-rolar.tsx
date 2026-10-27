'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Anima apenas a chegada de conteúdo; sem JavaScript, tudo continua visível. */
export function RevelarAoRolar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = area.current;
    const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!elemento || !('IntersectionObserver' in window) || !('animate' in Element.prototype)) {
      return;
    }

    const animacoes = new Set<Animation>();
    let observador: IntersectionObserver | undefined;

    function observar() {
      observador?.disconnect();
      animacoes.forEach((animacao) => animacao.cancel());
      animacoes.clear();
      if (preferencia.matches || !elemento) return;

      observador = new IntersectionObserver(
        (entradas) => {
          entradas.forEach((entrada) => {
            if (!entrada.isIntersecting) return;
            const alvo = entrada.target as HTMLElement;
            observador?.unobserve(alvo);
            if (alvo.dataset.revelado === 'true') return;
            alvo.dataset.revelado = 'true';

            const animacao = alvo.animate(
              [
                { opacity: 0, transform: 'translateY(28px)' },
                { opacity: 1, transform: 'translateY(0)' },
              ],
              {
                duration: 720,
                delay: Number(alvo.dataset.revelarAtraso ?? 0),
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'backwards',
              },
            );
            animacoes.add(animacao);
            animacao.onfinish = () => animacoes.delete(animacao);
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -32px 0px' },
      );

      elemento.querySelectorAll<HTMLElement>('[data-revelar]').forEach((alvo) => {
        if (alvo.dataset.revelado !== 'true') observador?.observe(alvo);
      });
    }

    observar();
    preferencia.addEventListener('change', observar);
    return () => {
      observador?.disconnect();
      animacoes.forEach((animacao) => animacao.cancel());
      preferencia.removeEventListener('change', observar);
    };
  }, []);

  return (
    <div ref={area} className={className}>
      {children}
    </div>
  );
}
