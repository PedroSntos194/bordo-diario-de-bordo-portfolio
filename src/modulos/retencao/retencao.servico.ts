import { z } from 'zod';
import { definirAcao, type ContextoDaAcao } from '@/lib/acao-segura';
import { armazenamento } from '@/lib/armazenamento';
import { ErroDeValidacao, ehErroDaAplicacao, type ErrosDeCampo } from '@/lib/erros';
import { logger } from '@/lib/logger';
import { gravarConfiguracao, obterValor } from '@/modulos/configuracao/configuracao.repositorio';
import {
  arquivosVencidos,
  contarArquivosVencidos,
  contarLocalizacoesVencidas,
  contarSessoesVencidas,
  marcarArquivoExpurgado,
  removerLoteDeLocalizacoes,
  removerSessoesVencidas,
} from '@/modulos/retencao/retencao.repositorio';
import {
  CHAVE_RETENCAO_ARQUIVOS,
  CHAVE_RETENCAO_LOCALIZACAO,
  LOTE_DE_EXCLUSAO,
  MAXIMO_POR_EXECUCAO,
  POLITICAS,
  dataDeCorte,
  politicaDe,
  resumirExpurgo,
  validarPrazo,
  type ResultadoDoExpurgo,
} from '@/modulos/retencao/retencao.regras';

/**
 * Expurgo por retenção (US044 · RNF007 · RN029).
 *
 * ## O que a aplicação apaga, e o que ela deliberadamente não apaga
 *
 * Apaga o que é dela: **pontos de localização** vencidos, **conteúdo de
 * planilhas** vencidas e **sessões** expiradas.
 *
 * **Não** apaga a trilha de auditoria, e isso não é omissão. A RNF007 prevê
 * cinco anos para ela, mas a RN027 diz que a trilha é imutável — e a garantia
 * disso é o papel da aplicação no banco **não ter** `DELETE` sobre
 * `log_auditoria` (a revogação está no provisionamento, doc 17). Dar à
 * aplicação o poder de apagar a auditoria para cumprir um prazo que só vence em
 * 2031 destruiria hoje a proteção que a regra existe para dar. O expurgo da
 * trilha é procedimento operacional com papel privilegiado, documentado no
 * runbook — não código de aplicação.
 *
 * ## Por que sem transação
 *
 * `semTransacao: true`. Apagar centenas de milhares de linhas numa transação
 * única seguraria bloqueios por minutos no mesmo banco que atende os motoristas
 * em campo. O expurgo é idempotente por natureza — o que já saiu não volta a
 * ser encontrado —, então uma interrupção no meio deixa o trabalho pela metade,
 * nunca inconsistente, e a execução seguinte continua de onde parou.
 */

async function prazos(contexto: ContextoDaAcao): Promise<{
  localizacaoMeses: number;
  arquivosMeses: number;
}> {
  const [localizacaoMeses, arquivosMeses] = await Promise.all([
    obterValor(
      contexto.tx,
      CHAVE_RETENCAO_LOCALIZACAO,
      politicaDe(CHAVE_RETENCAO_LOCALIZACAO)?.padraoMeses ?? 12,
    ),
    obterValor(
      contexto.tx,
      CHAVE_RETENCAO_ARQUIVOS,
      politicaDe(CHAVE_RETENCAO_ARQUIVOS)?.padraoMeses ?? 60,
    ),
  ]);

  return { localizacaoMeses: Number(localizacaoMeses), arquivosMeses: Number(arquivosMeses) };
}

// ---------------------------------------------------------------- prévia

export interface PreviaDoExpurgo {
  politicas: {
    chave: string;
    rotulo: string;
    explicacao: string;
    meses: number;
    minimoMeses: number;
    maximoMeses: number;
    /** Tudo anterior a esta data vence. */
    corte: Date;
    /** Quantos registros sairiam se a rotina rodasse agora. */
    vencidos: number;
  }[];
  sessoesVencidas: number;
  maximoPorExecucao: number;
}

/**
 * Quanto sairia se a rotina rodasse agora, sem apagar nada.
 *
 * Existe porque a ação é **irreversível**: mostrar o número antes é a diferença
 * entre um administrador que confirma sabendo o que faz e um que descobre
 * depois. É a mesma razão da prévia da importação (US015).
 */
export const previa = definirAcao<void, PreviaDoExpurgo>({
  nome: 'retencao.previa',
  perfis: ['ADMIN'],
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const agora = new Date();
    const { localizacaoMeses, arquivosMeses } = await prazos(contexto);

    const corteLocalizacao = dataDeCorte(localizacaoMeses, agora);
    const corteArquivos = dataDeCorte(arquivosMeses, agora);

    const [localizacoes, arquivos, sessoes] = await Promise.all([
      contarLocalizacoesVencidas(contexto.tx, corteLocalizacao),
      contarArquivosVencidos(contexto.tx, corteArquivos, agora),
      contarSessoesVencidas(contexto.tx, agora),
    ]);

    const meses: Record<string, number> = {
      [CHAVE_RETENCAO_LOCALIZACAO]: localizacaoMeses,
      [CHAVE_RETENCAO_ARQUIVOS]: arquivosMeses,
    };
    const cortes: Record<string, Date> = {
      [CHAVE_RETENCAO_LOCALIZACAO]: corteLocalizacao,
      [CHAVE_RETENCAO_ARQUIVOS]: corteArquivos,
    };
    const vencidos: Record<string, number> = {
      [CHAVE_RETENCAO_LOCALIZACAO]: localizacoes,
      [CHAVE_RETENCAO_ARQUIVOS]: arquivos,
    };

    return {
      politicas: POLITICAS.map((politica) => ({
        chave: politica.chave,
        rotulo: politica.rotulo,
        explicacao: politica.explicacao,
        meses: meses[politica.chave] ?? politica.padraoMeses,
        minimoMeses: politica.minimoMeses,
        maximoMeses: politica.maximoMeses,
        corte: cortes[politica.chave] ?? dataDeCorte(politica.padraoMeses, agora),
        vencidos: vencidos[politica.chave] ?? 0,
      })),
      sessoesVencidas: sessoes,
      maximoPorExecucao: MAXIMO_POR_EXECUCAO,
    };
  },
});

// ---------------------------------------------------------------- expurgo

async function executar(
  contexto: ContextoDaAcao,
  origem: 'automatico' | 'manual',
): Promise<ResultadoDoExpurgo> {
  const agora = new Date();
  const { localizacaoMeses, arquivosMeses } = await prazos(contexto);

  const corteLocalizacao = dataDeCorte(localizacaoMeses, agora);
  const corteArquivos = dataDeCorte(arquivosMeses, agora);

  // 1 · pontos de localização, em lotes.
  let localizacoesRemovidas = 0;
  let restaram = false;

  for (;;) {
    if (localizacoesRemovidas >= MAXIMO_POR_EXECUCAO) {
      // Confere se o teto interrompeu algo que ainda existe, para o resultado
      // poder dizer a verdade em vez de sugerir que acabou.
      restaram = (await contarLocalizacoesVencidas(contexto.tx, corteLocalizacao)) > 0;
      break;
    }

    const lote = Math.min(LOTE_DE_EXCLUSAO, MAXIMO_POR_EXECUCAO - localizacoesRemovidas);
    const removidos = await removerLoteDeLocalizacoes(contexto.tx, corteLocalizacao, lote);

    if (removidos === 0) break;
    localizacoesRemovidas += removidos;
  }

  // 2 · conteúdo das planilhas vencidas. O registro permanece (RN030).
  const vencidos = await arquivosVencidos(contexto.tx, corteArquivos, agora, 500);
  let arquivosExpurgados = 0;

  for (const arquivo of vencidos) {
    try {
      await armazenamento.remover(arquivo.chaveArmazenamento);
    } catch (erro) {
      // Falha ao remover um binário não pode derrubar o expurgo dos demais nem
      // impedir a limpeza das sessões. Vira log e é tentado de novo na semana
      // seguinte — o registro continua marcado como vencido de qualquer forma.
      logger.error('retencao.arquivo.falha_ao_remover', {
        arquivoId: arquivo.id,
        detalhe: erro instanceof Error ? erro.message : String(erro),
      });
      continue;
    }

    // Carimba o vencimento em quem caiu na política geral e ainda não o tinha.
    if (!arquivo.expiraEm) await marcarArquivoExpurgado(contexto.tx, arquivo.id, agora);
    arquivosExpurgados += 1;
  }

  // 3 · sessões expiradas (RN007).
  const sessoesRemovidas = await removerSessoesVencidas(contexto.tx, agora);

  const resultado: ResultadoDoExpurgo = {
    localizacoesRemovidas,
    arquivosExpurgados,
    sessoesRemovidas,
    restaram,
  };

  // Critério de aceitação: cada execução é registrada com a quantidade de
  // registros afetados. Vale mesmo quando não havia nada a apagar — é assim que
  // se prova depois que a rotina rodou, e não que ela ficou parada.
  contexto.auditar({
    acao: 'EXCLUIR',
    entidade: 'retencao',
    entidadeId: agora.toISOString().slice(0, 10),
    valorNovo: {
      origem,
      localizacaoMeses,
      arquivosMeses,
      corteLocalizacao: corteLocalizacao.toISOString(),
      corteArquivos: corteArquivos.toISOString(),
      ...resultado,
    },
  });

  logger.info('retencao.expurgo.concluido', { origem, ...resultado });

  return resultado;
}

/** Execução automática, semanal, disparada pelo agendador. */
export const expurgar = definirAcao<void, ResultadoDoExpurgo>({
  nome: 'retencao.expurgar',
  sistema: true,
  semTransacao: true,
  executar: (_dados, contexto) => executar(contexto, 'automatico'),
});

/**
 * Mesmo expurgo, disparado pelo administrador.
 *
 * Existe pela razão de sempre — rotina que não pode ser exercitada não é
 * entregue —, e também porque o encarregado de dados pode precisar comprovar
 * que a política foi aplicada numa data específica.
 */
export const expurgarAgora = definirAcao<void, ResultadoDoExpurgo>({
  nome: 'retencao.expurgar-agora',
  perfis: ['ADMIN'],
  semTransacao: true,
  executar: (_dados, contexto) => executar(contexto, 'manual'),
});

// ---------------------------------------------------------------- prazos

const esquemaPrazos = z.object({
  valores: z.record(z.string(), z.union([z.string(), z.number()])),
});

type EntradaPrazos = z.infer<typeof esquemaPrazos>;

/**
 * Altera os prazos de retenção.
 *
 * Fica **fora** da tela de configurações de propósito, e a decisão é da Sprint
 * 9: encurtar um prazo apaga dado pessoal em definitivo na execução seguinte, e
 * isso não pode acontecer como efeito colateral de alguém salvar uma lista de
 * horários. Aqui a consequência está escrita na tela, ao lado do número de
 * registros que a mudança passaria a alcançar.
 */
export const salvarPrazos = definirAcao<EntradaPrazos, { alterados: string[] }>({
  nome: 'retencao.salvar-prazos',
  perfis: ['ADMIN'],
  esquema: esquemaPrazos,
  executar: async ({ valores }, contexto) => {
    // Valida tudo antes de gravar qualquer coisa, acumulando os erros — mesma
    // razão da tela de configurações: dois campos, até duas idas e vindas.
    const normalizados = new Map<string, number>();
    const erros: ErrosDeCampo = {};

    for (const [chave, valor] of Object.entries(valores)) {
      if (!politicaDe(chave)) continue;

      try {
        normalizados.set(chave, validarPrazo(chave, valor));
      } catch (erro) {
        if (!ehErroDaAplicacao(erro)) throw erro;
        Object.assign(erros, erro.campos ?? { [chave]: erro.message });
      }
    }

    if (Object.keys(erros).length > 0) {
      throw new ErroDeValidacao(erros, 'Corrija os campos destacados.');
    }

    const alterados: string[] = [];

    for (const [chave, valor] of normalizados) {
      const anterior = await obterValor<unknown>(contexto.tx, chave, null);
      if (Number(anterior) === valor) continue;

      await gravarConfiguracao(
        contexto.tx,
        chave,
        valor,
        politicaDe(chave)?.explicacao ?? chave,
        contexto.usuario.id,
      );

      contexto.auditar({
        acao: 'ATUALIZAR',
        entidade: 'configuracao',
        entidadeId: chave,
        valorAnterior: { valor: anterior },
        valorNovo: { valor },
      });

      alterados.push(chave);
    }

    return { alterados };
  },
});

export { resumirExpurgo };
