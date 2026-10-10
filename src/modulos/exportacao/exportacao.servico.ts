import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { definirAcao, type ContextoDaAcao } from '@/lib/acao-segura';
import { ehAdministrador, filtroDeMotorista } from '@/lib/autorizacao';
import { CodigoErro, ErroDeNegocio, ErroNaoEncontrado } from '@/lib/erros';
import { consumirLimite, LIMITES } from '@/lib/limite-requisicao';
import { logger } from '@/lib/logger';
import type { ClientePrisma } from '@/lib/prisma';
import type { UsuarioAutenticado } from '@/lib/sessao';
import { armazenarERegistrar } from '@/modulos/arquivo/arquivo.servico';
import { contarCorridas, listarCorridas } from '@/modulos/corrida/corrida.repositorio';
import { contarJornadas, listarJornadas } from '@/modulos/jornada/jornada.repositorio';
import { resumoPorMotorista } from '@/modulos/relatorio/relatorio.repositorio';
import { buscarPorId as buscarUsuarioPorId } from '@/modulos/usuario/usuario.repositorio';
import { buscarVeiculoPorId } from '@/modulos/veiculo/veiculo.repositorio';
import { buscarRotaPorId } from '@/modulos/rota/rota.repositorio';
import { gerarPlanilha } from '@/modulos/exportacao/planilha';
import {
  buscarTarefaPorId,
  contarTarefasNaFila,
  criarTarefa,
  tarefasDoSolicitante,
  type TarefaDaListagem,
} from '@/modulos/exportacao/exportacao.repositorio';
import {
  COLUNAS_DE_CORRIDA,
  COLUNAS_DE_JORNADA,
  LIMITE_LINHAS_EM_SEGUNDO_PLANO,
  LIMITE_LINHAS_SINCRONO,
  MAXIMO_DE_TAREFAS_NA_FILA,
  MIME_XLSX,
  comEscopoDoSolicitante,
  decidirModoDeGeracao,
  montarIdentificacao,
  nomeDoArquivo,
  rotuloDoTipo,
  type Coluna,
  type LinhaDeJornada,
  type ParDeIdentificacao,
  type StatusDaTarefa,
  type TipoDeExportacao,
} from '@/modulos/exportacao/exportacao.regras';
import { esquemaExportar, type EntradaExportar } from '@/modulos/exportacao/exportacao.schema';
import { dataOperacional } from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

/**
 * Exportação em Excel (US032 · RF032 · RN008, RN030).
 *
 * O caso de uso faz, em ordem: consulta com os filtros da tela → recusa vazio →
 * monta a planilha → grava no storage → registra o arquivo → audita. Os quatro
 * últimos passos acontecem **dentro da transação** do `definirAcao`, de modo
 * que um erro na auditoria não deixa um registro de arquivo órfão apontando
 * para um binário que ninguém sabe de onde veio.
 *
 * O binário em si é gravado fora do banco e **não** participa do rollback: se a
 * transação for desfeita, sobra um arquivo sem registro no disco. É a troca
 * consciente — o inverso (registro sem arquivo) daria erro na cara do usuário
 * ao baixar, enquanto um órfão é invisível e removível pela rotina de expurgo.
 */

export interface PlanilhaPronta {
  modo: 'sincrono';
  arquivoId: string;
  nome: string;
  url: string;
  totalDeLinhas: number;
}

export interface ExportacaoAdmitida {
  modo: 'segundo-plano';
  tarefaId: string;
  totalDeLinhas: number;
  /** Frase pronta para a tela: o caso de uso já sabe o porquê da espera. */
  aviso: string;
}

/**
 * Dois desfechos de sucesso, discriminados por `modo` (doc 16 · 201 × 202).
 *
 * A união é o que impede a tela de tratar os dois como iguais: sem ela, um
 * `arquivoId` opcional faria o botão tentar baixar `undefined` no dia em que
 * alguém pedisse o ano inteiro — e o defeito só apareceria com volume.
 */
export type ResultadoDaExportacao = PlanilhaPronta | ExportacaoAdmitida;

/**
 * Traduz identificadores dos filtros para nomes legíveis na aba de
 * identificação. Um `motoristaId` em uuid não diz nada a quem abre a planilha.
 */
async function resolverRotulos(
  contexto: ContextoDaAcao,
  filtros: Record<string, unknown>,
): Promise<Record<string, string>> {
  const rotulos: Record<string, string> = {};

  if (typeof filtros.motoristaId === 'string') {
    const usuario = await buscarUsuarioPorId(contexto.tx, filtros.motoristaId);
    if (usuario) rotulos.motoristaId = usuario.nome;
  }
  if (typeof filtros.veiculoId === 'string') {
    const veiculo = await buscarVeiculoPorId(contexto.tx, filtros.veiculoId);
    if (veiculo) rotulos.veiculoId = `${formatarPlaca(veiculo.placa)} · ${veiculo.modelo}`;
  }
  if (typeof filtros.rotaId === 'string') {
    const rota = await buscarRotaPorId(contexto.tx, filtros.rotaId);
    if (rota) rotulos.rotaId = `${rota.codigo} · ${rota.nome}`;
  }

  return rotulos;
}

/**
 * Recorte já resolvido: quantas linhas tem e como virar planilha.
 *
 * O tipo do registro (`jornada`, `corrida`) fica **preso dentro da closure**.
 * É o que permite as três variantes conviverem numa função só sem `as`: cada
 * ramo monta `gerar` com as suas próprias colunas, já casadas com os seus
 * próprios registros, e para fora todos têm a mesma assinatura.
 */
interface Recorte {
  total: number;
  gerar: (identificacao: ParDeIdentificacao[]) => Promise<Buffer>;
}

function recorteDe<T>(nome: string, colunas: Coluna<T>[], registros: T[], total: number): Recorte {
  return {
    total,
    gerar: (identificacao) => gerarPlanilha({ identificacao, aba: { nome, colunas, registros } }),
  };
}

/**
 * Aplica o escopo do usuário sobre os filtros pedidos (RN008, RN009 · US035).
 *
 * O administrador exporta o que pedir. O motorista exporta **apenas o que é
 * dele**, e o `motoristaId` que vier na requisição é ignorado — parâmetro de
 * cliente nunca decide escopo (doc 17). É o que garante o critério da US035:
 * pedir um período com registros de terceiros devolve só os próprios.
 */
function comEscopoDoUsuario<T extends { motoristaId?: string | undefined }>(
  contexto: ContextoDaAcao,
  filtros: T,
): T {
  return { ...filtros, motoristaId: filtroDeMotorista(contexto.usuario, filtros.motoristaId) };
}

/**
 * Quantas linhas o recorte tem, sem trazer nenhuma.
 *
 * É a primeira coisa que a exportação faz, porque é o número que decide entre
 * gerar na hora, admitir para o segundo plano ou recusar (US031).
 */
async function contarRecorte(cliente: ClientePrisma, entrada: EntradaExportar): Promise<number> {
  if (entrada.tipo === 'JORNADAS') return contarJornadas(cliente, entrada.filtros);
  if (entrada.tipo === 'CORRIDAS') return contarCorridas(cliente, entrada.filtros);

  // O resumo do dia é um dia só, agregado por motorista: o teto natural é o
  // tamanho da equipe. Contar aqui custa a mesma consulta que gerar — e o
  // recorte por motorista é o mesmo aplicado na geração, senão a contagem
  // descreveria a frota inteira para quem só vai receber a própria linha.
  const jornadasDoDia = await resumoPorMotorista(
    cliente,
    entrada.filtros.data,
    entrada.filtros.motoristaId,
  );
  return jornadasDoDia.filter(
    (jornada) =>
      !entrada.filtros.motoristaId || jornada.motorista.id === entrada.filtros.motoristaId,
  ).length;
}

/**
 * Aplica o escopo do solicitante **sobre a entrada inteira**, não só sobre os
 * filtros soltos.
 *
 * Os filtros resultantes são os que vão para a contagem, para a geração e —
 * quando a exportação é admitida para segundo plano — para o banco. É esse
 * congelamento que faz a tarefa descrever o mesmo recorte que foi pedido, e
 * `filtroDeMotorista` é a única coisa que decide alcance: o `motoristaId`
 * recebido do cliente nunca decide (doc 17).
 *
 * A união é aberta ramo a ramo em vez de `as`: uma variante nova não compila
 * até ser tratada aqui, que é justamente onde esquecê-la vazaria dado alheio.
 */
function comEscopoDaEntrada(
  usuario: UsuarioAutenticado,
  entrada: EntradaExportar,
): EntradaExportar {
  if (entrada.tipo === 'JORNADAS') {
    return {
      tipo: 'JORNADAS',
      filtros: {
        ...entrada.filtros,
        motoristaId: filtroDeMotorista(usuario, entrada.filtros.motoristaId),
      },
    };
  }

  if (entrada.tipo === 'CORRIDAS') {
    return {
      tipo: 'CORRIDAS',
      filtros: {
        ...entrada.filtros,
        motoristaId: filtroDeMotorista(usuario, entrada.filtros.motoristaId),
      },
    };
  }

  return {
    tipo: 'RESUMO_DIA',
    filtros: comEscopoDoSolicitante(entrada.filtros, usuario),
  };
}

/** Consulta os registros do recorte pedido, sem paginar. */
async function carregarRecorte(
  contexto: ContextoDaAcao,
  entrada: EntradaExportar,
): Promise<Recorte> {
  // `take` uma unidade acima do teto: assim a consulta que estoura é detectada
  // sem trazer o período inteiro só para descobrir que não vai caber.
  const take = LIMITE_LINHAS_SINCRONO + 1;

  if (entrada.tipo === 'JORNADAS') {
    const { jornadas, total } = await listarJornadas(contexto.tx, {
      ...comEscopoDoUsuario(contexto, entrada.filtros),
      skip: 0,
      take,
    });
    return recorteDe('Jornadas', COLUNAS_DE_JORNADA, jornadas, total);
  }

  if (entrada.tipo === 'CORRIDAS') {
    const { corridas, total } = await listarCorridas(contexto.tx, {
      ...comEscopoDoUsuario(contexto, entrada.filtros),
      skip: 0,
      take,
    });
    return recorteDe('Corridas', COLUNAS_DE_CORRIDA, corridas, total);
  }

  // RESUMO_DIA — o dia inteiro, por motorista. Reaproveita as colunas de
  // jornada porque é exatamente disso que o resumo é feito (RN017); só a data
  // precisa ser acrescentada, já que a consulta do resumo é de um dia só.
  const motoristaId = filtroDeMotorista(contexto.usuario, entrada.filtros.motoristaId);
  const jornadasDoDia = await resumoPorMotorista(contexto.tx, entrada.filtros.data, motoristaId);

  const visiveis = motoristaId
    ? jornadasDoDia.filter((jornada) => jornada.motorista.id === motoristaId)
    : jornadasDoDia;

  const registros: LinhaDeJornada[] = visiveis.map((jornada) => ({
    ...jornada,
    data: entrada.filtros.data,
  }));

  return recorteDe('Resumo do dia', COLUNAS_DE_JORNADA, registros, registros.length);
}

/**
 * Admite a exportação como tarefa em vez de gerá-la na requisição (US031).
 *
 * A linha nasce **dentro** da transação que audita o pedido. É o que impede o
 * pior estado possível — trabalho enfileirado para uma solicitação que o banco
 * diz que nunca existiu —, e é a razão de a fila ser esta tabela e não o
 * pg-boss, cujo `send()` acontece fora da transação. Ver a migração.
 */
async function admitirEmSegundoPlano(
  contexto: ContextoDaAcao,
  entrada: EntradaExportar,
  filtros: Record<string, unknown>,
  total: number,
): Promise<ExportacaoAdmitida> {
  // O limite por hora (RNF004) conta pedidos, não pendências: dez cliques em
  // sequência cabem nele e ocupariam o agendador por meia hora. Este teto é o
  // que impede uma pessoa de tomar a fila de todo mundo.
  const naFila = await contarTarefasNaFila(contexto.tx, contexto.usuario.id);

  if (naFila >= MAXIMO_DE_TAREFAS_NA_FILA) {
    throw new ErroDeNegocio(
      CodigoErro.LIMITE_EXCEDIDO,
      `Você já tem ${naFila} exportações em preparo. Aguarde uma delas ficar pronta para pedir ` +
        'outra.',
    );
  }

  const tarefa = await criarTarefa(contexto.tx, {
    tipo: entrada.tipo,
    filtros: filtros as Prisma.InputJsonValue,
    linhasPrevistas: total,
    solicitadoPor: contexto.usuario.id,
  });

  // Auditada na admissão, e não só na conclusão: quem pediu o quê é o que a
  // trilha precisa registrar (RF037), e o pedido é o ato da pessoa — a geração,
  // que vem depois, é ato do sistema.
  contexto.auditar({
    acao: 'EXPORTAR',
    entidade: 'exportacao',
    entidadeId: tarefa.id,
    valorNovo: {
      tipo: entrada.tipo,
      relatorio: rotuloDoTipo(entrada.tipo),
      filtros,
      linhas: total,
      modo: 'segundo-plano',
    },
  });

  logger.info('exportacao.admitida', { tarefaId: tarefa.id, tipo: entrada.tipo, linhas: total });

  return {
    modo: 'segundo-plano',
    tarefaId: tarefa.id,
    totalDeLinhas: total,
    aviso:
      `A consulta traz ${total.toLocaleString('pt-BR')} registros, acima do limite de ` +
      `${LIMITE_LINHAS_SINCRONO.toLocaleString('pt-BR')} para geração imediata. A planilha está ` +
      'sendo preparada em segundo plano e você será avisado quando ela ficar pronta.',
  };
}

export const exportar = definirAcao<EntradaExportar, ResultadoDaExportacao>({
  nome: 'exportacao.gerar',
  // Os dois perfis exportam (US032 e US035). O que muda é o **alcance**, e ele
  // é imposto por `comEscopoDoUsuario`, não pela ausência de permissão: o
  // motorista recebe sempre um recorte de si mesmo, mesmo que peça outro.
  perfis: ['ADMIN', 'MOTORISTA'],
  esquema: esquemaExportar,
  executar: async (entrada, contexto) => {
    // RNF004 — 10 exportações por usuário por hora (doc 16). Gerar planilha é
    // caro; sem teto, uma tela recarregada em laço derruba o processo.
    consumirLimite(`exportacao:${contexto.usuario.id}`, LIMITES.exportacao);

    const agora = new Date();

    // Os filtros que vão para a aba de identificação são os **efetivos**, não os
    // pedidos: o motorista não digitou o próprio identificador, mas o recorte é
    // dele, e uma planilha que diz "nenhum filtro aplicado" enquanto traz só um
    // motorista descreve errado o próprio conteúdo (RN030).
    const efetiva = comEscopoDaEntrada(contexto.usuario, entrada);

    const filtros: Record<string, unknown> = {
      ...(efetiva.filtros as Record<string, unknown>),
      ...(ehAdministrador(contexto.usuario) ? {} : { motoristaId: contexto.usuario.id }),
    };

    // A contagem vem **antes** da leitura: é ela que decide entre gerar agora,
    // admitir para o segundo plano e recusar. Carregar as linhas primeiro para
    // depois descobrir que não vão caber é justamente o pico de memória que o
    // processamento em segundo plano existe para tirar do processo web.
    const total = await contarRecorte(contexto.tx, efetiva);

    // Critério de aceitação: exportação sem resultados é bloqueada com aviso,
    // não gera arquivo vazio. Um `.xlsx` só com cabeçalho circulando por e-mail
    // é indistinguível de "não houve movimento" e de "o filtro estava errado".
    if (total === 0) {
      throw new ErroDeNegocio(
        CodigoErro.SEM_RESULTADOS_PARA_EXPORTAR,
        'Não há registros para os filtros aplicados. Ajuste o período e tente de novo.',
      );
    }

    const modo = decidirModoDeGeracao(total);

    if (modo === 'recusado') {
      throw new ErroDeNegocio(
        CodigoErro.PERIODO_MUITO_LONGO,
        `A consulta traz ${total.toLocaleString('pt-BR')} registros, acima do limite de ` +
          `${LIMITE_LINHAS_EM_SEGUNDO_PLANO.toLocaleString('pt-BR')} por arquivo. Reduza o ` +
          'período ou filtre por motorista ou veículo.',
      );
    }

    if (modo === 'segundo-plano') {
      return admitirEmSegundoPlano(contexto, efetiva, filtros, total);
    }

    const recorte = await carregarRecorte(contexto, efetiva);

    const identificacao = montarIdentificacao({
      tipo: entrada.tipo,
      filtros,
      totalDeLinhas: total,
      geradoEm: agora,
      geradoPor: contexto.usuario.nome,
      rotulosDeFiltro: await resolverRotulos(contexto, filtros),
    });

    const conteudo = await recorte.gerar(identificacao);

    const nome = nomeDoArquivo(entrada.tipo, dataOperacional(agora));

    const arquivo = await armazenarERegistrar(contexto.tx, {
      tipo: 'EXPORTACAO',
      nome,
      mimeType: MIME_XLSX,
      conteudo,
      // RN030 — os parâmetros são o que torna o arquivo reproduzível depois.
      parametros: { tipo: entrada.tipo, filtros } as Prisma.InputJsonValue,
      geradoPor: contexto.usuario.id,
      geradoEm: agora,
    });

    // Critério de aceitação: a exportação é auditada (quem, o quê, quando).
    contexto.auditar({
      acao: 'EXPORTAR',
      entidade: 'arquivo',
      entidadeId: arquivo.id,
      valorNovo: {
        tipo: entrada.tipo,
        relatorio: rotuloDoTipo(entrada.tipo),
        filtros,
        linhas: total,
        nome,
      },
    });

    logger.info('exportacao.gerada', {
      tipo: entrada.tipo,
      linhas: total,
      bytes: arquivo.tamanhoBytes,
    });

    return {
      modo: 'sincrono',
      arquivoId: arquivo.id,
      nome,
      url: `/api/arquivos/${arquivo.id}/download`,
      totalDeLinhas: total,
    };
  },
});

// ----------------------------------------------------- acompanhamento da fila

export interface SituacaoDaExportacao {
  tarefaId: string;
  tipo: TipoDeExportacao;
  status: StatusDaTarefa;
  linhasPrevistas: number;
  linhasGeradas: number | null;
  /** Preenchidos só quando a planilha ficou pronta. */
  nome: string | null;
  url: string | null;
  erro: string | null;
  criadoEm: Date;
  concluidaEm: Date | null;
}

function comoSituacao(tarefa: TarefaDaListagem): SituacaoDaExportacao {
  return {
    tarefaId: tarefa.id,
    tipo: tarefa.tipo,
    status: tarefa.status,
    linhasPrevistas: tarefa.linhasPrevistas,
    linhasGeradas: tarefa.linhasGeradas,
    nome: tarefa.arquivo?.nomeOriginal ?? null,
    url: tarefa.arquivo ? `/api/arquivos/${tarefa.arquivo.id}/download` : null,
    erro: tarefa.erro,
    criadoEm: tarefa.criadoEm,
    concluidaEm: tarefa.concluidaEm,
  };
}

/**
 * Situação de uma exportação, para a tela perguntar enquanto espera.
 *
 * Sem perfil declarado, e restrita ao dono: a tarefa é do solicitante, e o
 * `tarefaId` chega do cliente. Sem a conferência, um identificador adivinhado
 * revelaria o recorte que outra pessoa pediu — e o recorte diz de quem é o dado.
 * O administrador não é exceção: ele já enxerga a frota inteira pelas telas
 * próprias, e não precisa ler o pedido alheio por aqui.
 */
export const situacaoDaExportacao = definirAcao<{ tarefaId: string }, SituacaoDaExportacao>({
  nome: 'exportacao.situacao',
  semTransacao: true,
  esquema: z.object({ tarefaId: z.string().uuid() }),
  executar: async ({ tarefaId }, contexto) => {
    const tarefa = await buscarTarefaPorId(contexto.tx, tarefaId);

    // Mesma resposta para "não existe" e "não é sua": distinguir as duas
    // confirmaria a existência do identificador a quem não deveria saber.
    if (!tarefa || tarefa.solicitadoPor !== contexto.usuario.id) {
      throw new ErroNaoEncontrado('Exportação não encontrada.');
    }

    return comoSituacao(tarefa);
  },
});

/**
 * As exportações recentes de quem está olhando (US031).
 *
 * Alimenta o aviso de "planilha em preparo" na tela: quem fechou a aba antes de
 * a geração terminar precisa reencontrar o pedido, e o arquivo pronto some no
 * meio da lista geral de arquivos quando há um consolidado por dia.
 */
export const minhasExportacoes = definirAcao<void, SituacaoDaExportacao[]>({
  nome: 'exportacao.minhas',
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const tarefas = await tarefasDoSolicitante(contexto.tx, contexto.usuario.id, 10);
    return tarefas.map(comoSituacao);
  },
});
