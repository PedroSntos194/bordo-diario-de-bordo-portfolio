'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  COOKIE_DO_TEMA,
  COR_DA_BARRA,
  ROTULO_DO_TEMA,
  TEMAS,
  lerTema,
  type Tema,
} from '@/utilitarios/tema';

type TemaEfetivo = 'escuro' | 'claro';

function aparelhoEscuro(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function efetivoDe(tema: Tema): TemaEfetivo {
  if (tema !== 'sistema') return tema;
  return aparelhoEscuro() ? 'escuro' : 'claro';
}

function temaDoCookie(): Tema | null {
  const par = document.cookie.split('; ').find((item) => item.startsWith(`${COOKIE_DO_TEMA}=`));
  return par ? lerTema(par.split('=')[1]) : null;
}

/** Aplica na hora, sem recarregar, e guarda para o servidor desenhar as próximas páginas. */
function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;

  const seguro = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${COOKIE_DO_TEMA}=${tema}; path=/; max-age=31536000; samesite=lax${seguro}`;

  // A barra do navegador acompanha o fundo. Com "igual ao celular" cada meta
  // volta à cor da sua `media`.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const media = meta.getAttribute('media');
    const cor =
      tema === 'sistema' && media
        ? COR_DA_BARRA[media.includes('dark') ? 'escuro' : 'claro']
        : COR_DA_BARRA[efetivoDe(tema)];
    meta.setAttribute('content', cor);
  }
}

/**
 * Escolha entre tela escura e clara (doc 11).
 *
 * `alternar` é o botão curto da barra do motorista, que troca entre as duas
 * com um toque — no sol não há tempo para menu. `completo` é o da tela de
 * perfil, com a terceira opção, "igual ao celular".
 *
 * Genérico de propósito: não conhece motorista nem administrador.
 */
export function SeletorDeTema({
  inicial,
  variante = 'completo',
}: {
  inicial: Tema;
  variante?: 'alternar' | 'completo';
}) {
  const [tema, setTema] = useState<Tema>(inicial);
  // Antes de montar não há `matchMedia`; o servidor desenha pelo tema salvo.
  const [efetivo, setEfetivo] = useState<TemaEfetivo>(inicial === 'claro' ? 'claro' : 'escuro');

  useEffect(() => {
    // Uma página guardada pelo service worker pode ter sido desenhada com o
    // tema anterior; o cookie é a escolha vigente.
    const salvo = temaDoCookie();
    if (salvo && salvo !== document.documentElement.dataset.tema) {
      document.documentElement.dataset.tema = salvo;
      setTema(salvo);
    }
    setEfetivo(efetivoDe(salvo ?? inicial));
  }, [inicial]);

  function escolher(novo: Tema): void {
    aplicarTema(novo);
    setTema(novo);
    setEfetivo(efetivoDe(novo));
  }

  if (variante === 'alternar') {
    const proximo: TemaEfetivo = efetivo === 'escuro' ? 'claro' : 'escuro';
    const Icone = proximo === 'claro' ? Sun : Moon;
    return (
      <button
        type="button"
        onClick={() => escolher(proximo)}
        className="text-texto-suave inline-flex items-center gap-1 py-1 text-xs underline"
      >
        <Icone aria-hidden className="size-3.5" />
        {proximo === 'claro' ? 'Tela clara' : 'Tela escura'}
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label="Aparência da tela" className="flex flex-wrap gap-2">
      {TEMAS.map((opcao) => (
        <button
          key={opcao}
          type="button"
          role="radio"
          aria-checked={tema === opcao}
          onClick={() => escolher(opcao)}
          className={cn(
            'min-h-[--spacing-toque] rounded-[--radius-padrao] border px-4 text-sm',
            tema === opcao
              ? 'border-primaria bg-primaria-suave text-texto font-medium'
              : 'border-borda text-texto-suave',
          )}
        >
          {ROTULO_DO_TEMA[opcao]}
        </button>
      ))}
    </div>
  );
}
