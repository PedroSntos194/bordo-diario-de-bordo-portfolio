import type { ReactNode } from 'react';
import { Inbox, SearchX } from 'lucide-react';

/**
 * Estado vazio (doc 11).
 *
 * A distinção entre `motivo: 'sem-dados'` e `motivo: 'sem-resultado'` não é
 * cosmética: "nenhum veículo cadastrado" e "nenhum veículo com este filtro" são
 * problemas diferentes e pedem ações diferentes. Tratar os dois com o mesmo
 * texto faz o usuário procurar um registro que ele mesmo escondeu no filtro.
 */
interface PropriedadesEstadoVazio {
  motivo: 'sem-dados' | 'sem-resultado';
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}

export function EstadoVazio({ motivo, titulo, descricao, acao }: PropriedadesEstadoVazio) {
  const Icone = motivo === 'sem-resultado' ? SearchX : Inbox;

  return (
    <div className="border-borda flex flex-col items-center justify-center gap-3 rounded-[--radius-padrao] border border-dashed px-6 py-12 text-center">
      <Icone aria-hidden className="text-texto-suave size-8" />
      <p className="text-texto text-base font-medium">{titulo}</p>
      {descricao ? <p className="text-texto-suave max-w-sm text-sm">{descricao}</p> : null}
      {acao ? <div className="mt-2">{acao}</div> : null}
    </div>
  );
}
