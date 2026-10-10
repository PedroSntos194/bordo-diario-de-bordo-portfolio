import { Fuel } from 'lucide-react';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { relatorioDoVeiculo } from '@/modulos/abastecimento/abastecimento.servico';
import {
  ROTULO_DO_COMBUSTIVEL,
  precoPorLitro,
  unidadeDoCombustivel,
  type TipoDeCombustivel,
} from '@/modulos/abastecimento/abastecimento.regras';
import { formatarData } from '@/utilitarios/data';
import { formatarOdometro } from '@/utilitarios/numero';

/**
 * Abastecimentos e consumo médio de uma van (US024 · RF021).
 *
 * Componente de servidor que **consulta sozinho**, como o `HistoricoDoRegistro`
 * da Sprint 9: a tela de veículo o encaixa e não precisa saber que existe
 * abastecimento. Se a história fosse removida, sai uma linha do `page.tsx`.
 */
const MOEDA = { style: 'currency', currency: 'BRL' } as const;

export async function ConsumoDoVeiculo({ veiculoId }: { veiculoId: string }) {
  const resultado = await relatorioDoVeiculo({ veiculoId });

  if (!resultado.sucesso) return null;

  const { abastecimentos, consumo } = resultado.dados;
  const unidade = unidadeDoCombustivel(consumo.tipoCombustivel ?? 'DIESEL');

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-texto text-lg font-semibold">Abastecimentos</h2>

      {abastecimentos.length === 0 ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nenhum abastecimento registrado"
          descricao="Os motoristas registram pelo aplicativo. O consumo precisa de dois registros de tanque cheio confirmado, com o mesmo combustível."
        />
      ) : (
        <>
          <dl className="border-borda bg-superficie grid grid-cols-2 gap-4 rounded-[--radius-padrao] border p-4 md:grid-cols-4">
            <div>
              <dt className="text-texto-suave text-xs">Consumo médio</dt>
              <dd className="text-texto text-xl font-semibold">
                {consumo.mediaKmPorLitro === null
                  ? '—'
                  : `${consumo.mediaKmPorLitro.toLocaleString('pt-BR')} km/${unidade}`}
              </dd>
            </div>
            <div>
              <dt className="text-texto-suave text-xs">Km no período</dt>
              <dd className="text-texto text-xl font-semibold">
                {formatarOdometro(consumo.kmPercorrido)}
              </dd>
            </div>
            <div>
              <dt className="text-texto-suave text-xs">Combustível ({unidade})</dt>
              <dd className="text-texto text-xl font-semibold">
                {consumo.litrosConsiderados.toLocaleString('pt-BR')}
              </dd>
            </div>
            <div>
              <dt className="text-texto-suave text-xs">Registros na medida</dt>
              <dd className="text-texto text-xl font-semibold">{consumo.abastecimentos}</dd>
            </div>
          </dl>

          {/*
            A conta é tanque a tanque, e vale explicá-la: sem isso alguém soma os
            litros da tela, divide pela quilometragem e encontra outro número.
          */}
          <p className="text-texto-suave text-xs">
            {consumo.mediaKmPorLitro === null
              ? 'O consumo precisa de dois tanques cheios confirmados, com quilometragem diferente e sem mistura de combustíveis no trecho. Registros antigos sem essa informação não são tratados como tanque cheio.'
              : 'Medido entre o primeiro e o último tanque cheio confirmado. Os abastecimentos parciais entre eles entram na soma; os litros do primeiro e os registros após o último ficam fora da medida.'}
          </p>

          <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
            {abastecimentos.map((abastecimento) => {
              const tipo = abastecimento.tipoCombustivel as TipoDeCombustivel;
              const litros = Number(abastecimento.litros);
              const valor =
                abastecimento.valorTotal === null ? null : Number(abastecimento.valorTotal);
              const preco = precoPorLitro(valor, litros);

              return (
                <li
                  key={abastecimento.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm"
                >
                  <Fuel aria-hidden className="text-texto-suave size-4 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <p className="text-texto font-medium">
                      {litros.toLocaleString('pt-BR')} {unidadeDoCombustivel(tipo)} ·{' '}
                      {ROTULO_DO_COMBUSTIVEL[tipo]} · {formatarOdometro(abastecimento.odometro)} km
                    </p>
                    <p className="text-texto-suave text-xs">
                      {formatarData(abastecimento.abastecidoEm)} ·{' '}
                      {abastecimento.jornada.motorista.nome}
                      {abastecimento.posto ? ` · ${abastecimento.posto}` : ''}
                      {' · '}
                      {abastecimento.tanqueCheio === true
                        ? 'Tanque cheio'
                        : abastecimento.tanqueCheio === false
                          ? 'Abastecimento parcial'
                          : 'Tanque não informado'}
                    </p>
                  </div>

                  {valor !== null ? (
                    <div className="shrink-0 text-right">
                      <p className="text-texto">{valor.toLocaleString('pt-BR', MOEDA)}</p>
                      {preco !== null ? (
                        <p className="text-texto-suave text-xs">
                          {preco.toLocaleString('pt-BR', MOEDA)}/{unidadeDoCombustivel(tipo)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
