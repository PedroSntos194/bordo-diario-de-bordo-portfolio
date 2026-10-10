import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { CHAVES, obterValor } from '@/modulos/configuracao/configuracao.repositorio';
import {
  gerarConsolidadoAgendado,
  registrarFalhaDoConsolidado,
} from '@/modulos/consolidado/consolidado.servico';
import { processarExportacoesPendentes } from '@/modulos/exportacao/tarefa.servico';
import { gerarAgendado as gerarFechamentoAgendado } from '@/modulos/fechamento/fechamento.servico';
import { rotuloDoCiclo } from '@/modulos/fechamento/fechamento.regras';
import { valorPadraoDe } from '@/modulos/configuracao/configuracao.regras';
import { processarFila } from '@/modulos/notificacao/reenvio.servico';
import { alertarPendencias } from '@/modulos/pendencia/pendencia.servico';
import { resumirExpurgo } from '@/modulos/retencao/retencao.regras';
import { expurgar } from '@/modulos/retencao/retencao.servico';
import { rotinasDevidas, ROTULO_DA_ROTINA, type Rotina } from '@/servidor/despacho.regras';
import { dataOperacional, diaDaSemanaOperacional, horaNoFusoOperacao } from '@/utilitarios/data';

/**
 * Execução das rotinas agendadas fora de um processo residente (AD-9).
 *
 * É a outra metade de `despacho.regras.ts`: lá se decide **o que** venceu, aqui
 * se executa. A separação é a de sempre — a decisão é pura e testável, a
 * execução toca banco e relógio.
 *
 * Cada rotina é isolada: uma que falha não impede as outras da mesma passagem.
 * Na versão com pg-boss cada fila era independente por construção; aqui a
 * independência precisa ser escrita, senão um expurgo com problema levaria
 * junto a planilha do dia.
 */

export interface ResultadoDaRotina {
  rotina: Rotina;
  ok: boolean;
  detalhe: string;
}

export interface ResumoDoDespacho {
  instante: string;
  hora: number;
  rotinas: ResultadoDaRotina[];
}

async function executarConsolidado(): Promise<string> {
  const data = dataOperacional();
  const resultado = await gerarConsolidadoAgendado({ data });

  if (!resultado.sucesso) {
    // Mesma disciplina do agendador com pg-boss: o aviso de falha é registrado
    // como notificação interna antes de a exceção subir.
    await registrarFalhaDoConsolidado({ data, erro: resultado.erro.mensagem });
    throw new Error(resultado.erro.mensagem);
  }

  return `${data} · ${resultado.dados.jornadas} jornada(s)${
    resultado.dados.semRegistros ? ' · dia sem registros' : ''
  }`;
}

async function executarPendencias(): Promise<string> {
  const data = dataOperacional();
  const resultado = await alertarPendencias({ data });

  if (!resultado.sucesso) throw new Error(resultado.erro.mensagem);

  if (resultado.dados.jaExecutado) return `${data} · já cobrado hoje`;

  return (
    `${data} · ${resultado.dados.jornadasEmAberto} em aberto · ` +
    `${resultado.dados.motoristasSemRegistro} sem registro · ` +
    `${resultado.dados.notificacoes} notificação(ões)`
  );
}

async function executarExpurgo(): Promise<string> {
  const resultado = await expurgar();
  if (!resultado.sucesso) throw new Error(resultado.erro.mensagem);
  return resumirExpurgo(resultado.dados);
}

async function executarNotificacoes(): Promise<string> {
  const resultado = await processarFila();
  if (!resultado.sucesso) throw new Error(resultado.erro.mensagem);
  return `${resultado.dados.tentadas} tentada(s) · ${resultado.dados.enviadas} enviada(s)`;
}

async function executarExportacoes(): Promise<string> {
  const resumo = await processarExportacoesPendentes();
  return (
    `${resumo.reclamadas} reclamada(s) · ${resumo.concluidas} concluída(s) · ` +
    `${resumo.falhadas} falha(s) · ${resumo.devolvidas} devolvida(s)`
  );
}

async function executarFechamento(): Promise<string> {
  const resultado = await gerarFechamentoAgendado({});
  if (!resultado.sucesso) throw new Error(resultado.erro.mensagem);
  if (resultado.dados === null) return 'já gerado neste ciclo';
  return `${rotuloDoCiclo(resultado.dados.ciclo)} · 2 planilhas`;
}

const EXECUTORES: Record<Rotina, () => Promise<string>> = {
  consolidado: executarConsolidado,
  pendencias: executarPendencias,
  expurgo: executarExpurgo,
  notificacoes: executarNotificacoes,
  exportacoes: executarExportacoes,
  fechamento: executarFechamento,
};

/**
 * Uma passagem do despachante.
 *
 * Chamada de hora em hora pelo cron da hospedagem. Passagem em que nada vence
 * é o resultado normal: as duas filas rodam e quase sempre não encontram nada,
 * e isso não é falha.
 */
export async function despacharRotinas(instante: Date = new Date()): Promise<ResumoDoDespacho> {
  const [horarioConsolidado, horarioAlertaPendencia, cicloDiaInicio] = await Promise.all([
    obterValor(prisma, CHAVES.horarioConsolidado, '23:00'),
    obterValor(prisma, CHAVES.horarioAlertaPendencia, '20:00'),
    obterValor(prisma, 'ciclo_dia_inicio', valorPadraoDe('ciclo_dia_inicio') as number),
  ]);

  const { hora } = horaNoFusoOperacao(instante);
  const devidas = rotinasDevidas(
    {
      hora,
      diaDaSemana: diaDaSemanaOperacional(instante),
      diaDoMes: Number(dataOperacional(instante).slice(8, 10)),
    },
    { horarioConsolidado, horarioAlertaPendencia, cicloDiaInicio },
  );

  const rotinas: ResultadoDaRotina[] = [];

  for (const rotina of devidas) {
    try {
      const detalhe = await EXECUTORES[rotina]();
      rotinas.push({ rotina, ok: true, detalhe });
    } catch (erro) {
      const detalhe = erro instanceof Error ? erro.message : String(erro);
      rotinas.push({ rotina, ok: false, detalhe });
      logger.error('despacho.rotina.falhou', { rotina: ROTULO_DA_ROTINA[rotina], detalhe });
    }
  }

  const resumo: ResumoDoDespacho = { instante: instante.toISOString(), hora, rotinas };

  logger.info('despacho.concluido', {
    hora,
    executadas: rotinas.length,
    falhas: rotinas.filter((r) => !r.ok).length,
  });

  return resumo;
}
