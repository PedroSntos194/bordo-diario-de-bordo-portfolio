'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import { CodigoErro, type ErrosDeCampo } from '@/lib/erros';
import { abrirJornada } from '@/modulos/jornada/jornada.acoes';
import type { VeiculoDisponivel } from '@/modulos/veiculo/veiculo.repositorio';
import { formatarPlaca } from '@/utilitarios/placa';
import { formatarOdometro } from '@/utilitarios/numero';
import { formatarData, formatarHora } from '@/utilitarios/data';

/**
 * Abertura da jornada (T05 · US016 · RF014).
 *
 * A meta é o motorista concluir isto em **três interações**: escolher a van,
 * digitar o odômetro, confirmar. Data e hora não são campos — vêm do relógio.
 *
 * Toda a tela é dimensionada para uso com uma mão só, de pé, na porta da van:
 * botão de largura total, alvos de 44 px e teclado numérico no odômetro.
 */
interface Propriedades {
  veiculos: VeiculoDisponivel[];
  /** Van escalada para hoje, quando ela está disponível (US014). */
  veiculoEscaladoId?: string | null;
  /** Van escalada que **não** está disponível — precisa ser explicada. */
  placaEscaladaIndisponivel?: string | null;
}

export function FormularioAbrirJornada({
  veiculos,
  veiculoEscaladoId = null,
  placaEscaladaIndisponivel = null,
}: Propriedades) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();

  /**
   * A escala vence a lista de um item só: quando o administrador escalou uma
   * van, é ela que vem marcada, mesmo que existam outras livres. É o ganho da
   * US014 — menos um toque para quem está de pé na porta da van.
   */
  const [veiculoId, setVeiculoId] = useState(
    veiculoEscaladoId ?? (veiculos.length === 1 ? (veiculos[0]?.id ?? '') : ''),
  );
  const [odometro, setOdometro] = useState('');
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [divergencia, setDivergencia] = useState<string | null>(null);

  const agora = new Date();
  const selecionado = veiculos.find((veiculo) => veiculo.id === veiculoId);

  function enviar(confirmaDivergencia: boolean): void {
    setErroGeral(null);
    setErrosDeCampo({});

    iniciar(async () => {
      const resultado = await abrirJornada({
        veiculoId,
        odometroInicial: odometro,
        confirmaDivergencia,
      });

      if (!resultado.sucesso) {
        // RN015 — divergência grande não é erro: é uma pergunta.
        if (resultado.erro.codigo === CodigoErro.DIVERGENCIA_ODOMETRO_NAO_CONFIRMADA) {
          setDivergencia(resultado.erro.mensagem);
          return;
        }

        setDivergencia(null);
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos || resultado.erro.codigo === CodigoErro.VEICULO_EM_USO) {
          setErroGeral(resultado.erro.mensagem);
        }
        return;
      }

      router.replace('/app');
      router.refresh();
    });
  }

  const avisoDaVan = (
    <details
      open={Boolean(placaEscaladaIndisponivel) || veiculos.length === 0}
      className="border-atencao/30 bg-atencao-suave text-texto rounded-[--radius-padrao] border p-3 text-sm"
    >
      <summary className="min-h-[--spacing-toque] cursor-pointer py-2 font-medium">
        Sua van não aparece?
      </summary>
      <div className="flex flex-col gap-2">
        {placaEscaladaIndisponivel ? (
          <p>
            A van {formatarPlaca(placaEscaladaIndisponivel)} está escalada para você hoje, mas não
            está disponível.
          </p>
        ) : null}
        <p>
          A van pode estar em um dia aberto, inativa ou em manutenção. Peça à administração para
          conferir.
        </p>
        <p>
          Escolha apenas a placa da van que vai dirigir. Se não estiver na lista, aguarde a
          conferência.
        </p>
      </div>
    </details>
  );

  if (veiculos.length === 0) {
    return (
      <>
        <div className="border-borda flex flex-col gap-2 rounded-[--radius-padrao] border border-dashed p-6 text-center">
          <p className="text-texto font-medium">Nenhuma van disponível agora</p>
          <p className="text-texto-suave text-sm">
            Não há uma van ativa e livre para iniciar o dia.
          </p>
        </div>
        {avisoDaVan}
      </>
    );
  }

  return (
    <>
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          enviar(false);
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        {erroGeral ? <MensagemErro mensagem={erroGeral} /> : null}

        <div className="border-borda bg-superficie flex items-center justify-between rounded-[--radius-padrao] border p-3">
          <div>
            <p className="text-texto-suave text-xs">Data e hora</p>
            <p className="text-texto font-medium">
              {formatarData(agora)} · {formatarHora(agora)}
            </p>
          </div>
          <span className="text-texto-suave text-xs">registrado automaticamente</span>
        </div>

        {avisoDaVan}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-texto mb-2 text-sm font-medium">
            Qual van você vai dirigir hoje?
          </legend>

          {veiculos.map((veiculo) => (
            <label
              key={veiculo.id}
              className={`flex min-h-[--spacing-toque] cursor-pointer items-center gap-3 rounded-[--radius-padrao] border p-3 ${
                veiculoId === veiculo.id ? 'border-primaria bg-primaria-suave' : 'border-borda'
              }`}
            >
              <input
                type="radio"
                name="veiculo"
                value={veiculo.id}
                checked={veiculoId === veiculo.id}
                onChange={() => setVeiculoId(veiculo.id)}
                disabled={enviando}
                className="size-5"
              />
              <span className="min-w-0 flex-1">
                <span className="text-texto flex items-center gap-2 font-mono font-medium">
                  {formatarPlaca(veiculo.placa)}
                  {veiculo.id === veiculoEscaladoId ? (
                    <span className="text-primaria bg-primaria-suave rounded-full px-2 py-0.5 font-sans text-[0.65rem] font-medium">
                      escalada para você
                    </span>
                  ) : null}
                </span>
                <span className="text-texto-suave block truncate text-xs">
                  {veiculo.modelo} · {veiculo.capacidadePassageiros} lugares
                </span>
              </span>
            </label>
          ))}

          {errosDeCampo.veiculoId ? (
            <p role="alert" className="text-erro text-xs font-medium">
              {errosDeCampo.veiculoId}
            </p>
          ) : null}
        </fieldset>

        <CampoTexto
          rotulo="Odômetro do painel"
          value={odometro}
          onChange={(evento) => setOdometro(evento.target.value.replace(/\D/g, '').slice(0, 7))}
          erro={errosDeCampo.odometroInicial}
          disabled={enviando}
          required
          inputMode="numeric"
          className="text-2xl"
          placeholder="000000"
          ajuda="Número total do painel. Exemplo: 125.430 km → digite 125430."
          referencia={
            selecionado
              ? `Último valor registrado: ${formatarOdometro(selecionado.odometroAtual)} km`
              : 'Selecione a van para ver o último valor registrado.'
          }
        />

        <Botao
          type="submit"
          tamanho="grande"
          carregando={enviando}
          rotuloCarregando="Iniciando…"
          disabled={veiculoId === '' || odometro === ''}
        >
          Iniciar meu dia
        </Botao>
      </form>

      <ModalConfirmacao
        aberto={divergencia !== null}
        titulo="Confirmar quilometragem"
        descricao={
          <>{divergencia} Se o valor estiver certo, confirme. Se não, corrija o número do painel.</>
        }
        rotuloConfirmar="Confirmar e iniciar"
        processando={enviando}
        aoConfirmar={() => enviar(true)}
        aoCancelar={() => setDivergencia(null)}
      />
    </>
  );
}
