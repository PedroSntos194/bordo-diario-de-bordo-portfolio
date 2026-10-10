import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, Fuel } from 'lucide-react';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { FormularioAbastecimento } from '@/modulos/abastecimento/componentes/formulario-abastecimento';
import { doMeuDia } from '@/modulos/abastecimento/abastecimento.servico';
import {
  ROTULO_DO_COMBUSTIVEL,
  unidadeDoCombustivel,
  type TipoDeCombustivel,
} from '@/modulos/abastecimento/abastecimento.regras';
import { formatarHora } from '@/utilitarios/data';
import { formatarOdometro } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Abastecimento' };

/**
 * Registro de abastecimento (US024 · RF021 · RN020).
 *
 * Exige o dia aberto, e a tela diz isso **antes** do formulário — mesma lição
 * da Sprint 4: esconder a ação sem explicar o porquê é o defeito; recusar
 * depois de a pessoa preencher tudo é o outro.
 */
export default async function PaginaAbastecimento() {
  const registrados = await doMeuDia();

  if (!registrados.sucesso) {
    return <MensagemErro titulo="Não foi possível carregar" mensagem={registrados.erro.mensagem} />;
  }

  const { veiculo, abastecimentos } = registrados.dados;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/app" className="text-texto-suave flex items-center gap-1 text-sm">
          <ChevronLeft aria-hidden className="size-4" />
          Voltar
        </Link>
        <h1 className="text-texto text-2xl font-semibold">Abastecimento</h1>
      </div>

      {veiculo === null ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Abra o seu dia antes"
          descricao="O abastecimento fica registrado na jornada, para depois se saber quem abasteceu e com que quilometragem."
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
        <FormularioAbastecimento
          placa={formatarPlaca(veiculo.placa)}
          odometroAtual={veiculo.odometroAtual}
        />
      )}

      {abastecimentos.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-texto text-sm font-semibold">Registrados hoje</h2>
          <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
            {abastecimentos.map((abastecimento) => {
              const tipo = abastecimento.tipoCombustivel as TipoDeCombustivel;

              return (
                <li key={abastecimento.id} className="flex items-center gap-3 px-3 py-3">
                  <Fuel aria-hidden className="text-texto-suave size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-texto text-sm font-medium">
                      {Number(abastecimento.litros).toLocaleString('pt-BR')}{' '}
                      {unidadeDoCombustivel(tipo)} · {ROTULO_DO_COMBUSTIVEL[tipo]}
                    </p>
                    <p className="text-texto-suave text-xs">
                      {formatarHora(abastecimento.abastecidoEm)} ·{' '}
                      {formatarOdometro(abastecimento.odometro)} km
                      {abastecimento.posto ? ` · ${abastecimento.posto}` : ''}
                      {' · '}
                      {abastecimento.tanqueCheio === true
                        ? 'Tanque cheio'
                        : abastecimento.tanqueCheio === false
                          ? 'Abastecimento parcial'
                          : 'Tanque não informado'}
                    </p>
                  </div>
                  {abastecimento.valorTotal !== null ? (
                    <span className="text-texto shrink-0 text-sm">
                      {Number(abastecimento.valorTotal).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
