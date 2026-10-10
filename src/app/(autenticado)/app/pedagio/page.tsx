import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, Ticket } from 'lucide-react';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioPedagio } from '@/modulos/pedagio/componentes/formulario-pedagio';
import { doMeuDia } from '@/modulos/pedagio/pedagio.servico';
import { ROTULO_DA_FORMA, formatarReais } from '@/modulos/pedagio/pedagio.regras';
import { formatarHora } from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Pedágio' };

/**
 * Registro de pedágio (pedido do cliente de 07/10).
 *
 * Como o abastecimento, exige o dia aberto e diz isso antes do formulário.
 */
export default async function PaginaPedagio() {
  const resultado = await doMeuDia();

  if (!resultado.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />;
  }

  const { placa, pedagios, total } = resultado.dados;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/app" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar
        </Link>
        <h1 className="text-texto text-2xl font-semibold">Pedágio</h1>
      </div>

      {placa === null ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Abra o seu dia antes"
          descricao="O pedágio fica registrado no dia de trabalho, para entrar no fechamento da van certa."
          acao={
            <Link
              href="/app/jornada/abrir"
              className="bg-primaria inline-flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] px-6 font-medium text-white"
            >
              Iniciar meu dia
            </Link>
          }
        />
      ) : (
        <FormularioPedagio placa={formatarPlaca(placa)} />
      )}

      {pedagios.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-texto text-sm font-semibold">Registrados hoje</h2>
            <span className="text-texto-suave text-sm">Total {formatarReais(total)}</span>
          </div>
          <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
            {pedagios.map((pedagio) => (
              <li key={pedagio.id} className="flex items-center gap-3 px-3 py-3">
                <Ticket aria-hidden className="text-texto-suave size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-texto text-sm font-medium">{formatarReais(pedagio.valor)}</p>
                  <p className="text-texto-suave text-xs">
                    {formatarHora(pedagio.pagoEm)} · {ROTULO_DA_FORMA[pedagio.formaPagamento]}
                    {pedagio.praca ? ` · ${pedagio.praca}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
