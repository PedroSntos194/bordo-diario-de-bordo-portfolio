interface Propriedades {
  titulo: string;
  passos: string[];
  guia?: string;
}

/** Ajuda curta no próprio fluxo, disponível por teclado e sem abrir um modal. */
export function AjudaNaTela({ titulo, passos, guia }: Propriedades) {
  return (
    <details className="border-primaria/30 bg-primaria-suave rounded-[--radius-padrao] border p-3">
      <summary className="text-primaria min-h-[--spacing-toque] cursor-pointer text-sm font-medium">
        Como fazer · {titulo}
      </summary>
      <ol className="text-texto mt-2 list-decimal space-y-2 pl-5 text-sm">
        {passos.map((passo) => (
          <li key={passo}>{passo}</li>
        ))}
      </ol>
      {guia ? (
        <a
          href={guia}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primaria mt-3 inline-flex min-h-[--spacing-toque] items-center text-sm underline"
        >
          Abrir guia ilustrado (PDF)
        </a>
      ) : null}
    </details>
  );
}
