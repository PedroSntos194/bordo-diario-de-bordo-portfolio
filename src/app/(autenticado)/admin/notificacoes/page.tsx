import type { Metadata } from 'next';
import { AlertTriangle, Bell } from 'lucide-react';
import { BarraFiltros } from '@/componentes/dados/barra-filtros';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Paginacao } from '@/componentes/dados/paginacao';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { BotaoReenviar } from '@/modulos/notificacao/componentes/botao-reenviar';
import { listarFila } from '@/modulos/notificacao/reenvio.servico';
import {
  MAX_TENTATIVAS,
  ROTULO_DO_STATUS,
  podeReenviarManualmente,
  requerAtencao,
  type StatusDaNotificacao,
} from '@/modulos/notificacao/reenvio.regras';
import { formatarDataHora } from '@/utilitarios/data';
import { formatarTelefone } from '@/utilitarios/telefone';

export const metadata: Metadata = { title: 'Notificações' };

const ROTULO_DO_TIPO: Record<string, string> = {
  RESUMO_DIA: 'Resumo do dia',
  PENDENCIA_JORNADA: 'Dia em aberto',
  SEM_REGISTRO: 'Sem registro',
  PENDENCIA_DIA: 'Pendências do dia',
  EXPORTACAO_PRONTA: 'Arquivo pronto',
  FALHA_SISTEMA: 'Falha do sistema',
};

const TOM: Record<StatusDaNotificacao, 'sucesso' | 'atencao' | 'erro' | 'neutro'> = {
  ENVIADA: 'sucesso',
  PENDENTE: 'atencao',
  FALHA: 'erro',
  CANCELADA: 'neutro',
};

/** T-Notificações — fila de envios (US037 · RF027 · RN028). */
export default async function PaginaNotificacoes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const parametros = await searchParams;

  const resultado = await listarFila({
    status: parametros.status,
    pagina: parametros.pagina,
    tamanho: parametros.tamanho,
  });

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Notificações</h1>
        <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  const { dados: notificacoes, paginacao, requeremAtencao, envioAutomatico } = resultado.dados;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Notificações</h1>
        <p className="text-texto-suave text-sm">O que o sistema tentou entregar, e o que falhou.</p>
      </div>

      {/*
        A instalação envia sozinha ou depende do motorista? A resposta muda o
        que "pendente" significa nesta tela, e o administrador não tem como
        saber disso olhando a lista (V-05).
      */}
      <p className="border-borda bg-superficie text-texto-suave rounded-[--radius-padrao] border p-3 text-sm">
        {envioAutomatico
          ? `Envio automático ativo. Falhas são repetidas sozinhas até ${MAX_TENTATIVAS} vezes, com intervalo crescente.`
          : 'Esta instalação usa o link do WhatsApp: quem envia é o aplicativo do motorista. ' +
            '“Pendente” significa que ele ainda não confirmou o envio — o reenvio aqui prepara a ' +
            'mensagem para você mandar.'}
      </p>

      {requeremAtencao > 0 ? (
        <div
          role="alert"
          className="border-erro/30 bg-erro-suave flex items-start gap-3 rounded-[--radius-padrao] border p-3"
        >
          <AlertTriangle aria-hidden className="text-erro mt-0.5 size-5 shrink-0" />
          <p className="text-texto text-sm">
            <strong>
              {requeremAtencao}{' '}
              {requeremAtencao === 1 ? 'notificação requer' : 'notificações requerem'} atenção
            </strong>
            : esgotaram as {MAX_TENTATIVAS} tentativas automáticas e continuam sem sair.
          </p>
        </div>
      ) : null}

      <BarraFiltros
        placeholderBusca=""
        semBusca
        filtros={[
          {
            chave: 'status',
            rotulo: 'Status',
            opcoes: (Object.keys(ROTULO_DO_STATUS) as StatusDaNotificacao[]).map((status) => ({
              valor: status,
              rotulo: ROTULO_DO_STATUS[status],
            })),
          },
        ]}
      />

      {notificacoes.length === 0 ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nenhuma notificação"
          descricao="Os resumos enviados pelos motoristas aparecem aqui."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {notificacoes.map((notificacao) => {
              const status = notificacao.status as StatusDaNotificacao;
              const atencao = requerAtencao(notificacao.status, notificacao.tentativas);

              return (
                <li
                  key={notificacao.id}
                  className={`flex flex-wrap items-start gap-3 rounded-[--radius-padrao] border p-3 ${
                    atencao ? 'border-erro/30 bg-erro-suave' : 'border-borda'
                  }`}
                >
                  <Bell aria-hidden className="text-texto-suave mt-0.5 size-4 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-texto text-sm font-medium">
                        {ROTULO_DO_TIPO[notificacao.tipo] ?? notificacao.tipo}
                      </span>
                      <Etiqueta tom={TOM[status]}>{ROTULO_DO_STATUS[status]}</Etiqueta>
                      {atencao ? <Etiqueta tom="erro">requer atenção</Etiqueta> : null}
                    </div>

                    <p className="text-texto-suave text-xs">
                      {notificacao.destinatario?.nome ?? 'Administração'}
                      {notificacao.destinatarioTelefone
                        ? ` · ${formatarTelefone(notificacao.destinatarioTelefone)}`
                        : ''}
                      {' · '}
                      {notificacao.tentativas}{' '}
                      {notificacao.tentativas === 1 ? 'tentativa' : 'tentativas'}
                      {' · '}
                      {notificacao.enviadaEm
                        ? `enviada em ${formatarDataHora(notificacao.enviadaEm)}`
                        : `criada em ${formatarDataHora(notificacao.criadoEm)}`}
                    </p>

                    {notificacao.ultimoErro ? (
                      <p className="text-erro mt-1 text-xs">{notificacao.ultimoErro}</p>
                    ) : null}
                  </div>

                  {podeReenviarManualmente(notificacao.status) ? (
                    <BotaoReenviar
                      notificacaoId={notificacao.id}
                      descricao={
                        notificacao.destinatario?.nome
                          ? `${(ROTULO_DO_TIPO[notificacao.tipo] ?? notificacao.tipo).toLowerCase()} para ${notificacao.destinatario.nome}`
                          : 'resumo do dia'
                      }
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>

          <Paginacao
            pagina={paginacao.pagina}
            totalPaginas={paginacao.totalPaginas}
            total={paginacao.total}
          />
        </>
      )}
    </div>
  );
}
