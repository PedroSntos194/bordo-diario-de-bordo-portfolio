'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MapPin, Pencil } from 'lucide-react';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { mudarStatusRota } from '@/modulos/rota/rota.acoes';
import { ROTULO_TURNO } from '@/modulos/rota/rota.schema';
import type { RotaDaListagem } from '@/modulos/rota/rota.repositorio';

/** Listagem de rotas (T23 · US012). */
export function TabelaRotas({ rotas }: { rotas: RotaDaListagem[] }) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();
  const [alvo, setAlvo] = useState<RotaDaListagem | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function confirmar(): void {
    if (!alvo) return;
    setErro(null);

    iniciar(async () => {
      const resultado = await mudarStatusRota({
        id: alvo.id,
        status: alvo.status === 'ATIVA' ? 'INATIVA' : 'ATIVA',
      });
      setAlvo(null);

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {erro ? <MensagemErro mensagem={erro} /> : null}

      <ul className="flex flex-col gap-2">
        {rotas.map((rota) => (
          <li
            key={rota.id}
            className="border-borda flex flex-wrap items-center gap-3 rounded-[--radius-padrao] border p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-texto-suave font-mono text-xs">{rota.codigo}</span>
                <span className="text-texto font-medium">{rota.nome}</span>
                <Etiqueta tom={rota.status === 'ATIVA' ? 'sucesso' : 'neutro'}>
                  {rota.status === 'ATIVA' ? 'Ativa' : 'Inativa'}
                </Etiqueta>
              </div>
              <p className="text-texto-suave truncate text-xs">
                {rota.origem} → {rota.destino} · {ROTULO_TURNO[rota.turno]}
                {' · '}
                <MapPin aria-hidden className="inline size-3" />{' '}
                {rota._count.pontos === 0
                  ? 'sem paradas'
                  : `${rota._count.pontos} ${rota._count.pontos === 1 ? 'parada' : 'paradas'}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAlvo(rota)}
                className="border-borda hover:bg-superficie min-h-9 rounded-[--radius-padrao] border px-3 text-sm"
              >
                {rota.status === 'ATIVA' ? 'Desativar' : 'Reativar'}
              </button>
              <Link
                href={`/admin/rotas/${rota.id}`}
                aria-label={`Editar rota ${rota.codigo}`}
                className="text-texto-suave hover:bg-superficie flex size-9 items-center justify-center rounded-[--radius-padrao]"
              >
                <Pencil aria-hidden className="size-4" />
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {alvo ? (
        <ModalConfirmacao
          aberto
          titulo={alvo.status === 'ATIVA' ? 'Desativar rota' : 'Reativar rota'}
          descricao={
            alvo.status === 'ATIVA' ? (
              <>
                A rota <strong className="text-texto">{alvo.nome}</strong> deixará de aparecer para
                os motoristas ao iniciar uma corrida. As corridas já registradas nela continuam
                intactas.
              </>
            ) : (
              <>
                A rota <strong className="text-texto">{alvo.nome}</strong> voltará a aparecer na
                seleção dos motoristas.
              </>
            )
          }
          rotuloConfirmar={alvo.status === 'ATIVA' ? 'Desativar rota' : 'Reativar rota'}
          processando={processando}
          aoConfirmar={confirmar}
          aoCancelar={() => setAlvo(null)}
        />
      ) : null}
    </div>
  );
}
