import { z } from 'zod';
import { definirAcao } from '@/lib/acao-segura';
import {
  montarPagina,
  paraIntervalo,
  esquemaPaginacao,
  type DadosPaginados,
} from '@/lib/paginacao';
import {
  autoresDaTrilha,
  historicoDoRegistro,
  listarTrilha,
  type RegistroDaTrilha,
} from '@/modulos/auditoria/auditoria.repositorio';
import { ACOES, DIAS_PADRAO, ENTIDADES } from '@/modulos/auditoria/auditoria.regras';
import { dataOperacional, fimDoDia, inicioDoDia, somarDias } from '@/utilitarios/data';

/**
 * Consulta da trilha (US040, US041).
 *
 * Fica em arquivo separado de `auditoria.servico.ts` de propósito: aquele é o
 * ponto único de **escrita**, chamado pelo `definirAcao` em toda mutação. Se os
 * dois convivessem, a leitura acabaria importando o escritor, e um dia alguém
 * chamaria `registrarAuditoria` de dentro de uma consulta.
 */

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const esquemaConsultarTrilha = esquemaPaginacao.extend({
  usuarioId: z.string().uuid().optional(),
  acao: z.enum(ACOES).optional(),
  entidade: z.enum(ENTIDADES).optional(),
  entidadeId: z.string().optional(),
  dataInicio: z.string().regex(DATA, 'Data inválida.').optional(),
  dataFim: z.string().regex(DATA, 'Data inválida.').optional(),
});

export type EntradaConsultarTrilha = z.infer<typeof esquemaConsultarTrilha>;

export interface TrilhaConsultada extends DadosPaginados<RegistroDaTrilha> {
  /** Período efetivamente aplicado, para a tela mostrar o que está vendo. */
  periodo: { dataInicio: string; dataFim: string };
  autores: { id: string; nome: string }[];
}

export const consultar = definirAcao<EntradaConsultarTrilha, TrilhaConsultada>({
  nome: 'auditoria.consultar',
  perfis: ['ADMIN'],
  esquema: esquemaConsultarTrilha,
  executar: async (filtros, contexto) => {
    // Período padrão de 7 dias (US040). Aplicado aqui e devolvido à tela: sem
    // isso o administrador veria uma lista recortada sem saber por quê.
    const hoje = dataOperacional();
    const dataFim = filtros.dataFim ?? hoje;
    const dataInicio = filtros.dataInicio ?? somarDias(dataFim, -(DIAS_PADRAO - 1));

    const { skip, take } = paraIntervalo(filtros);

    const [{ registros, total }, autores] = await Promise.all([
      listarTrilha(contexto.tx, {
        ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
        ...(filtros.acao ? { acao: filtros.acao } : {}),
        ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
        ...(filtros.entidadeId ? { entidadeId: filtros.entidadeId } : {}),
        dataInicio: inicioDoDia(dataInicio),
        dataFim: fimDoDia(dataFim),
        skip,
        take,
      }),
      autoresDaTrilha(contexto.tx),
    ]);

    /**
     * "A própria consulta de logs é auditada" — critério de aceitação da US040.
     *
     * Parece recursivo e não é: consultar não gera consulta. Existe porque quem
     * investiga a trilha também precisa ser investigável; num sistema com dado
     * pessoal (RN029), saber quem leu importa tanto quanto saber quem escreveu.
     *
     * Registra o **recorte**, não o resultado: guardar as linhas devolvidas
     * duplicaria a tabela a cada consulta.
     */
    contexto.auditar({
      acao: 'EXPORTAR',
      entidade: 'log_auditoria',
      valorNovo: {
        consulta: {
          dataInicio,
          dataFim,
          ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
          ...(filtros.acao ? { acao: filtros.acao } : {}),
          ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
        },
        resultados: total,
      },
    });

    return {
      ...montarPagina(registros, total, filtros),
      periodo: { dataInicio, dataFim },
      autores,
    };
  },
});

export const historico = definirAcao<{ entidade: string; entidadeId: string }, RegistroDaTrilha[]>({
  nome: 'auditoria.historico',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: z.object({ entidade: z.enum(ENTIDADES), entidadeId: z.string() }),
  executar: async ({ entidade, entidadeId }, contexto) =>
    historicoDoRegistro(contexto.tx, entidade, entidadeId),
});
