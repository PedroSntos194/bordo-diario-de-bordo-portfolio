import type { Metadata } from 'next';
import Link from 'next/link';
import { BellRing, CheckCircle2, ClipboardX, UserX } from 'lucide-react';
import { EstadoVazio } from '@/componentes/dados/estado-vazio';
import { SeletorDeDia } from '@/componentes/dados/seletor-dia';
import { MensagemErro } from '@/componentes/feedback/mensagem-erro';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { BotaoCobrarPendencias } from '@/modulos/pendencia/componentes/botao-cobrar-pendencias';
import { consultarPendencias } from '@/modulos/pendencia/pendencia.servico';
import { ROTULO_DO_STATUS, type StatusDaNotificacao } from '@/modulos/notificacao/reenvio.regras';
import { formatarDataHora, formatarDataOperacional, formatarHora } from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

export const metadata: Metadata = { title: 'Pendências' };

/**
 * Pendências do dia (US038 · RF026).
 *
 * A tela existe porque a cobrança automática, sozinha, é invisível: o
 * administrador precisa poder ver **quem** está pendente, **o que** já foi
 * cobrado e cobrar de novo se for o caso. Sem ela, "o sistema avisa" é uma
 * promessa que ninguém consegue conferir — o mesmo problema que a fila de
 * notificações resolveu na Sprint 9.
 *
 * As duas pendências têm naturezas diferentes e por isso aparecem separadas:
 * o dia não encerrado é um registro **incompleto** (existe e não fecha), e o
 * motorista sem registro é um registro **ausente**. Só a primeira aparece na
 * consulta de jornadas — a segunda não tem linha para aparecer.
 */
export default async function PaginaPendencias({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  const resultado = await consultarPendencias({ ...(data ? { data } : {}) });

  if (!resultado.sucesso) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-texto text-2xl font-semibold">Pendências</h1>
        <SeletorDeDia />
        <MensagemErro titulo="Não foi possível carregar" mensagem={resultado.erro.mensagem} />
      </div>
    );
  }

  const { data: dia, jornadasEmAberto, motoristasSemRegistro, alertas } = resultado.dados;
  const semPendencias = jornadasEmAberto.length === 0 && motoristasSemRegistro.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-texto text-2xl font-semibold">Pendências</h1>
        <p className="text-texto-suave text-sm">
          Dias não encerrados e motoristas sem registro em {formatarDataOperacional(dia)}
        </p>
      </div>

      <SeletorDeDia />

      {semPendencias ? (
        <EstadoVazio
          motivo="sem-dados"
          titulo="Nenhuma pendência neste dia"
          descricao="Todos os motoristas ativos registraram e nenhuma jornada ficou aberta."
        />
      ) : (
        <>
          {jornadasEmAberto.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-texto text-lg font-semibold">
                Dias não encerrados ({jornadasEmAberto.length})
              </h2>
              <p className="text-texto-suave text-sm">
                Jornada aberta não entra no resumo nem no consolidado (RN017). Inclui dias
                anteriores que continuam abertos.
              </p>

              <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
                {jornadasEmAberto.map((jornada) => (
                  <li key={jornada.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                    <ClipboardX aria-hidden className="text-atencao size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-texto text-sm font-medium">{jornada.motorista.nome}</p>
                      <p className="text-texto-suave text-xs">
                        {formatarDataOperacional(jornada.data)} · van {formatarPlaca(jornada.placa)}{' '}
                        · aberta desde {formatarHora(jornada.iniciadaEm)}
                      </p>
                    </div>

                    {jornada.temCorridaEmAndamento ? (
                      <Etiqueta tom="andamento">Corrida em andamento</Etiqueta>
                    ) : null}

                    <Link
                      href={`/admin/jornadas/${jornada.id}`}
                      className="text-primaria shrink-0 text-sm font-medium underline"
                    >
                      Abrir
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {motoristasSemRegistro.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-texto text-lg font-semibold">
                Sem registro no dia ({motoristasSemRegistro.length})
              </h2>
              <p className="text-texto-suave text-sm">
                Motoristas ativos sem nenhuma jornada. Quem está de férias ou afastado deve ficar
                com status <strong>Inativo</strong> em Usuários — inativo não é cobrado.
              </p>

              <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
                {motoristasSemRegistro.map((motorista) => (
                  <li key={motorista.id} className="flex items-center gap-3 px-3 py-3">
                    <UserX aria-hidden className="text-atencao size-4 shrink-0" />
                    <span className="text-texto flex-1 text-sm">{motorista.nome}</span>
                    <Link
                      href={`/admin/usuarios/${motorista.id}`}
                      className="text-primaria shrink-0 text-sm font-medium underline"
                    >
                      Ver cadastro
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-texto text-lg font-semibold">Cobranças deste dia</h2>

        {alertas.length === 0 ? (
          <p className="text-texto-suave text-sm">
            Nada foi cobrado ainda em {formatarDataOperacional(dia)}.
          </p>
        ) : (
          <ul className="border-borda divide-borda divide-y rounded-[--radius-padrao] border">
            {alertas.map((alerta) => (
              <li key={alerta.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                {alerta.status === 'ENVIADA' ? (
                  <CheckCircle2 aria-hidden className="text-sucesso size-4 shrink-0" />
                ) : (
                  <BellRing aria-hidden className="text-texto-suave size-4 shrink-0" />
                )}
                <span className="text-texto min-w-0 flex-1">
                  {ROTULO_DO_ALERTA[alerta.tipo] ?? alerta.tipo}
                  {alerta.destinatario ? ` · ${alerta.destinatario.nome}` : ''}
                </span>
                <span className="text-texto-suave text-xs">
                  {formatarDataHora(alerta.criadoEm)}
                </span>
                <Etiqueta tom={TOM_DO_STATUS[alerta.status]}>
                  {ROTULO_DO_STATUS[alerta.status as StatusDaNotificacao]}
                </Etiqueta>
              </li>
            ))}
          </ul>
        )}

        <p className="text-texto-suave text-xs">
          Cobrança pendente é normal na instalação atual: no canal de link quem dispara a mensagem é
          uma pessoa, a partir da{' '}
          <Link href="/admin/notificacoes" className="text-primaria underline">
            fila de notificações
          </Link>
          .
        </p>
      </section>

      <BotaoCobrarPendencias data={dia} semPendencias={semPendencias} />
    </div>
  );
}

const ROTULO_DO_ALERTA: Record<string, string> = {
  PENDENCIA_JORNADA: 'Dia em aberto',
  SEM_REGISTRO: 'Sem registro',
  PENDENCIA_DIA: 'Lista consolidada (administração)',
};

const TOM_DO_STATUS = {
  PENDENTE: 'neutro',
  ENVIADA: 'sucesso',
  FALHA: 'erro',
  CANCELADA: 'neutro',
} as const;
