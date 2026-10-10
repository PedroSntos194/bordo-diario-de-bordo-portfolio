import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { definirAcao, type Resultado } from '@/lib/acao-segura';
import { CodigoErro, ErroDeNegocio, ErroNaoEncontrado } from '@/lib/erros';
import { logger } from '@/lib/logger';
import { prisma, type ClientePrisma } from '@/lib/prisma';
import { armazenarERegistrar } from '@/modulos/arquivo/arquivo.servico';
import { paginaDeCorridas } from '@/modulos/corrida/corrida.repositorio';
import { paginaDeJornadas } from '@/modulos/jornada/jornada.repositorio';
import { registrarNotificacao } from '@/modulos/notificacao/notificacao.repositorio';
import { resumoPorMotorista } from '@/modulos/relatorio/relatorio.repositorio';
import { buscarRotaPorId } from '@/modulos/rota/rota.repositorio';
import { buscarPorId as buscarUsuarioPorId } from '@/modulos/usuario/usuario.repositorio';
import { buscarVeiculoPorId } from '@/modulos/veiculo/veiculo.repositorio';
import {
  buscarTarefaPorId,
  concluirTarefa,
  devolverTarefasAbandonadas,
  reclamarTarefa,
  registrarFalhaDaTarefa,
  tarefasPendentes,
} from '@/modulos/exportacao/exportacao.repositorio';
import {
  COLUNAS_DE_CORRIDA,
  COLUNAS_DE_JORNADA,
  MIME_XLSX,
  TAMANHO_DA_PAGINA,
  comEscopoDoSolicitante,
  mensagemDeExportacaoFalhada,
  mensagemDeExportacaoPronta,
  montarIdentificacao,
  nomeDoArquivo,
  podeTentarDeNovo,
  rotuloDoTipo,
  type LinhaDeJornada,
  type ParDeIdentificacao,
  type TipoDeExportacao,
} from '@/modulos/exportacao/exportacao.regras';
import { gerarPlanilhaEmFluxo } from '@/modulos/exportacao/planilha';
import { esquemaExportar, type EntradaExportar } from '@/modulos/exportacao/exportacao.schema';
import { dataOperacional } from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

/**
 * Geração das exportações em segundo plano (US031 · RF031).
 *
 * ## Por que não é uma ação só
 *
 * A geração leva minutos e não pode acontecer dentro de uma transação — uma
 * transação aberta por dez minutos segura conexão e bloqueios do banco que
 * também atende os motoristas em campo. Por outro lado, gravar o arquivo,
 * registrar, avisar e fechar a tarefa **precisa** ser tudo ou nada: um arquivo
 * registrado com a tarefa ainda pendente seria gerado de novo na passagem
 * seguinte, e o solicitante acharia duas planilhas idênticas na lista.
 *
 * Daí a divisão em três atos, que é a mesma da sincronização (US025):
 *
 *   reclamar (atômico, sem transação) → gerar (lento, fora) → concluir (tudo ou
 *   nada)
 *
 * A regra 3 do projeto continua valendo: cada ato é um `definirAcao`. Só a
 * costura entre eles é uma função comum.
 */

// ------------------------------------------------------------------- leitura

/**
 * Páginas do recorte, lidas sob demanda.
 *
 * O gerador é o ponto inteiro da funcionalidade: a próxima consulta só sai
 * quando a página anterior já virou bytes no disco, então nunca existe mais de
 * `TAMANHO_DA_PAGINA` registros na memória — independentemente de o recorte ter
 * seis mil linhas ou duzentas mil.
 */
async function* paginasDeJornadas(
  cliente: ClientePrisma,
  entrada: Extract<EntradaExportar, { tipo: 'JORNADAS' }>,
): AsyncGenerator<LinhaDeJornada[]> {
  for (let skip = 0; ; skip += TAMANHO_DA_PAGINA) {
    const pagina = await paginaDeJornadas(cliente, {
      ...entrada.filtros,
      skip,
      take: TAMANHO_DA_PAGINA,
    });

    if (pagina.length > 0) yield pagina;
    // Página incompleta é a última: pedir mais uma custaria uma consulta a mais
    // em toda exportação, e todas terminam assim.
    if (pagina.length < TAMANHO_DA_PAGINA) return;
  }
}

async function* paginasDeCorridas(
  cliente: ClientePrisma,
  entrada: Extract<EntradaExportar, { tipo: 'CORRIDAS' }>,
): AsyncGenerator<Awaited<ReturnType<typeof paginaDeCorridas>>> {
  for (let skip = 0; ; skip += TAMANHO_DA_PAGINA) {
    const pagina = await paginaDeCorridas(cliente, {
      ...entrada.filtros,
      skip,
      take: TAMANHO_DA_PAGINA,
    });

    if (pagina.length > 0) yield pagina;
    if (pagina.length < TAMANHO_DA_PAGINA) return;
  }
}

/**
 * Traduz identificadores dos filtros para nomes legíveis (RN030).
 *
 * Mesma tradução da exportação síncrona, repetida aqui porque lá ela recebe o
 * cliente da transação e aqui não há transação nenhuma — a geração acontece
 * justamente fora dela.
 */
async function resolverRotulos(
  cliente: ClientePrisma,
  filtros: Record<string, unknown>,
): Promise<Record<string, string>> {
  const rotulos: Record<string, string> = {};

  if (typeof filtros.motoristaId === 'string') {
    const usuario = await buscarUsuarioPorId(cliente, filtros.motoristaId);
    if (usuario) rotulos.motoristaId = usuario.nome;
  }
  if (typeof filtros.veiculoId === 'string') {
    const veiculo = await buscarVeiculoPorId(cliente, filtros.veiculoId);
    if (veiculo) rotulos.veiculoId = `${formatarPlaca(veiculo.placa)} · ${veiculo.modelo}`;
  }
  if (typeof filtros.rotaId === 'string') {
    const rota = await buscarRotaPorId(cliente, filtros.rotaId);
    if (rota) rotulos.rotaId = `${rota.codigo} · ${rota.nome}`;
  }

  return rotulos;
}

// ------------------------------------------------------------------ reclamar

export interface TarefaReclamada {
  id: string;
  tipo: TipoDeExportacao;
  filtros: Record<string, unknown>;
  linhasPrevistas: number;
  tentativas: number;
  solicitante: { id: string; nome: string; perfil: string };
}

/**
 * Reclama uma tarefa pendente para este processo.
 *
 * Sem transação: a garantia vem do `updateMany` condicional do repositório, que
 * é atômico por si. Uma transação em volta não acrescentaria nada e seguraria
 * conexão enquanto o solicitante é carregado.
 *
 * A conta do solicitante é conferida **aqui**, não na admissão: entre pedir e
 * gerar podem passar minutos, e uma planilha entregue a quem foi desligado no
 * intervalo é dado saindo por uma porta que já devia estar fechada.
 */
export const reclamarExportacao = definirAcao<{ id: string }, TarefaReclamada | null>({
  nome: 'exportacao.reclamar',
  sistema: true,
  semTransacao: true,
  esquema: z.object({ id: z.string().uuid() }),
  executar: async ({ id }, contexto) => {
    if (!(await reclamarTarefa(contexto.tx, id))) return null;

    const tarefa = await buscarTarefaPorId(contexto.tx, id);
    if (!tarefa) throw new ErroNaoEncontrado('Tarefa de exportação não encontrada.');

    if (tarefa.solicitante.status !== 'ATIVO') {
      throw new ErroDeNegocio(
        CodigoErro.CONTA_INATIVA,
        'Quem pediu esta exportação não está mais ativo.',
      );
    }

    return {
      id: tarefa.id,
      tipo: tarefa.tipo,
      filtros: (tarefa.filtros ?? {}) as Record<string, unknown>,
      linhasPrevistas: tarefa.linhasPrevistas,
      tentativas: tarefa.tentativas,
      solicitante: {
        id: tarefa.solicitante.id,
        nome: tarefa.solicitante.nome,
        perfil: tarefa.solicitante.perfil,
      },
    };
  },
});

// --------------------------------------------------------------------- gerar

/**
 * Cada tipo monta o seu fluxo com as suas colunas.
 *
 * A união é aberta ramo a ramo, como na exportação síncrona: é o que permite as
 * três variantes conviverem sem `as`, com os registros de cada uma já casados
 * com as colunas que os descrevem.
 */
function montarEmFluxo(
  entrada: EntradaExportar,
  identificacao: ParDeIdentificacao[],
  tarefa: TarefaReclamada,
): Promise<{ conteudo: Buffer; linhas: number }> {
  if (entrada.tipo === 'JORNADAS') {
    return gerarPlanilhaEmFluxo({
      identificacao,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA },
      paginas: paginasDeJornadas(prisma, entrada),
    });
  }

  if (entrada.tipo === 'CORRIDAS') {
    return gerarPlanilhaEmFluxo({
      identificacao,
      aba: { nome: 'Corridas', colunas: COLUNAS_DE_CORRIDA },
      paginas: paginasDeCorridas(prisma, entrada),
    });
  }

  return gerarPlanilhaEmFluxo({
    identificacao,
    aba: { nome: 'Resumo do dia', colunas: COLUNAS_DE_JORNADA },
    paginas: paginasDoResumo(entrada, tarefa),
  });
}

/**
 * O resumo do dia é uma página só, e isso não é preguiça.
 *
 * Ele agrega um dia por motorista: o teto é o tamanho da equipe, então nunca
 * chega ao volume que manda uma exportação para o segundo plano. Está aqui para
 * a tarefa saber gerar **todos** os tipos — uma variante que o agendador não
 * soubesse processar ficaria presa em `PROCESSANDO` no dia em que os limites
 * mudassem.
 */
async function* paginasDoResumo(
  entrada: Extract<EntradaExportar, { tipo: 'RESUMO_DIA' }>,
  tarefa: TarefaReclamada,
): AsyncGenerator<LinhaDeJornada[]> {
  const filtros = comEscopoDoSolicitante(entrada.filtros, tarefa.solicitante);
  const jornadasDoDia = await resumoPorMotorista(prisma, filtros.data, filtros.motoristaId);

  // Mesmo recorte por perfil da exportação síncrona (RN009): dado alheio não
  // pode chegar à planilha de um motorista, e aqui não há sessão para consultar
  // — o perfil vem do solicitante gravado na tarefa.
  const visiveis = filtros.motoristaId
    ? jornadasDoDia.filter((jornada) => jornada.motorista.id === filtros.motoristaId)
    : jornadasDoDia;

  yield visiveis.map((jornada) => ({ ...jornada, data: entrada.filtros.data }));
}

export interface PlanilhaDaTarefa {
  conteudo: Buffer;
  linhas: number;
  nome: string;
  geradoEm: Date;
}

/**
 * Monta a planilha da tarefa, em fluxo e fora de transação.
 *
 * Os filtros vêm do banco e são revalidados pelo **mesmo** esquema da entrada
 * original. Parece redundante — eles foram validados na admissão —, mas o que
 * entra aqui é uma coluna `Json`, e coluna `Json` é dado não confiável como
 * qualquer outro: uma edição manual no banco, ou um esquema que mudou entre a
 * admissão e a geração, chegariam aqui sem passar por nenhuma porta.
 */
async function gerarDaTarefa(tarefa: TarefaReclamada): Promise<PlanilhaDaTarefa> {
  const analise = esquemaExportar.safeParse({ tipo: tarefa.tipo, filtros: tarefa.filtros });

  if (!analise.success) {
    throw new ErroDeNegocio(
      CodigoErro.DADOS_INVALIDOS,
      'Os filtros gravados nesta tarefa não são mais válidos.',
    );
  }

  const entrada = analise.data;
  entrada.filtros.motoristaId = comEscopoDoSolicitante(
    entrada.filtros,
    tarefa.solicitante,
  ).motoristaId;
  const agora = new Date();

  const identificacao = montarIdentificacao({
    tipo: entrada.tipo,
    filtros: entrada.filtros,
    // A identificação é gravada antes da primeira linha de dados — no modo de
    // fluxo não se volta a uma aba já fechada —, então o número aqui é o
    // contado na admissão. Um registro lançado no período enquanto a tarefa
    // esperava na fila desloca esse total em relação ao que a aba de dados
    // traz; é a razão de a tarefa guardar `linhas_geradas` à parte.
    totalDeLinhas: tarefa.linhasPrevistas,
    geradoEm: agora,
    geradoPor: tarefa.solicitante.nome,
    rotulosDeFiltro: await resolverRotulos(prisma, entrada.filtros),
  });

  const { conteudo, linhas } = await montarEmFluxo(entrada, identificacao, tarefa);

  return {
    conteudo,
    linhas,
    nome: nomeDoArquivo(entrada.tipo, dataOperacional(agora)),
    geradoEm: agora,
  };
}

// ------------------------------------------------------------------ concluir

const esquemaConclusao = z.object({
  tarefaId: z.string().uuid(),
  nome: z.string().min(1).max(240),
  conteudo: z.instanceof(Buffer),
  linhas: z.number().int().nonnegative(),
  geradoEm: z.date(),
});

/**
 * Grava o arquivo, avisa o solicitante e fecha a tarefa — tudo ou nada.
 *
 * O tempo limite é maior que o padrão de cinco segundos porque a gravação do
 * binário acontece dentro da transação (a mesma troca da exportação síncrona,
 * documentada em `arquivo.servico.ts`), e um arquivo grande num disco lento não
 * cabe no padrão. Continua sendo uma janela curta: o que é lento — a geração —
 * já aconteceu do lado de fora.
 */
export const concluirExportacao = definirAcao<z.infer<typeof esquemaConclusao>, { ok: true }>({
  nome: 'exportacao.concluir',
  sistema: true,
  esquema: esquemaConclusao,
  tempoLimiteMs: 60_000,
  executar: async (dados, contexto) => {
    const tarefa = await buscarTarefaPorId(contexto.tx, dados.tarefaId);
    if (!tarefa) throw new ErroNaoEncontrado('Tarefa de exportação não encontrada.');

    const filtros = esquemaExportar.parse({ tipo: tarefa.tipo, filtros: tarefa.filtros }).filtros;

    const arquivo = await armazenarERegistrar(contexto.tx, {
      tipo: 'EXPORTACAO',
      nome: dados.nome,
      mimeType: MIME_XLSX,
      conteudo: dados.conteudo,
      // RN030 — os mesmos parâmetros da exportação síncrona: é o que torna o
      // arquivo reproduzível meses depois.
      parametros: {
        tipo: tarefa.tipo,
        filtros: comEscopoDoSolicitante(filtros, {
          id: tarefa.solicitante.id,
          perfil: tarefa.solicitante.perfil,
        }),
        modo: 'segundo-plano',
      } as Prisma.InputJsonValue,
      // O arquivo é do solicitante, não do sistema: é o nome dele que aparece
      // na listagem, e é a permissão dele que o download vai conferir.
      geradoPor: tarefa.solicitadoPor,
      geradoEm: dados.geradoEm,
    });

    await concluirTarefa(contexto.tx, tarefa.id, {
      arquivoId: arquivo.id,
      linhasGeradas: dados.linhas,
    });

    // Interna, e não WhatsApp: quem pediu uma exportação está dentro do
    // sistema, e o canal externo é para o que o motorista precisa saber estando
    // fora dele. Mesma escolha do aviso de falha do consolidado.
    await registrarNotificacao(contexto.tx, {
      canal: 'INTERNA',
      tipo: 'EXPORTACAO_PRONTA',
      destinatarioUsuarioId: tarefa.solicitadoPor,
      destinatarioTelefone: null,
      conteudo: mensagemDeExportacaoPronta({
        tipo: tarefa.tipo,
        linhas: dados.linhas,
        nome: dados.nome,
      }),
      arquivoId: arquivo.id,
      referenciaTipo: 'exportacao',
      referenciaId: tarefa.id,
      referenciaChave: null,
      status: 'PENDENTE',
      enviadaEm: null,
      ultimoErro: null,
    });

    // A trilha registra a **geração**, que é ato do sistema; o pedido já foi
    // auditado na admissão, com o nome de quem pediu (RF037).
    contexto.auditar({
      acao: 'EXPORTAR',
      entidade: 'exportacao',
      entidadeId: tarefa.id,
      valorNovo: {
        tipo: tarefa.tipo,
        relatorio: rotuloDoTipo(tarefa.tipo),
        linhas: dados.linhas,
        linhasPrevistas: tarefa.linhasPrevistas,
        arquivoId: arquivo.id,
        nome: dados.nome,
      },
    });

    logger.info('exportacao.concluida', {
      tarefaId: tarefa.id,
      linhas: dados.linhas,
      linhasPrevistas: tarefa.linhasPrevistas,
      bytes: arquivo.tamanhoBytes,
    });

    return { ok: true };
  },
});

// -------------------------------------------------------------------- falhar

const esquemaFalha = z.object({
  tarefaId: z.string().uuid(),
  erro: z.string().min(1).max(2000),
});

/**
 * Registra a falha e decide entre nova tentativa e desistência.
 *
 * Desistir **avisa** o solicitante, e é o que fecha o critério: sem isso a tela
 * ficaria dizendo "gerando" para sempre sobre uma planilha que não vem. Uma
 * tentativa intermediária não avisa — a próxima passagem provavelmente resolve,
 * e três mensagens sobre o mesmo pedido treinam quem as recebe a ignorá-las.
 */
export const falharExportacao = definirAcao<z.infer<typeof esquemaFalha>, { desistiu: boolean }>({
  nome: 'exportacao.falhar',
  sistema: true,
  esquema: esquemaFalha,
  executar: async ({ tarefaId, erro }, contexto) => {
    const tarefa = await buscarTarefaPorId(contexto.tx, tarefaId);
    if (!tarefa) throw new ErroNaoEncontrado('Tarefa de exportação não encontrada.');

    const desistiu = !podeTentarDeNovo(tarefa.tentativas);

    await registrarFalhaDaTarefa(contexto.tx, tarefaId, {
      erro,
      status: desistiu ? 'FALHA' : 'PENDENTE',
    });

    if (desistiu) {
      await registrarNotificacao(contexto.tx, {
        canal: 'INTERNA',
        tipo: 'FALHA_SISTEMA',
        destinatarioUsuarioId: tarefa.solicitadoPor,
        destinatarioTelefone: null,
        conteudo: mensagemDeExportacaoFalhada({ tipo: tarefa.tipo, motivo: erro }),
        arquivoId: null,
        referenciaTipo: 'exportacao',
        referenciaId: tarefa.id,
        referenciaChave: null,
        status: 'PENDENTE',
        enviadaEm: null,
        ultimoErro: erro,
      });
    }

    logger.warn('exportacao.falhou', { tarefaId, tentativas: tarefa.tentativas, desistiu, erro });

    return { desistiu };
  },
});

// ------------------------------------------------------------------ passagem

/**
 * Tempo depois do qual uma tarefa em `PROCESSANDO` é dada por abandonada.
 *
 * Vinte minutos é mais do que qualquer geração plausível leva — duzentas mil
 * linhas em páginas de mil são duzentas consultas — e menos do que a paciência
 * de quem está esperando. Abaixo disso, uma geração lenta seria reclamada por
 * um segundo processo e sairia duplicada.
 */
const MINUTOS_ATE_DAR_POR_ABANDONADA = 20;

export const devolverAbandonadas = definirAcao<void, { devolvidas: number }>({
  nome: 'exportacao.devolver-abandonadas',
  sistema: true,
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const corte = new Date(Date.now() - MINUTOS_ATE_DAR_POR_ABANDONADA * 60_000);
    const devolvidas = await devolverTarefasAbandonadas(contexto.tx, corte);

    if (devolvidas > 0) logger.warn('exportacao.abandonadas', { devolvidas });

    return { devolvidas };
  },
});

const esquemaPassagem = z.object({
  /** Teto de tarefas por passagem, para a fila não monopolizar o processo. */
  maximo: z.number().int().positive().max(20).default(5),
});

export const listarPendentes = definirAcao<z.infer<typeof esquemaPassagem>, string[]>({
  nome: 'exportacao.pendentes',
  sistema: true,
  semTransacao: true,
  esquema: esquemaPassagem,
  executar: ({ maximo }, contexto) => tarefasPendentes(contexto.tx, maximo),
});

export interface ResumoDaPassagem {
  reclamadas: number;
  concluidas: number;
  falhadas: number;
  devolvidas: number;
}

function motivoDaFalha(resultado: Resultado<unknown>): string {
  return resultado.sucesso ? 'Falha desconhecida.' : resultado.erro.mensagem;
}

/**
 * Uma passagem da fila de exportações (US031).
 *
 * Não é uma ação: é a **costura** entre as três — reclamar, gerar, concluir —,
 * e não pode ser uma porque a parte lenta precisa acontecer entre elas, fora de
 * qualquer transação.
 *
 * Uma tarefa que falha não derruba as outras da mesma passagem: o `catch` é por
 * tarefa, de propósito. Um recorte com dado corrompido bloquearia a fila inteira
 * para todo mundo se a passagem parasse no primeiro erro.
 */
export async function processarExportacoesPendentes(maximo = 5): Promise<ResumoDaPassagem> {
  const resumo: ResumoDaPassagem = { reclamadas: 0, concluidas: 0, falhadas: 0, devolvidas: 0 };

  const abandonadas = await devolverAbandonadas();
  if (abandonadas.sucesso) resumo.devolvidas = abandonadas.dados.devolvidas;

  const pendentes = await listarPendentes({ maximo });
  if (!pendentes.sucesso) {
    throw new Error(`Falha ao consultar a fila de exportações: ${pendentes.erro.mensagem}`);
  }

  for (const id of pendentes.dados) {
    const reclamada = await reclamarExportacao({ id });

    if (!reclamada.sucesso) {
      // A reclamação falha quando o solicitante não está mais ativo. A tarefa
      // já saiu de `PENDENTE`, então precisa ser encerrada aqui — deixá-la
      // assim a devolveria à fila em vinte minutos, para falhar de novo.
      await falharExportacao({ tarefaId: id, erro: motivoDaFalha(reclamada) });
      resumo.falhadas += 1;
      continue;
    }

    // `null` é outro processo que chegou antes, não erro: seguir em frente é o
    // comportamento certo.
    if (reclamada.dados === null) continue;

    const tarefa = reclamada.dados;
    resumo.reclamadas += 1;

    try {
      const planilha = await gerarDaTarefa(tarefa);

      const conclusao = await concluirExportacao({
        tarefaId: tarefa.id,
        nome: planilha.nome,
        conteudo: planilha.conteudo,
        linhas: planilha.linhas,
        geradoEm: planilha.geradoEm,
      });

      if (!conclusao.sucesso) throw new Error(conclusao.erro.mensagem);

      resumo.concluidas += 1;
    } catch (erro) {
      await falharExportacao({
        tarefaId: tarefa.id,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
      resumo.falhadas += 1;
    }
  }

  return resumo;
}
