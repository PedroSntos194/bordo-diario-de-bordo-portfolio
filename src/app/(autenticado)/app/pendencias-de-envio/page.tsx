import type { Metadata } from 'next';
import { PendenciasDeEnvio } from '@/modulos/sincronizacao/componentes/pendencias-de-envio';

export const metadata: Metadata = { title: 'Registros pendentes' };

/**
 * Registros feitos no aparelho que ainda não chegaram ao servidor (US025).
 *
 * Casca de novo: o conteúdo vem do aparelho, e por isso a tela funciona com ou
 * sem rede. É para cá que o indicador do topo leva quando algo foi recusado —
 * um aviso que não tem para onde levar é um aviso que o motorista aprende a
 * ignorar.
 */
export default function PaginaPendenciasDeEnvio() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Registros pendentes</h1>
        <p className="text-texto-suave text-sm">O que este aparelho guardou e ainda não subiu.</p>
      </div>

      <PendenciasDeEnvio />
    </div>
  );
}
