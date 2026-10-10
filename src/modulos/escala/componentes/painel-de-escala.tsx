'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import type { ErrosDeCampo } from '@/lib/erros';
import { criarEscalaDoDia, removerEscalaDoDia } from '@/modulos/escala/escala.acoes';
import {
  ROTULO_DO_TURNO,
  TURNOS_DA_ESCALA,
  type TurnoDaEscala,
} from '@/modulos/escala/escala.regras';
import type { PainelDaEscala } from '@/modulos/escala/escala.servico';
import { formatarPlaca } from '@/utilitarios/placa';

/**
 * Escala do dia (T-Escala · US014 · RF013).
 *
 * Uma tela por dia, com o formulário em cima e a lista embaixo. O administrador
 * monta a escala olhando quem já está escalado — por isso a lista fica visível
 * enquanto ele preenche, e não numa aba separada.
 *
 * As rotas são múltiplas porque o requisito é explícito quanto ao plural: um
 * motorista costuma fazer duas ou três rotas no mesmo turno.
 */
export function PainelDeEscala({ painel }: { painel: PainelDaEscala }) {
  const router = useRouter();
  const [salvando, iniciarSalvamento] = useTransition();
  const [removendo, iniciarRemocao] = useTransition();

  const [motoristaId, setMotoristaId] = useState('');
  const [veiculoId, setVeiculoId] = useState('');
  const [turno, setTurno] = useState<TurnoDaEscala>('INTEGRAL');
  const [rotaIds, setRotaIds] = useState<string[]>([]);

  const [erro, setErro] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [paraRemover, setParaRemover] = useState<string | null>(null);

  const alvo = painel.escalas.find((escala) => escala.id === paraRemover);

  function alternarRota(id: string): void {
    setRotaIds((atual) =>
      atual.includes(id) ? atual.filter((outro) => outro !== id) : [...atual, id],
    );
  }

  function salvar(): void {
    setErro(null);
    setErrosDeCampo({});

    iniciarSalvamento(async () => {
      const resultado = await criarEscalaDoDia({
        data: painel.data,
        motoristaId,
        veiculoId,
        turno,
        rotaIds,
      });

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        setErro(resultado.erro.mensagem);
        return;
      }

      setMotoristaId('');
      setVeiculoId('');
      setRotaIds([]);
      router.refresh();
    });
  }

  function remover(id: string): void {
    setParaRemover(null);
    setErro(null);

    iniciarRemocao(async () => {
      const resultado = await removerEscalaDoDia({ id });
      if (!resultado.sucesso) setErro(resultado.erro.mensagem);
      else router.refresh();
    });
  }

  const faltaCadastro = painel.motoristas.length === 0 || painel.veiculos.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {erro ? <MensagemErro mensagem={erro} /> : null}

      {faltaCadastro ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Faltam cadastros para escalar"
          descricao="A escala precisa de pelo menos um motorista ativo e uma van ativa."
        />
      ) : (
        <section className="border-borda flex flex-col gap-4 rounded-[--radius-padrao] border p-4">
          <h2 className="text-texto text-sm font-semibold">Escalar</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="motorista" className="text-texto text-sm font-medium">
                Motorista
              </label>
              <select
                id="motorista"
                value={motoristaId}
                onChange={(evento) => setMotoristaId(evento.target.value)}
                disabled={salvando}
                aria-invalid={Boolean(errosDeCampo.motoristaId)}
                className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
              >
                <option value="">Escolha…</option>
                {painel.motoristas.map((motorista) => (
                  <option key={motorista.id} value={motorista.id}>
                    {motorista.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="veiculo" className="text-texto text-sm font-medium">
                Van
              </label>
              <select
                id="veiculo"
                value={veiculoId}
                onChange={(evento) => setVeiculoId(evento.target.value)}
                disabled={salvando}
                aria-invalid={Boolean(errosDeCampo.veiculoId)}
                className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
              >
                <option value="">Escolha…</option>
                {painel.veiculos.map((veiculo) => (
                  <option key={veiculo.id} value={veiculo.id}>
                    {formatarPlaca(veiculo.placa)} · {veiculo.modelo}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="turno" className="text-texto text-sm font-medium">
                Turno
              </label>
              <select
                id="turno"
                value={turno}
                onChange={(evento) => setTurno(evento.target.value as TurnoDaEscala)}
                disabled={salvando}
                className="border-borda bg-fundo text-texto min-h-[--spacing-toque] rounded-[--radius-padrao] border px-3 text-base"
              >
                {TURNOS_DA_ESCALA.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {ROTULO_DO_TURNO[opcao]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {painel.rotas.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-texto mb-2 text-sm font-medium">
                Rotas do dia <span className="text-texto-suave font-normal">(opcional)</span>
              </legend>

              <div className="flex flex-wrap gap-2">
                {painel.rotas.map((rota) => (
                  <label
                    key={rota.id}
                    className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-[--radius-padrao] border px-3 text-sm ${
                      rotaIds.includes(rota.id)
                        ? 'border-primaria bg-primaria-suave'
                        : 'border-borda'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={rotaIds.includes(rota.id)}
                      onChange={() => alternarRota(rota.id)}
                      disabled={salvando}
                      className="size-4"
                    />
                    <span className="text-texto">
                      {rota.codigo} · {rota.nome}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <Botao
            type="button"
            className="self-start"
            onClick={salvar}
            carregando={salvando}
            disabled={motoristaId === '' || veiculoId === '' || removendo}
          >
            <CalendarPlus aria-hidden className="size-4" />
            Escalar
          </Botao>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-texto text-lg font-semibold">
          Escalados neste dia ({painel.escalas.length})
        </h2>

        {painel.escalas.length === 0 ? (
          <EstadoVazio
            motivo="sem-dados"
            titulo="Ninguém escalado ainda"
            descricao="A escala é opcional: sem ela o motorista escolhe a van na abertura do dia, como sempre."
          />
        ) : (
          <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
            {painel.escalas.map((escala) => (
              <li key={escala.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-texto text-sm font-medium">
                    {escala.motorista.nome} · van {formatarPlaca(escala.veiculo.placa)}
                  </p>
                  <p className="text-texto-suave text-xs">
                    {escala.rotas.length === 0
                      ? 'Sem rota definida'
                      : escala.rotas.map((ligacao) => ligacao.rota.codigo).join(' · ')}
                  </p>
                </div>

                <Etiqueta tom="info">{ROTULO_DO_TURNO[escala.turno as TurnoDaEscala]}</Etiqueta>

                <button
                  type="button"
                  onClick={() => setParaRemover(escala.id)}
                  disabled={removendo || salvando}
                  aria-label={`Remover a escala de ${escala.motorista.nome}`}
                  className="text-texto-suave hover:bg-borda/40 flex size-9 shrink-0 items-center justify-center rounded-[--radius-padrao] disabled:opacity-50"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ModalConfirmacao
        aberto={paraRemover !== null}
        titulo="Remover esta escala?"
        destrutiva
        descricao={
          <>
            {alvo
              ? `${alvo.motorista.nome} deixa de estar escalado para a van ${formatarPlaca(alvo.veiculo.placa)}.`
              : ''}{' '}
            Nenhuma jornada já registrada é afetada — a escala é planejamento, não registro.
          </>
        }
        rotuloConfirmar="Remover"
        processando={removendo}
        aoConfirmar={() => paraRemover && remover(paraRemover)}
        aoCancelar={() => setParaRemover(null)}
      />
    </div>
  );
}
