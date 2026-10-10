import { z } from 'zod';
import { definirAcao, type ContextoDaAcao } from '@/lib/acao-segura';
import { env } from '@/lib/env';
import { ehErroDaAplicacao } from '@/lib/erros';
import { logger } from '@/lib/logger';
import {
  administradoresParaNotificar,
  registrarNotificacao,
} from '@/modulos/notificacao/notificacao.repositorio';
import { escolherDestinatarios } from '@/modulos/notificacao/notificacao.regras';
import { notificadorWhatsApp } from '@/modulos/notificacao/whatsapp';
import { CHAVES, obterValor } from '@/modulos/configuracao/configuracao.repositorio';
import {
  alertaJaGerado,
  alertasDoDia,
  jornadasEmAbertoAte,
  motoristasAtivosSemRegistro,
  type AlertaEmitido,
} from '@/modulos/pendencia/pendencia.repositorio';
import {
  REFERENCIA_DO_ALERTA,
  houvePendencia,
  montarLinkDasPendencias,
  montarLinkDoAplicativo,
  montarMensagemConsolidada,
  montarMensagemDeJornadaEmAberto,
  montarMensagemDeSemRegistro,
  type JornadaEmAberto,
  type MotoristaSemRegistro,
  type PendenciasDoDia,
} from '@/modulos/pendencia/pendencia.regras';
import { normalizarTelefone } from '@/utilitarios/telefone';
import { dataOperacional } from '@/utilitarios/data';

/**
 * Alerta de pendências (US038 · RF026 · RN012, RN028).
 *
 * A rotina roda em horário configurável (`horario_alerta_pendencia`, padrão
 * 20h) e **antes** do consolidado — a ordem é validada em
 * `configuracao.regras.ts`, porque cobrar um dia que a planilha já fechou é
 * pedir um registro que não vai mais entrar em lugar nenhum.
 *
 * RN028 vale aqui inteira: uma falha de envio não pode derrubar a rotina nem
 * impedir as demais notificações. Cada mensagem é registrada na fila e segue o
 * caminho normal de reenvio (US037).
 */

const esquemaData = z.object({
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
    .default(() => dataOperacional()),
});

type EntradaData = z.infer<typeof esquemaData>;

/** Levantamento das pendências, sem enviar nada. Usado pela tela e pela rotina. */
async function levantar(contexto: ContextoDaAcao, dataIso: string): Promise<PendenciasDoDia> {
  const [abertas, semRegistro] = await Promise.all([
    jornadasEmAbertoAte(contexto.tx, dataIso),
    motoristasAtivosSemRegistro(contexto.tx, dataIso),
  ]);

  const jornadasEmAberto: JornadaEmAberto[] = abertas
    // Uma jornada aberta de motorista já desligado ou afastado continua sendo
    // um dado sujo para o administrador resolver, mas não é dele que se cobra:
    // o critério é explícito quanto a não cobrar quem está inativo.
    .filter((jornada) => jornada.motorista.status === 'ATIVO')
    .map((jornada) => ({
      id: jornada.id,
      data: jornada.data,
      iniciadaEm: jornada.iniciadaEm,
      motorista: {
        id: jornada.motorista.id,
        nome: jornada.motorista.nome,
        telefone: jornada.motorista.telefone,
      },
      veiculo: { placa: jornada.veiculo.placa },
      temCorridaEmAndamento: jornada.corridas.length > 0,
    }));

  const motoristasSemRegistro: MotoristaSemRegistro[] = semRegistro.map((motorista) => ({
    id: motorista.id,
    nome: motorista.nome,
    telefone: motorista.telefone,
  }));

  return { data: dataIso, jornadasEmAberto, motoristasSemRegistro };
}

/**
 * Registra uma notificação, tentando o envio quando o canal permite.
 *
 * O padrão é o mesmo do resumo do dia: no canal `link` (V-05a) o servidor só
 * prepara, e a notificação nasce `PENDENTE` para o administrador despachar da
 * fila; no `cloud` ela sai sozinha. A diferença fica contida aqui.
 *
 * RN028 — qualquer falha vira `ultimoErro` na linha da fila, nunca exceção que
 * interrompa a cobrança dos demais motoristas.
 */
async function notificar(
  contexto: ContextoDaAcao,
  parametros: {
    tipo: 'PENDENCIA_JORNADA' | 'SEM_REGISTRO' | 'PENDENCIA_DIA';
    destinatarioUsuarioId: string | null;
    telefoneBruto: string;
    conteudo: string;
    dataIso: string;
  },
): Promise<'ENVIADA' | 'PENDENTE' | 'FALHA'> {
  const telefone = normalizarTelefone(parametros.telefoneBruto);

  let status: 'ENVIADA' | 'PENDENTE' | 'FALHA' = 'PENDENTE';
  let erro: string | null = null;

  if (!telefone) {
    // Cadastro sem telefone discável: a pendência continua existindo e precisa
    // aparecer na fila, senão ninguém descobre por que aquele motorista nunca é
    // cobrado. É o mesmo defeito do telefone de exemplo do seed.
    status = 'FALHA';
    erro = 'Telefone do destinatário não é discável. Corrija o cadastro.';
  } else {
    try {
      const resultado = await notificadorWhatsApp.enviar({
        telefoneE164: telefone,
        texto: parametros.conteudo,
      });
      status = resultado.situacao === 'ENVIADA' ? 'ENVIADA' : 'PENDENTE';
    } catch (falha) {
      status = 'FALHA';
      erro = ehErroDaAplicacao(falha) ? falha.message : 'Falha inesperada no envio.';
    }
  }

  await registrarNotificacao(contexto.tx, {
    canal: 'WHATSAPP',
    tipo: parametros.tipo,
    destinatarioUsuarioId: parametros.destinatarioUsuarioId,
    destinatarioTelefone: telefone,
    conteudo: parametros.conteudo,
    arquivoId: null,
    referenciaTipo: REFERENCIA_DO_ALERTA,
    referenciaId: null,
    referenciaChave: parametros.dataIso,
    status,
    enviadaEm: status === 'ENVIADA' ? new Date() : null,
    ultimoErro: erro,
  });

  return status;
}

export interface ResultadoDoAlerta {
  data: string;
  jornadasEmAberto: number;
  motoristasSemRegistro: number;
  /** Notificações criadas nesta execução. */
  notificacoes: number;
  /** A rotina já havia cobrado este dia e não repetiu. */
  jaExecutado: boolean;
}

/**
 * Núcleo compartilhado pela execução agendada e pela manual.
 *
 * A guarda de "uma vez por dia" é a primeira coisa, e usa a data operacional
 * como chave (`referencia_chave`). Sem ela, um agendador reiniciado às 20h05
 * cobraria todo mundo de novo — e a segunda cobrança do mesmo dia é exatamente
 * o tipo de ruído que faz o motorista desligar as notificações.
 */
async function cobrar(contexto: ContextoDaAcao, dataIso: string): Promise<ResultadoDoAlerta> {
  const pendencias = await levantar(contexto, dataIso);

  const vazio: ResultadoDoAlerta = {
    data: dataIso,
    jornadasEmAberto: pendencias.jornadasEmAberto.length,
    motoristasSemRegistro: pendencias.motoristasSemRegistro.length,
    notificacoes: 0,
    jaExecutado: false,
  };

  // Dia limpo não gera notificação — e, por não gerar, não deixa marca. Repetir
  // a rotina num dia sem pendência é inofensivo: não há cobrança para duplicar.
  if (!houvePendencia(pendencias)) {
    logger.info('pendencia.alerta.sem_pendencias', { data: dataIso });
    return vazio;
  }

  if (await alertaJaGerado(contexto.tx, dataIso)) {
    logger.info('pendencia.alerta.ja_executado', { data: dataIso });
    return { ...vazio, jaExecutado: true };
  }

  const linkDoAplicativo = montarLinkDoAplicativo(env.APP_URL);
  let notificacoes = 0;

  for (const jornada of pendencias.jornadasEmAberto) {
    await notificar(contexto, {
      tipo: 'PENDENCIA_JORNADA',
      destinatarioUsuarioId: jornada.motorista.id,
      telefoneBruto: jornada.motorista.telefone,
      conteudo: montarMensagemDeJornadaEmAberto(jornada, linkDoAplicativo),
      dataIso,
    });
    notificacoes += 1;
  }

  for (const motorista of pendencias.motoristasSemRegistro) {
    await notificar(contexto, {
      tipo: 'SEM_REGISTRO',
      destinatarioUsuarioId: motorista.id,
      telefoneBruto: motorista.telefone,
      conteudo: montarMensagemDeSemRegistro(motorista, dataIso, linkDoAplicativo),
      dataIso,
    });
    notificacoes += 1;
  }

  // O administrador recebe **uma** mensagem com a lista inteira.
  const [configurados, administradores] = await Promise.all([
    obterValor<string[]>(contexto.tx, CHAVES.destinatariosResumo, []),
    administradoresParaNotificar(contexto.tx),
  ]);

  const consolidada = montarMensagemConsolidada(
    pendencias,
    montarLinkDasPendencias(env.APP_URL, dataIso),
  );

  for (const destino of escolherDestinatarios(configurados, administradores)) {
    await notificar(contexto, {
      tipo: 'PENDENCIA_DIA',
      destinatarioUsuarioId: destino.usuarioId,
      telefoneBruto: destino.telefone,
      conteudo: consolidada,
      dataIso,
    });
    notificacoes += 1;
  }

  contexto.auditar({
    acao: 'CRIAR',
    entidade: 'alerta_pendencia',
    entidadeId: dataIso,
    valorNovo: {
      data: dataIso,
      jornadasEmAberto: pendencias.jornadasEmAberto.length,
      motoristasSemRegistro: pendencias.motoristasSemRegistro.length,
      notificacoes,
    },
  });

  logger.info('pendencia.alerta.emitido', {
    data: dataIso,
    jornadasEmAberto: pendencias.jornadasEmAberto.length,
    motoristasSemRegistro: pendencias.motoristasSemRegistro.length,
    notificacoes,
  });

  return { ...vazio, notificacoes };
}

/**
 * Execução automática, disparada pelo agendador.
 *
 * `sistema: true` — não há sessão. A auditoria fica com `usuarioId` nulo, que é
 * como a trilha representa "sistema" (AD-10 do doc 13).
 */
export const alertarPendencias = definirAcao<EntradaData, ResultadoDoAlerta>({
  nome: 'pendencia.alertar',
  sistema: true,
  esquema: esquemaData,
  executar: ({ data }, contexto) => cobrar(contexto, data),
});

/**
 * Mesma cobrança, disparada pelo administrador na tela de pendências.
 *
 * Existe pelo mesmo motivo do "gerar agora" do consolidado: sem ela, verificar
 * a rotina significa mudar o relógio do servidor ou esperar até as 20h — e o
 * que não é exercitado não é entregue.
 */
export const alertarPendenciasAgora = definirAcao<EntradaData, ResultadoDoAlerta>({
  nome: 'pendencia.alertar-agora',
  perfis: ['ADMIN'],
  esquema: esquemaData,
  executar: ({ data }, contexto) => cobrar(contexto, data),
});

export interface PainelDePendencias {
  data: string;
  jornadasEmAberto: {
    id: string;
    data: Date | string;
    iniciadaEm: Date;
    motorista: { id: string; nome: string };
    placa: string;
    temCorridaEmAndamento: boolean;
  }[];
  motoristasSemRegistro: { id: string; nome: string }[];
  /** Cobranças já emitidas para este dia. */
  alertas: AlertaEmitido[];
}

/**
 * Estado das pendências de um dia, para a tela (critério: "as pendências
 * aparecem no dashboard e na consulta com filtro próprio").
 *
 * O telefone levantado por `levantar` **não** atravessa para a interface: a
 * tela precisa do nome, não do número (RN029).
 */
export const consultarPendencias = definirAcao<EntradaData, PainelDePendencias>({
  nome: 'pendencia.consultar',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaData,
  executar: async ({ data }, contexto) => {
    const [pendencias, alertas] = await Promise.all([
      levantar(contexto, data),
      alertasDoDia(contexto.tx, data),
    ]);

    return {
      data,
      jornadasEmAberto: pendencias.jornadasEmAberto.map((jornada) => ({
        id: jornada.id,
        data: jornada.data,
        iniciadaEm: jornada.iniciadaEm,
        motorista: { id: jornada.motorista.id, nome: jornada.motorista.nome },
        placa: jornada.veiculo.placa,
        temCorridaEmAndamento: jornada.temCorridaEmAndamento,
      })),
      motoristasSemRegistro: pendencias.motoristasSemRegistro.map((motorista) => ({
        id: motorista.id,
        nome: motorista.nome,
      })),
      alertas,
    };
  },
});
