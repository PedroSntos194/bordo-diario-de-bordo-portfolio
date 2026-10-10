'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { reabrirJornada } from '@/modulos/jornada/jornada.acoes';

/**
 * "Reabrir o dia" (caso de 08/10): o motorista encerrou o dia depois da
 * primeira viagem e precisa sair de novo. Pede o motivo, que fica na trilha.
 */
export function ReabrirDia({ jornadaId, motorista }: { jornadaId: string; motorista: string }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  function reabrir(evento: React.FormEvent): void {
    evento.preventDefault();
    setErro(null);
    iniciar(async () => {
      const resultado = await reabrirJornada({ id: jornadaId, motivo });
      if (!resultado.sucesso) {
        setErro(resultado.erro.campos?.motivo ?? resultado.erro.mensagem);
        return;
      }
      setFeito(true);
      setAberto(false);
      // O aviso fica na página reaberta, que já não mostra esta seção.
      router.push(`/admin/jornadas/${jornadaId}?reaberto=1`);
    });
  }

  if (feito) {
    return (
      <p
        role="status"
        className="border-sucesso/30 bg-sucesso-suave text-texto rounded-[--radius-padrao] border p-3 text-sm"
      >
        Dia reaberto. Peça ao {motorista} para atualizar a tela do aplicativo: o dia aparece em
        andamento e ele já pode iniciar a corrida.
      </p>
    );
  }

  return (
    <section className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
      <div>
        <h2 className="text-texto text-sm font-semibold">Encerrou o dia antes da hora?</h2>
        <p className="text-texto-suave text-sm">
          Se o motorista encerrou o dia depois de uma viagem e vai sair de novo hoje, reabra o dia.
          As novas corridas entram neste mesmo dia, e os totais são recalculados quando ele encerrar
          outra vez.
        </p>
      </div>

      {aberto ? (
        <form onSubmit={reabrir} className="flex flex-col gap-3" noValidate>
          {erro ? <MensagemErro mensagem={erro} /> : null}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivo-reabertura" className="text-texto text-sm font-medium">
              Motivo
            </label>
            <textarea
              id="motivo-reabertura"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              disabled={enviando}
              maxLength={240}
              rows={2}
              placeholder="Ex.: encerrou o dia depois da primeira viagem e vai sair de novo"
              className="border-borda bg-fundo text-texto rounded-[--radius-padrao] border px-3 py-2 text-base"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Botao
              type="button"
              variante="secundaria"
              onClick={() => setAberto(false)}
              disabled={enviando}
            >
              Cancelar
            </Botao>
            <Botao type="submit" carregando={enviando} disabled={motivo.trim().length < 5}>
              Reabrir o dia
            </Botao>
          </div>
        </form>
      ) : (
        <div>
          <Botao type="button" variante="secundaria" onClick={() => setAberto(true)}>
            <RotateCcw aria-hidden className="size-4" />
            Reabrir o dia
          </Botao>
        </div>
      )}
    </section>
  );
}
