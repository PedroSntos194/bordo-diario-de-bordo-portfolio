import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { definirAcao, type ContextoDaAcao } from '@/lib/acao-segura';
import { logger } from '@/lib/logger';
import { armazenarERegistrar } from '@/modulos/arquivo/arquivo.servico';
import {
  administradoresParaNotificar,
  registrarNotificacao,
} from '@/modulos/notificacao/notificacao.repositorio';
import { escolherDestinatarios } from '@/modulos/notificacao/notificacao.regras';
import { CHAVES, obterValor } from '@/modulos/configuracao/configuracao.repositorio';
import { resumoPorMotorista } from '@/modulos/relatorio/relatorio.repositorio';
import { gerarPlanilha } from '@/modulos/exportacao/planilha';
import {
  COLUNAS_DE_JORNADA,
  MIME_XLSX,
  montarIdentificacao,
  type LinhaDeJornada,
} from '@/modulos/exportacao/exportacao.regras';
import { dataOperacional, formatarDataOperacional } from '@/utilitarios/data';

/**
 * Planilha consolidada do dia, gerada sozinha (US033 · RF033 · RN030).
 *
 * "Para ninguém precisar lembrar de fazer isso" é a história inteira: o
 * problema declarado pelo cliente é de adesão, e uma rotina que depende de
 * alguém clicar todo dia às 23h reproduz exatamente o problema que o sistema
 * veio resolver.
 *
 * O caso de uso é o mesmo para os dois gatilhos — o agendador e o botão "gerar
 * agora" do administrador. Só muda quem aparece como autor: `sistema` (nulo) ou
 * a pessoa que clicou.
 */

const esquemaConsolidado = z.object({
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
    .default(() => dataOperacional()),
});

type EntradaConsolidado = z.infer<typeof esquemaConsolidado>;

export interface ConsolidadoGerado {
  arquivoId: string;
  nome: string;
  url: string;
  data: string;
  jornadas: number;
  semRegistros: boolean;
}

/**
 * Núcleo compartilhado pelos dois gatilhos.
 *
 * Recebe `geradoPor` porque é a única diferença real entre a execução agendada
 * e a manual — e porque o histórico precisa distinguir as duas (US034).
 */
async function gerar(
  contexto: ContextoDaAcao,
  dataIso: string,
  geradoPor: string | null,
  autor: string,
): Promise<ConsolidadoGerado> {
  const agora = new Date();
  const jornadas = await resumoPorMotorista(contexto.tx, dataIso);

  // RN017 — o consolidado é feito de jornadas encerradas. As abertas ficam de
  // fora dos totais, como na tela de resumo; incluí-las faria a planilha das
  // 23h divergir do que o administrador viu às 22h.
  const encerradas = jornadas.filter((jornada) => jornada.status === 'ENCERRADA');
  const registros: LinhaDeJornada[] = encerradas.map((jornada) => ({
    ...jornada,
    data: dataIso,
  }));

  const semRegistros = registros.length === 0;

  const identificacao = montarIdentificacao({
    tipo: 'RESUMO_DIA',
    filtros: { data: dataIso },
    totalDeLinhas: registros.length,
    geradoEm: agora,
    geradoPor: autor,
  });

  const conteudo = await gerarPlanilha({
    identificacao,
    aba: { nome: 'Resumo do dia', colunas: COLUNAS_DE_JORNADA, registros },
    // Critério de aceitação: dia sem movimentação gera planilha com aviso, e
    // não ausência de planilha. A diferença importa na auditoria do cliente —
    // "não houve movimento" é uma informação; "o arquivo não existe" é uma
    // dúvida sobre se a rotina rodou.
    avisoQuandoVazio: `Sem registros para ${formatarDataOperacional(dataIso)}.`,
  });

  // Cada execução gera um arquivo novo (RN030): nada é sobrescrito, nem quando
  // o mesmo dia é reprocessado depois de uma correção.
  const nome = `bordo_consolidado_${dataIso}.xlsx`;
  const arquivo = await armazenarERegistrar(contexto.tx, {
    tipo: 'RELATORIO_DIARIO',
    nome,
    mimeType: MIME_XLSX,
    conteudo,
    parametros: { tipo: 'CONSOLIDADO_DIARIO', data: dataIso } as Prisma.InputJsonValue,
    geradoPor,
    geradoEm: agora,
  });

  contexto.auditar({
    acao: 'EXPORTAR',
    entidade: 'arquivo',
    entidadeId: arquivo.id,
    valorNovo: {
      tipo: 'RELATORIO_DIARIO',
      data: dataIso,
      jornadas: registros.length,
      automatico: geradoPor === null,
      nome,
    },
  });

  logger.info('consolidado.gerado', {
    data: dataIso,
    jornadas: registros.length,
    bytes: arquivo.tamanhoBytes,
    automatico: geradoPor === null,
  });

  return {
    arquivoId: arquivo.id,
    nome,
    url: `/api/arquivos/${arquivo.id}/download`,
    data: dataIso,
    jornadas: registros.length,
    semRegistros,
  };
}

/**
 * Execução automática, disparada pelo agendador.
 *
 * `sistema: true` — não há sessão. Ver a nota em `acao-segura.ts`: é o que
 * mantém a rotina dentro do wrapper, com transação e auditoria, em vez de
 * escrevendo no banco por fora.
 *
 * Não existe rota HTTP para esta ação. O botão do administrador usa a variante
 * abaixo, que exige sessão de ADMIN.
 */
export const gerarConsolidadoAgendado = definirAcao<EntradaConsolidado, ConsolidadoGerado>({
  nome: 'consolidado.agendado',
  sistema: true,
  esquema: esquemaConsolidado,
  executar: ({ data }, contexto) => gerar(contexto, data, null, 'Sistema (rotina automática)'),
});

/** Mesma geração, disparada pelo administrador — "gerar agora" (US033, US034). */
export const gerarConsolidadoAgora = definirAcao<EntradaConsolidado, ConsolidadoGerado>({
  nome: 'consolidado.manual',
  perfis: ['ADMIN'],
  esquema: esquemaConsolidado,
  executar: ({ data }, contexto) =>
    gerar(contexto, data, contexto.usuario.id, contexto.usuario.nome),
});

/**
 * Avisa a administração de que a geração falhou (critério de aceitação da
 * US033).
 *
 * Registrada como notificação **interna**, não como WhatsApp: o problema é do
 * sistema, e mandar mensagem por um canal externo justamente quando algo está
 * quebrado é como o alarme de incêndio que depende da energia da casa. A
 * notificação fica no banco e aparece para o administrador (US037).
 */
export const registrarFalhaDoConsolidado = definirAcao<
  { data: string; erro: string },
  { ok: true }
>({
  nome: 'consolidado.falha',
  sistema: true,
  esquema: z.object({ data: z.string(), erro: z.string().max(2000) }),
  executar: async ({ data, erro }, contexto) => {
    const [configurados, administradores] = await Promise.all([
      obterValor<string[]>(contexto.tx, CHAVES.destinatariosResumo, []),
      administradoresParaNotificar(contexto.tx),
    ]);

    const destinatarios = escolherDestinatarios(configurados, administradores);

    await registrarNotificacao(contexto.tx, {
      canal: 'INTERNA',
      tipo: 'FALHA_SISTEMA',
      destinatarioUsuarioId: destinatarios[0]?.usuarioId ?? null,
      destinatarioTelefone: null,
      conteudo:
        `Falha ao gerar a planilha consolidada de ${formatarDataOperacional(data)}. ` +
        `Detalhe: ${erro}`,
      arquivoId: null,
      referenciaTipo: 'consolidado',
      referenciaId: null,
      referenciaChave: data,
      status: 'PENDENTE',
      enviadaEm: null,
      ultimoErro: erro,
    });

    logger.error('consolidado.falhou', { data, detalhe: erro });

    return { ok: true };
  },
});
