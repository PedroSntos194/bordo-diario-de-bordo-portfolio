'use client';

import { Printer } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';

export function BotaoImprimir({ desabilitado = false }: { desabilitado?: boolean }) {
  return (
    <Botao
      type="button"
      variante="secundaria"
      disabled={desabilitado}
      onClick={() => window.print()}
      data-nao-imprimir
    >
      <Printer aria-hidden className="size-4" />
      Imprimir relatório
    </Botao>
  );
}
