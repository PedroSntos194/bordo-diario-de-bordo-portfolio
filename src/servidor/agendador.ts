import { PgBoss } from 'pg-boss';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { CHAVES, obterValor } from '@/modulos/configuracao/configuracao.repositorio';
import {
  gerarConsolidadoAgendado,
  registrarFalhaDoConsolidado,
} from '@/modulos/consolidado/consolidado.servico';
import { processarExportacoesPendentes } from '@/modulos/exportacao/tarefa.servico';
import { processarFila } from '@/modulos/notificacao/reenvio.servico';
import { alertarPendencias } from '@/modulos/pendencia/pendencia.servico';
import { expurgar } from '@/modulos/retencao/retencao.servico';
import { resumirExpurgo } from '@/modulos/retencao/retencao.regras';
import { FUSO_OPERACAO, dataOperacional } from '@/utilitarios/data';

/**
 * Agendador de rotinas (US033 · doc 13 — pg-boss).
 *
 * ## Por que é um processo separado, e não parte do `next dev`/`next start`
 *
 * Um agendador precisa de um processo **vivo e único**. O servidor do Next não
 * oferece nem uma coisa nem outra de forma confiável: em desenvolvimento ele
 * reinicia a cada alteração de arquivo, e em produção pode subir com mais de
 * uma instância atrás do proxy — o que faria a planilha do dia ser gerada N
 * vezes, uma por instância.
 *
 * Rodar aqui também evita que o pg-boss fique consultando o PostgreSQL do Neon
 * durante o desenvolvimento, mantendo a instância acordada e consumindo horas
 * de computação sem ninguém pedir nada.
 *
 * Em produção este arquivo é um segundo contêiner ao lado da aplicação, com a
 * mesma imagem e a mesma `DATABASE_URL`:
 *
 * ```bash
 * npm run agendador
 * ```
 *
 * ## Por que pg-boss e não o cron do sistema
 *
 * O cron não guarda histórico, não repete o que falhou e não impede duas
 * máquinas de executarem a mesma tarefa. O pg-boss resolve os três usando o
 * PostgreSQL que já existe (AD-3 do doc 13) — sem Redis, sem serviço novo.
 */

/** Nomes das filas. Mudá-los invalida os agendamentos já gravados. */
const FILA_CONSOLIDADO = 'consolidado-diario';
const FILA_NOTIFICACOES = 'notificacoes-pendentes';
const FILA_ALERTA_PENDENCIA = 'alerta-pendencias';
const FILA_EXPURGO = 'expurgo-retencao';
const FILA_EXPORTACAO = 'exportacoes-em-segundo-plano';

/**
 * Expurgo semanal, domingo às 3h (doc 13 — "expurgo por retenção · semanal").
 *
 * Fixo no código, e não configurável como os horários diários: o prazo é que é
 * parâmetro de negócio (RNF007), a janela de manutenção é decisão de operação.
 * Domingo de madrugada é quando a frota não está rodando — e apagar centenas de
 * milhares de linhas no meio da tarde de uma terça atrapalharia quem registra.
 */
const CRON_DO_EXPURGO = '0 3 * * 0';

interface DadosDoConsolidado {
  /**
   * Data operacional a gerar. Ausente na execução agendada, que sempre fecha
   * **o dia corrente** — é por isso que o horário padrão é 23h e não 00h.
   */
  data?: string;
}

interface DadosDoAlerta {
  /** Ausente na execução agendada, que sempre cobra o dia corrente. */
  data?: string;
}

/**
 * Converte `HH:MM` em expressão cron diária.
 *
 * O horário é configurável em banco (RF040 · `horario_consolidado`) porque o
 * administrador precisa poder mudar o fechamento sem depender de um deploy.
 * Valor malformado cai no padrão em vez de derrubar o agendador: uma
 * configuração ruim não pode significar nenhuma planilha gerada.
 */
export function cronDoHorario(horario: string, padrao = '23:00'): string {
  const valido =
    /^([01]\d|2[0-3]):([0-5]\d)$/.exec(horario) ?? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(padrao);
  if (!valido) return '0 23 * * *';
  return `${Number(valido[2])} ${Number(valido[1])} * * *`;
}

async function processarConsolidado(dados: DadosDoConsolidado): Promise<void> {
  const data = dados.data ?? dataOperacional();

  const resultado = await gerarConsolidadoAgendado({ data });

  if (resultado.sucesso) {
    logger.info('agendador.consolidado.ok', {
      data,
      jornadas: resultado.dados.jornadas,
      semRegistros: resultado.dados.semRegistros,
    });
    return;
  }

  // `definirAcao` devolve falha em vez de lançar. Para o pg-boss enxergar o
  // erro — e portanto repetir a tentativa — é preciso relançar.
  await registrarFalhaDoConsolidado({ data, erro: resultado.erro.mensagem });
  throw new Error(`Falha ao gerar o consolidado de ${data}: ${resultado.erro.mensagem}`);
}

/**
 * Cobrança das pendências do dia (US038 · RF026).
 *
 * Ao contrário do consolidado, uma execução sem pendências **não é falha** nem
 * produz artefato: o resultado normal de um dia em que todo mundo registrou é
 * não mandar mensagem nenhuma. O log distingue os três desfechos para que
 * ninguém procure defeito no silêncio.
 */
async function processarAlertaDePendencias(dados: DadosDoAlerta): Promise<void> {
  const data = dados.data ?? dataOperacional();

  const resultado = await alertarPendencias({ data });

  if (!resultado.sucesso) {
    // Como no consolidado: `definirAcao` devolve falha em vez de lançar, e o
    // pg-boss só repete o que enxerga como erro.
    throw new Error(`Falha ao cobrar as pendências de ${data}: ${resultado.erro.mensagem}`);
  }

  logger.info('agendador.pendencias.ok', {
    data,
    jornadasEmAberto: resultado.dados.jornadasEmAberto,
    motoristasSemRegistro: resultado.dados.motoristasSemRegistro,
    notificacoes: resultado.dados.notificacoes,
    jaExecutado: resultado.dados.jaExecutado,
  });
}

/**
 * Expurgo por retenção (US044 · RNF007).
 *
 * Execução sem nada a apagar é o resultado **normal** numa base nova, e não
 * falha: o log distingue os dois desfechos para ninguém procurar defeito no
 * silêncio — mesma disciplina do alerta de pendências.
 */
async function processarExpurgo(): Promise<void> {
  const resultado = await expurgar();

  if (!resultado.sucesso) {
    throw new Error(`Falha no expurgo por retenção: ${resultado.erro.mensagem}`);
  }

  logger.info('agendador.expurgo.ok', {
    resumo: resumirExpurgo(resultado.dados),
    ...resultado.dados,
  });
}

/**
 * Passagem pela fila de exportações (US031).
 *
 * O pg-boss aqui **não carrega o trabalho**: a fila é a tabela
 * `tarefa_exportacao`, e o que está agendado é só a cadência. A razão está na
 * migração — enfileirar de dentro do processo do Next obrigaria o servidor que
 * atende os motoristas a manter uma conexão de fila aberta, e o `send()`
 * aconteceria fora da transação que audita o pedido.
 *
 * Passagem sem nada na fila é o resultado normal, e não falha. Aqui a distinção
 * entre silêncio e defeito é ainda mais importante do que nas outras rotinas:
 * esta roda a cada minuto, e um log por minuto dizendo "nada a fazer" afogaria
 * os dias em que houve algo.
 */
async function processarExportacoes(): Promise<void> {
  const resumo = await processarExportacoesPendentes();

  if (resumo.reclamadas === 0 && resumo.devolvidas === 0 && resumo.falhadas === 0) return;

  logger.info('agendador.exportacoes.ok', { ...resumo });
}

export async function iniciarAgendador(): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    // O agendador é a única coisa rodando neste processo; duas conexões bastam
    // e mantêm o consumo do Neon baixo.
    max: 2,
    schema: 'pgboss',
  });

  boss.on('error', (erro) => {
    logger.error('agendador.erro', {
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });
  });

  await boss.start();

  await boss.createQueue(FILA_CONSOLIDADO, {
    // Três tentativas com espera crescente — critério de aceitação da US033
    // ("nova tentativa automática"). O intervalo cresce porque a causa mais
    // provável de falha é o banco ou o disco momentaneamente indisponível, e
    // repetir de imediato só multiplica o problema.
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
  });

  await boss.work<DadosDoConsolidado>(FILA_CONSOLIDADO, async ([tarefa]) => {
    if (!tarefa) return;
    await processarConsolidado(tarefa.data ?? {});
  });

  // Fila de notificações — a cada 5 minutos (doc 13).
  //
  // Numa instalação com canal `link` a passagem não faz nada, e isso é
  // correto: só o canal `cloud` permite ao servidor tentar sozinho. O caso de
  // uso registra o motivo no log em vez de deixar parecer defeito.
  await boss.createQueue(FILA_NOTIFICACOES, {
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
  });

  await boss.work(FILA_NOTIFICACOES, async () => {
    const resultado = await processarFila();
    if (!resultado.sucesso) {
      throw new Error(`Falha ao processar a fila de notificações: ${resultado.erro.mensagem}`);
    }
  });

  await boss.schedule(FILA_NOTIFICACOES, '*/5 * * * *', null, { tz: FUSO_OPERACAO });

  // Alerta de pendências — diário, antes do consolidado (US038).
  //
  // A repetição automática é a mesma do consolidado, e é segura: a rotina
  // reconhece pela `referencia_chave` o dia que já cobrou, então uma segunda
  // tentativa depois de falha parcial não manda a cobrança duas vezes.
  await boss.createQueue(FILA_ALERTA_PENDENCIA, {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
  });

  await boss.work<DadosDoAlerta>(FILA_ALERTA_PENDENCIA, async ([tarefa]) => {
    if (!tarefa) return;
    await processarAlertaDePendencias(tarefa.data ?? {});
  });

  // Expurgo por retenção — semanal (RNF007).
  //
  // Duas tentativas bastam: se o banco estiver indisponível de madrugada de
  // domingo, esperar a semana seguinte é aceitável. Dado vencido por sete dias
  // a mais é problema menor do que uma rotina de exclusão insistindo em laço.
  await boss.createQueue(FILA_EXPURGO, { retryLimit: 2, retryDelay: 300, retryBackoff: true });

  await boss.work(FILA_EXPURGO, async () => {
    await processarExpurgo();
  });

  await boss.schedule(FILA_EXPURGO, CRON_DO_EXPURGO, null, { tz: FUSO_OPERACAO });

  // Exportações em segundo plano — a cada minuto (US031).
  //
  // Sem repetição automática, e é de propósito: a nova tentativa é decisão do
  // caso de uso, que conta as tentativas na própria tarefa e avisa o
  // solicitante ao desistir. Repetir aqui **também** faria a mesma falha ser
  // contada duas vezes e a desistência chegar na metade do prazo.
  await boss.createQueue(FILA_EXPORTACAO, { retryLimit: 0 });

  await boss.work(FILA_EXPORTACAO, async () => {
    await processarExportacoes();
  });

  await boss.schedule(FILA_EXPORTACAO, '* * * * *', null, { tz: FUSO_OPERACAO });

  const horarioConfigurado = await obterValor(prisma, CHAVES.horarioConsolidado, '23:00');
  const cron = cronDoHorario(horarioConfigurado);

  const horarioDoAlerta = await obterValor(prisma, CHAVES.horarioAlertaPendencia, '20:00');
  const cronDoAlerta = cronDoHorario(horarioDoAlerta, '20:00');

  await boss.schedule(FILA_ALERTA_PENDENCIA, cronDoAlerta, null, { tz: FUSO_OPERACAO });

  // O fuso é o da operação, não o do servidor: "23h" para a empresa é 23h em
  // São Paulo, mesmo que a máquina rode em UTC.
  await boss.schedule(FILA_CONSOLIDADO, cron, null, { tz: FUSO_OPERACAO });

  // O campo NÃO pode se chamar `horario`: o logger usa essa chave para o
  // carimbo de tempo da própria linha, e o valor da configuração a
  // sobrescreveria — a linha sairia datada de "23:00".
  logger.info('agendador.iniciado', {
    filas: [
      FILA_CONSOLIDADO,
      FILA_NOTIFICACOES,
      FILA_ALERTA_PENDENCIA,
      FILA_EXPURGO,
      FILA_EXPORTACAO,
    ],
    cron,
    cronDoAlerta,
    cronDoExpurgo: CRON_DO_EXPURGO,
    fuso: FUSO_OPERACAO,
    horarioConfigurado,
    horarioDoAlerta,
  });

  return boss;
}

/**
 * Executa o consolidado uma vez, sem agendar.
 *
 * Serve para conferência (`npm run agendador -- --agora`) e para reprocessar um
 * dia específico depois de uma correção — o caso previsto em "reexecução no
 * mesmo dia gera um novo arquivo, sem sobrescrever o anterior".
 */
export async function executarConsolidadoUmaVez(data?: string): Promise<void> {
  await processarConsolidado(data ? { data } : {});
}

/**
 * Executa a cobrança de pendências uma vez, sem agendar
 * (`npm run agendador -- --pendencias`).
 *
 * Mesma razão do `--agora` do consolidado: a Sprint 6 mostrou que rotina sem
 * tela precisa ser **executada** para ser dada como pronta — o defeito do
 * carimbo de tempo no log só apareceu assim.
 */
export async function executarAlertaDePendenciasUmaVez(data?: string): Promise<void> {
  await processarAlertaDePendencias(data ? { data } : {});
}

/**
 * Executa o expurgo uma vez, sem agendar (`npm run agendador -- --expurgo`).
 *
 * Uma rotina que só roda de madrugada de domingo e apaga dado em definitivo é
 * exatamente o tipo de coisa que não pode ser dada como pronta sem ter sido
 * executada — foi a lição do carimbo de tempo do log, na Sprint 6.
 */
export async function executarExpurgoUmaVez(): Promise<void> {
  await processarExpurgo();
}

/**
 * Processa a fila de exportações uma vez, sem agendar
 * (`npm run agendador -- --exportacoes`).
 *
 * A regra da Sprint 6 vale igual: rotina sem tela precisa ser **executada**
 * para ser dada como pronta. Esta ainda tem uma razão extra — é a única que
 * escreve arquivo grande em disco, e o defeito que ela pode ter é justamente o
 * que só aparece com volume.
 */
export async function executarExportacoesUmaVez(): Promise<void> {
  const resumo = await processarExportacoesPendentes();
  logger.info('agendador.exportacoes.ok', { ...resumo });
}
