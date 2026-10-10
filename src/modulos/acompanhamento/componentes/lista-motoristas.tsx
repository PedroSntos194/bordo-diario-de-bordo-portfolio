'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { ModalConfirmacao } from '@/componentes/feedback/modal-confirmacao';
import { ModalSenhaTemporaria } from '@/modulos/usuario/componentes/modal-senha-temporaria';
import { redefinirSenhaUsuario } from '@/modulos/usuario/usuario.acoes';
import type { SituacaoDoMotorista } from '@/modulos/acompanhamento/acompanhamento.regras';
import { formatarDataHora, formatarDataOperacional } from '@/utilitarios/data';

const ESTILO_ACAO =
  'border-borda text-primaria hover:bg-superficie inline-flex min-h-[--spacing-toque] items-center justify-center rounded-[--radius-padrao] border px-3 text-sm font-medium';

export function AtualizarMotoristas() {
  const router = useRouter();
  const [processando, iniciar] = useTransition();
  return (
    <button
      type="button"
      onClick={() => iniciar(() => router.refresh())}
      disabled={processando}
      className={`${ESTILO_ACAO} gap-2 disabled:opacity-50`}
    >
      <RefreshCw aria-hidden className={`size-4 ${processando ? 'animate-spin' : ''}`} />
      {processando ? 'Atualizando…' : 'Atualizar painel'}
    </button>
  );
}

export function ListaMotoristas({
  motoristas,
  data,
}: {
  motoristas: SituacaoDoMotorista[];
  data: string;
}) {
  const router = useRouter();
  const [processando, iniciar] = useTransition();
  const [redefinir, setRedefinir] = useState<SituacaoDoMotorista | null>(null);
  const [orientar, setOrientar] = useState<SituacaoDoMotorista | null>(null);
  const [senha, setSenha] = useState<{ nome: string; valor: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function gerarSenha() {
    if (!redefinir) return;
    const motorista = redefinir;
    setErro(null);
    iniciar(async () => {
      const resultado = await redefinirSenhaUsuario({ id: motorista.id });
      setRedefinir(null);
      if (!resultado.sucesso) {
        setErro(resultado.erro.mensagem);
        return;
      }
      setSenha({ nome: motorista.nome, valor: resultado.dados.senhaTemporaria });
    });
  }

  return (
    <>
      {erro ? <MensagemErro mensagem={erro} /> : null}
      <ul className="flex flex-col gap-4">
        {motoristas.map((motorista) => (
          <li
            key={motorista.id}
            className="border-borda bg-fundo flex flex-col gap-4 rounded-[--radius-padrao] border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-texto text-lg font-semibold">{motorista.nome}</h2>
              {motorista.precisaAtencao ? (
                <Etiqueta tom="atencao">Precisa de atenção</Etiqueta>
              ) : motorista.adocaoConcluida ? (
                <Etiqueta tom="sucesso">Primeira utilização concluída</Etiqueta>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col items-start gap-2">
                <h3 className="text-texto-suave text-xs font-semibold uppercase">Acesso atual</h3>
                <Etiqueta
                  tom={
                    motorista.acesso === 'PRONTO'
                      ? 'sucesso'
                      : motorista.contaAtiva
                        ? 'atencao'
                        : 'neutro'
                  }
                  className="max-w-full whitespace-normal"
                >
                  {motorista.acessoDescricao}
                </Etiqueta>
                <p className="text-texto-suave text-xs">
                  Último acesso:{' '}
                  {motorista.ultimoLoginEm
                    ? formatarDataHora(motorista.ultimoLoginEm)
                    : 'nenhum login registrado'}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2">
                <h3 className="text-texto-suave text-xs font-semibold uppercase">
                  Operação em {formatarDataOperacional(data)}
                </h3>
                <Etiqueta
                  tom={
                    motorista.operacao === 'DIA_ENCERRADO'
                      ? 'sucesso'
                      : motorista.operacao === 'AGUARDANDO_INICIAR' && motorista.contaAtiva
                        ? 'atencao'
                        : ['DIA_INICIADO', 'CORRIDA_EM_ANDAMENTO'].includes(motorista.operacao)
                          ? 'andamento'
                          : 'neutro'
                  }
                >
                  {motorista.operacaoDescricao}
                </Etiqueta>
                <p className="text-texto-suave text-xs">
                  {motorista.corridasConcluidasNoDia} corrida(s) concluída(s) no dia
                  {motorista.jornadaId && motorista.deFolga
                    ? ' · há registro em dia de folga; confira o planejamento'
                    : motorista.jornadaId && !motorista.escalado
                      ? ' · registro fora da escala'
                      : ''}
                </p>
              </div>
            </div>
            {motorista.jornadaAnteriorAberta ? (
              <p className="bg-atencao-suave text-atencao rounded-[--radius-padrao] p-3 text-sm">
                Jornada anterior aberta em{' '}
                {formatarDataOperacional(motorista.jornadaAnteriorAberta.data)}.{' '}
                <Link
                  href={`/admin/jornadas/${motorista.jornadaAnteriorAberta.id}`}
                  className="font-medium underline"
                >
                  Conferir jornada anterior
                </Link>
              </p>
            ) : null}
            <div className="bg-superficie rounded-[--radius-padrao] p-3 text-sm">
              <p className="text-texto font-medium">Próximo passo</p>
              <p className="text-texto-suave mt-1">{motorista.proximoPasso}</p>
            </div>
            <details className="text-sm">
              <summary className="text-texto min-h-[--spacing-toque] cursor-pointer py-2 font-medium">
                Primeira utilização: {motorista.adocao.filter((etapa) => etapa.concluida).length} de{' '}
                {motorista.adocao.length} etapas
              </summary>
              <ol className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {motorista.adocao.map((etapa) => (
                  <li
                    key={etapa.chave}
                    className="border-borda rounded-[--radius-padrao] border p-3"
                  >
                    <p className="text-texto font-medium">
                      {etapa.concluida ? '✓' : '○'} {etapa.rotulo}
                      <span className="sr-only">
                        : {etapa.concluida ? 'concluída' : 'pendente'}
                      </span>
                    </p>
                    <p className="text-texto-suave mt-1 text-xs">{etapa.evidencia}</p>
                  </li>
                ))}
              </ol>
            </details>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/usuarios/${motorista.id}`} className={ESTILO_ACAO}>
                Ver cadastro
              </Link>
              <Link
                href={
                  motorista.jornadaId
                    ? `/admin/jornadas/${motorista.jornadaId}`
                    : `/admin/jornadas?motoristaId=${motorista.id}&dataInicio=${data}&dataFim=${data}`
                }
                className={ESTILO_ACAO}
              >
                Ver jornada
              </Link>
              <button
                type="button"
                className={ESTILO_ACAO}
                onClick={() => setOrientar(motorista)}
                aria-label={`Orientar ${motorista.nome}`}
              >
                Orientar
              </button>
              {motorista.contaAtiva ? (
                <button
                  type="button"
                  className={ESTILO_ACAO}
                  onClick={() => setRedefinir(motorista)}
                  aria-label={`Gerar nova senha para ${motorista.nome}`}
                >
                  Gerar nova senha
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {redefinir ? (
        <ModalConfirmacao
          aberto
          titulo="Gerar nova senha temporária"
          descricao={
            <>
              A senha atual de <strong>{redefinir.nome}</strong> deixará de funcionar e todas as
              sessões abertas serão encerradas. A nova senha expira em 72 horas e deve ser entregue
              individualmente ao motorista.
            </>
          }
          rotuloConfirmar="Gerar nova senha"
          processando={processando}
          aoConfirmar={gerarSenha}
          aoCancelar={() => setRedefinir(null)}
        />
      ) : null}
      {senha ? (
        <ModalSenhaTemporaria
          aberto
          nomeDoUsuario={senha.nome}
          senha={senha.valor}
          aoFechar={() => {
            setSenha(null);
            router.refresh();
          }}
        />
      ) : null}
      {orientar ? (
        <OrientacaoMotorista motorista={orientar} aoFechar={() => setOrientar(null)} />
      ) : null}
    </>
  );
}

function OrientacaoMotorista({
  motorista,
  aoFechar,
}: {
  motorista: SituacaoDoMotorista;
  aoFechar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [copiado, setCopiado] = useState(false);
  const [erroCopia, setErroCopia] = useState(false);
  const [texto, setTexto] = useState(motorista.orientacao);
  useEffect(() => {
    if (!dialogo.current?.open) dialogo.current?.showModal();
    setTexto(`${motorista.orientacao}\n\n${window.location.origin}${motorista.caminhoAjuda}`);
  }, [motorista.orientacao, motorista.caminhoAjuda]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setErroCopia(false);
    } catch {
      setErroCopia(true);
    }
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-orientacao-motorista"
      onCancel={aoFechar}
      className="bg-fundo text-texto border-borda m-auto w-[min(34rem,calc(100vw-2rem))] rounded-[--radius-padrao] border p-5 backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4">
        <h2 id="titulo-orientacao-motorista" className="text-lg font-semibold">
          Orientar {motorista.nome}
        </h2>
        <p className="text-texto-suave text-sm">
          Revise a mensagem e envie individualmente pelo canal combinado com o motorista.
        </p>
        <label className="sr-only" htmlFor="texto-orientacao-motorista">
          Mensagem para o motorista
        </label>
        <textarea
          id="texto-orientacao-motorista"
          rows={7}
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setCopiado(false);
          }}
          className="border-borda bg-superficie text-texto w-full rounded-[--radius-padrao] border p-3 text-base"
        />
        {erroCopia ? (
          <p role="status" className="text-texto-suave text-sm">
            Selecione e copie o texto acima; o navegador não permitiu a cópia automática.
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={`${ESTILO_ACAO} gap-2`} onClick={copiar}>
            {copiado ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
            <span role="status">{copiado ? 'Copiado' : 'Copiar mensagem'}</span>
          </button>
          <button type="button" className={ESTILO_ACAO} onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}
