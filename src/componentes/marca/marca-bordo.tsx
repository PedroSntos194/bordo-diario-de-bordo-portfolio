/**
 * Marca do Bordo (doc 11): uma van vista de frente, em roxo.
 *
 * Em SVG embutido, e não servida de `public/`: o middleware manda para o login
 * tudo o que não está em `/_next`, e a tela de login é justamente onde a marca
 * aparece. As cores são fixas — a marca tem fundo próprio, então fica igual no
 * tema claro e no escuro.
 *
 * A mesma geometria gera os ícones do aplicativo instalável em
 * `scripts/gerar-icones.ts` — mudar aqui é mudar lá também.
 */
export function MarcaBordo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Bordo"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="14" fill="#7c3aed" />
      <rect x="14" y="13" width="36" height="33" rx="8" fill="#ffffff" />
      <rect x="18" y="17" width="28" height="12" rx="3" fill="#7c3aed" />
      <circle cx="21" cy="38" r="3" fill="#7c3aed" />
      <circle cx="43" cy="38" r="3" fill="#7c3aed" />
      <rect x="28" y="36" width="8" height="4" rx="2" fill="#c4b5fd" />
      <rect x="16" y="46" width="8" height="6" rx="2" fill="#ffffff" />
      <rect x="40" y="46" width="8" height="6" rx="2" fill="#ffffff" />
    </svg>
  );
}
