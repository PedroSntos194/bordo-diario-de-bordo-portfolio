import { z } from 'zod';
import { definirAcao } from '@/lib/acao-segura';
import { arredondar } from '@/utilitarios/numero';
import { dataOperacional, diasNoPeriodo, somarDias } from '@/utilitarios/data';
import {
  agregarPorDimensao,
  totaisDoPeriodo,
  type Agrupamento,
  type LinhaDoRelatorio,
} from '@/modulos/relatorio/periodo.repositorio';

/**
 * Relatório por período e dimensão (US031 · RF031 · RN008).
 *
 * Só corridas **encerradas** entram (RN017): incluir as em andamento faria o
 * número mudar sozinho enquanto o administrador olha a tela.
 */

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIAS_PADRAO = 30;

export const esquemaRelatorioDoPeriodo = z
  .object({
    dataInicio: z.string().regex(DATA, 'Data inválida.').optional(),
    dataFim: z.string().regex(DATA, 'Data inválida.').optional(),
    agrupamento: z.enum(['motorista', 'veiculo', 'rota']).default('motorista'),
  })
  .superRefine((dados, ctx) => {
    if (!dados.dataInicio || !dados.dataFim) return;

    if (dados.dataFim < dados.dataInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataFim'],
        message: 'A data final não pode ser anterior à inicial.',
      });
      return;
    }

    if (diasNoPeriodo(dados.dataInicio, dados.dataFim) > 366) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataFim'],
        message: 'Selecione um período de no máximo 12 meses.',
      });
    }
  });

export type EntradaRelatorioDoPeriodo = z.infer<typeof esquemaRelatorioDoPeriodo>;

export interface LinhaComMedia extends LinhaDoRelatorio {
  /** Km por dia **com operação**, não por dia do calendário. */
  kmPorDia: number;
  corridasPorDia: number;
}

export interface RelatorioDoPeriodo {
  periodo: { dataInicio: string; dataFim: string; dias: number };
  agrupamento: Agrupamento;
  linhas: LinhaComMedia[];
  totais: {
    corridas: number;
    kmTotal: number;
    duracaoMinutos: number;
    passageiros: number;
    diasComOperacao: number;
    kmPorDia: number;
  };
}

/**
 * A média é sobre **dias com operação**, não sobre os dias do período.
 *
 * Dividir por 30 num mês em que a van rodou 8 dias produziria uma média que não
 * descreve nada: nem o desempenho nos dias trabalhados, nem a ociosidade. Quem
 * quiser a segunda leitura tem a coluna "dias" ao lado.
 */
function comMedias(linha: LinhaDoRelatorio): LinhaComMedia {
  const dias = Math.max(1, linha.diasComOperacao);

  return {
    ...linha,
    kmTotal: arredondar(linha.kmTotal, 2),
    kmPorDia: arredondar(linha.kmTotal / dias, 1),
    corridasPorDia: arredondar(linha.corridas / dias, 1),
  };
}

export const relatorioDoPeriodo = definirAcao<EntradaRelatorioDoPeriodo, RelatorioDoPeriodo>({
  nome: 'relatorio.periodo',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaRelatorioDoPeriodo,
  executar: async (filtros, contexto) => {
    const hoje = dataOperacional();
    const dataFim = filtros.dataFim ?? hoje;
    const dataInicio = filtros.dataInicio ?? somarDias(dataFim, -(DIAS_PADRAO - 1));

    // A coluna `jornada.data` é `date` puro: a comparação usa meia-noite UTC,
    // sem conversão de fuso — o mesmo cuidado do defeito da Sprint 5.
    const inicio = new Date(`${dataInicio}T00:00:00Z`);
    const fim = new Date(`${dataFim}T00:00:00Z`);

    const [linhas, totais] = await Promise.all([
      agregarPorDimensao(contexto.tx, filtros.agrupamento, inicio, fim),
      totaisDoPeriodo(contexto.tx, inicio, fim),
    ]);

    return {
      periodo: { dataInicio, dataFim, dias: diasNoPeriodo(dataInicio, dataFim) },
      agrupamento: filtros.agrupamento,
      linhas: linhas.map(comMedias),
      totais: {
        ...totais,
        kmTotal: arredondar(totais.kmTotal, 2),
        kmPorDia: arredondar(totais.kmTotal / Math.max(1, totais.diasComOperacao), 1),
      },
    };
  },
});
