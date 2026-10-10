/**
 * Marca do Bordo (doc 11): um trajeto entre a partida e o destino.
 *
 * Em SVG embutido, e não servida de `public/`: o middleware manda para o login
 * tudo o que não está em `/_next`, e a tela de login é justamente onde a marca
 * aparece. O fundo usa `currentColor` com a cor primária, então acompanha o
 * tema claro e o escuro sem precisar de duas versões.
 *
 * A mesma geometria, em escala 8×, gera os ícones do aplicativo instalável em
 * `scripts/gerar-icones.ts` — mudar aqui é mudar lá também.
 */
export function MarcaBordo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Bordo"
      className={`text-primaria ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="14" fill="currentColor" />
      <path
        d="M18 46 C18 32, 46 34, 46 18"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="18" cy="46" r="5" fill="#ffffff" />
      <circle cx="46" cy="18" r="6" fill="currentColor" stroke="#ffffff" strokeWidth="4" />
    </svg>
  );
}
