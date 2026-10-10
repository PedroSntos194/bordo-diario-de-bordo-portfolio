'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ShieldAlert, Trash2 } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import { CampoTexto } from '@/componentes/formulario/campo-texto';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import type { ErrosDeCampo } from '@/lib/erros';
import { aplicarRetencaoAgora, salvarPrazosDeRetencao } from '@/modulos/retencao/retencao.acoes';
import { resumirExpurgo } from '@/modulos/retencao/retencao.regras';
import type { PreviaDoExpurgo } from '@/modulos/retencao/retencao.servico';
import { formatarData } from '@/utilitarios/data';

/**
 * Prazos de retenção e execução do expurgo (US044 · RNF007 · RN029).
 *
 * A tela existe separada das configurações por decisão tomada na Sprint 9:
 * encurtar um prazo aqui **apaga dado pessoal em definitivo** na execução
 * seguinte, e isso não pode acontecer como efeito colateral de alguém salvar
 * uma lista de horários.
 *
 * Duas escolhas de interface seguem daí. A primeira é mostrar, ao lado de cada
 * prazo, **quantos registros já estão vencidos** — número que muda quando o
 * prazo muda, e que é o que transforma "12 meses" em uma consequência
 * concreta. A segunda é a confirmação em modal com o total escrito por extenso:
 * a RN024 exige confirmação para o irreversível, e não há nada mais
 * irreversível no sistema do que este botão.
 */
interface Propriedades {
  previa: PreviaDoExpurgo;
}

export function PainelDeRetencao({ previa }: Propriedades) {
  const router = useRouter();
  const [salvando, iniciarSalvamento] = useTransition();
  const [expurgando, iniciarExpurgo] = useTransition();

  const [prazos, setPrazos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      previa.politicas.map((politica) => [politica.chave, String(politica.meses)]),
    ),
  );
  const [errosDeCampo, setErrosDeCampo] = useState<ErrosDeCampo>({});
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const alterou = previa.politicas.some(
    (politica) => prazos[politica.chave] !== String(politica.meses),
  );

  const totalVencido =
    previa.politicas.reduce((soma, politica) => soma + politica.vencidos, 0) +
    previa.sessoesVencidas;

  function salvar(): void {
    setErro(null);
    setAviso(null);
    setErrosDeCampo({});

    iniciarSalvamento(async () => {
      const resultado = await salvarPrazosDeRetencao({ valores: prazos });

      if (!resultado.sucesso) {
        setErrosDeCampo(resultado.erro.campos ?? {});
        if (!resultado.erro.campos) setErro(resultado.erro.mensagem);
        return;
      }

      setAviso(
        resultado.dados.alterados.length === 0
          ? 'Nada mudou.'
          : 'Prazos salvos. Os novos valores valem a partir da próxima execução do expurgo.',
      );
      router.refresh();
    });
  }

  function expurgar(): void {
    setConfirmando(false);
    setErro(null);
    setAviso(null);

    iniciarExpurgo(async () => {
      const resultado = await aplicarRetencaoAgora();

      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }

      setAviso(resumirExpurgo(resultado.dados));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {erro ? <MensagemErro mensagem={erro} /> : null}
      {aviso ? (
        <p
          role="status"
          className="border-sucesso/30 bg-sucesso-suave text-texto rounded-[--radius-padrao] border p-3 text-sm"
        >
          {aviso}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-texto text-lg font-semibold">Prazos</h2>

        {previa.politicas.map((politica) => (
          <div
            key={politica.chave}
            className="border-borda flex flex-col gap-3 rounded-[--radius-padrao] border p-4"
          >
            <div>
              <h3 className="text-texto text-sm font-semibold">{politica.rotulo}</h3>
              <p className="text-texto-suave text-sm">{politica.explicacao}</p>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <CampoTexto
                  rotulo="Guardar por"
                  value={prazos[politica.chave] ?? ''}
                  onChange={(evento) =>
                    setPrazos((atual) => ({
                      ...atual,
                      [politica.chave]: evento.target.value.replace(/\D/g, '').slice(0, 3),
                    }))
                  }
                  erro={errosDeCampo[politica.chave]}
                  disabled={salvando || expurgando}
                  inputMode="numeric"
                  referencia={`Entre ${politica.minimoMeses} e ${politica.maximoMeses} meses.`}
                />
              </div>

              <dl className="flex-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-texto-suave">Vence antes de:</dt>
                  <dd className="text-texto font-medium">{formatarData(politica.corte)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-texto-suave">Já vencido hoje:</dt>
                  <dd
                    className={`font-medium ${politica.vencidos > 0 ? 'text-atencao' : 'text-texto'}`}
                  >
                    {politica.vencidos.toLocaleString('pt-BR')}{' '}
                    {politica.vencidos === 1 ? 'registro' : 'registros'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        ))}

        <Botao
          type="button"
          className="self-start"
          onClick={salvar}
          carregando={salvando}
          disabled={!alterou || expurgando}
        >
          Salvar prazos
        </Botao>

        <p className="text-texto-suave text-xs">
          Salvar o prazo não apaga nada agora. A exclusão acontece na execução do expurgo — a
          automática, de domingo de madrugada, ou a manual abaixo.
        </p>
      </section>

      <section className="border-erro/30 bg-erro-suave flex flex-col gap-3 rounded-[--radius-padrao] border p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert aria-hidden className="text-erro mt-0.5 size-5 shrink-0" />
          <div>
            <h2 className="text-texto text-sm font-semibold">Aplicar a retenção agora</h2>
            <p className="text-texto-suave text-sm">
              O expurgo roda sozinho toda semana. Use isto para aplicar na hora — por exemplo,
              depois de encurtar um prazo, ou para comprovar a aplicação da política numa data.
              <strong> Não há como desfazer.</strong>
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {previa.politicas.map((politica) => (
            <div key={politica.chave}>
              <dt className="text-texto-suave text-xs">{politica.rotulo}</dt>
              <dd className="text-texto text-lg font-semibold">
                {politica.vencidos.toLocaleString('pt-BR')}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-texto-suave text-xs">Sessões expiradas</dt>
            <dd className="text-texto text-lg font-semibold">{previa.sessoesVencidas}</dd>
          </div>
        </dl>

        <Botao
          type="button"
          variante="destrutiva"
          className="self-start"
          onClick={() => setConfirmando(true)}
          carregando={expurgando}
          rotuloCarregando="Apagando…"
          disabled={salvando || totalVencido === 0}
        >
          <Trash2 aria-hidden className="size-4" />
          {totalVencido === 0 ? 'Nada vencido para apagar' : 'Apagar o que está vencido'}
        </Botao>
      </section>

      <ModalConfirmacao
        aberto={confirmando}
        titulo="Apagar os dados vencidos?"
        destrutiva
        descricao={
          <>
            Serão apagados <strong>{totalVencido.toLocaleString('pt-BR')} registros</strong> que
            passaram do prazo de retenção. Os totais de km, horários e passageiros{' '}
            <strong>não mudam</strong> — eles não dependem dos pontos de GPS. O registro de quem
            gerou cada planilha permanece na trilha; some apenas o conteúdo. Não há como desfazer.
            {previa.politicas.some((politica) => politica.vencidos > previa.maximoPorExecucao) ? (
              <>
                {' '}
                Por segurança, cada execução apaga no máximo{' '}
                {previa.maximoPorExecucao.toLocaleString('pt-BR')} pontos — o que sobrar sai na
                próxima.
              </>
            ) : null}
          </>
        }
        rotuloConfirmar="Apagar em definitivo"
        processando={expurgando}
        aoConfirmar={expurgar}
        aoCancelar={() => setConfirmando(false)}
      />
    </div>
  );
}
