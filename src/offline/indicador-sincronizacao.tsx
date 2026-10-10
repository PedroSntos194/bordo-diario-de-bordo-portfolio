'use client';

import Link from 'next/link';
import { CheckCircle2, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { textoDaSincronizacao } from '@/modulos/sincronizacao/sincronizacao.regras';
import { useOffline } from '@/offline/use-offline';

/**
 * Indicador permanente de sincronização (US025 · RF022).
 *
 * "Um indicador **permanente** mostra o estado" é critério de aceitação, e a
 * palavra que importa é permanente. Um aviso que só aparece quando há problema
 * deixa a dúvida de sempre — "será que foi?" —, que é a mesma dúvida que fez o
 * diário de papel fracassar. Aqui o motorista lê "Sincronizado" e para de
 * pensar no assunto.
 *
 * Estado nunca é comunicado só por cor (RNF022): cada situação tem texto e
 * ícone próprios.
 */
const TOM: Record<string, string> = {
  sucesso: 'text-sucesso',
  andamento: 'text-andamento',
  atencao: 'text-atencao',
  erro: 'text-erro',
};

export function IndicadorDeSincronizacao() {
  const { online, sincronizando, pendentes, conflitos, sincronizar } = useOffline();

  const { rotulo, tom } = textoDaSincronizacao({
    online,
    pendentes: pendentes.length,
    emConflito: conflitos.length,
    sincronizando,
  });

  const Icone =
    conflitos.length > 0
      ? TriangleAlert
      : sincronizando
        ? RefreshCw
        : !online
          ? CloudOff
          : pendentes.length > 0
            ? RefreshCw
            : CheckCircle2;

  const conteudo = (
    <>
      <Icone
        aria-hidden
        className={cn('size-4 shrink-0', TOM[tom], sincronizando && 'animate-spin')}
      />
      <span className={cn('text-xs font-medium', TOM[tom])}>{rotulo}</span>
    </>
  );

  // Com conflito, o indicador vira caminho: leva para onde a decisão é tomada.
  // Sem ele, o motorista leria "1 registro precisa de você" e não saberia onde.
  if (conflitos.length > 0) {
    return (
      <Link
        href="/app/pendencias-de-envio"
        aria-live="polite"
        className="border-erro/40 bg-erro-suave flex min-h-9 items-center gap-1.5 rounded-full border px-3"
      >
        {conteudo}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={sincronizar}
      disabled={sincronizando || !online}
      aria-live="polite"
      title={
        online
          ? 'Toque para enviar os registros pendentes agora'
          : 'Sem conexão. Os registros ficam guardados no aparelho e sobem sozinhos quando o sinal voltar.'
      }
      className="border-borda flex min-h-9 items-center gap-1.5 rounded-full border px-3 disabled:opacity-70"
    >
      {conteudo}
    </button>
  );
}
