import { definirAcao, type ContextoDaAcao } from '@/lib/acao-segura';
import { CodigoErro, ErroDeConflito, ErroNaoEncontrado } from '@/lib/erros';
import { logger } from '@/lib/logger';
import {
  JANELA_EDICAO_HORAS_PADRAO,
  encerrarCorrida as calcularEncerramento,
  exigirJornadaAbertaParaCorrida,
  odometroParaProximaCorrida,
  validarCancelamento,
  validarCorrecao,
  validarInicioDeCorrida,
  validarOdometroDeCorrecao,
} from '@/modulos/corrida/corrida.regras';
import {
  buscarCorridaPorId,
  buscarPorClientUuid,
  cancelarCorrida,
  corrigirCorrida,
  corridaEmAndamento,
  encerrarCorrida as gravarEncerramento,
  iniciarCorrida,
  maiorOdometroDaJornada,
  recalcularTotaisDoDiaEncerrado,
  registrarLocalizacao,
  type CorridaDetalhada,
} from '@/modulos/corrida/corrida.repositorio';
import {
  esquemaCancelarCorrida,
  esquemaCorrigirCorrida,
  esquemaEncerrarCorrida,
  esquemaIniciarCorrida,
  type EntradaCancelarCorrida,
  type EntradaCorrigirCorrida,
  type EntradaEncerrarCorrida,
  type EntradaIniciarCorrida,
  type EntradaLocalizacao,
} from '@/modulos/corrida/corrida.schema';
import { CHAVES, obterValor } from '@/modulos/configuracao/configuracao.repositorio';
import { arredondar } from '@/utilitarios/numero';
import { jornadaAbertaParaCorrida } from '@/modulos/jornada/jornada.repositorio';

/** Casos de uso da corrida (US018, US019, US020). */

function ouNulo(valor: string | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

/**
 * Grava a localização sem deixar a falha derrubar a operação (RN022).
 *
 * A corrida é o registro que importa; a coordenada é complemento. Um erro ao
 * gravar o ponto vira log, não exceção — do contrário, uma indisponibilidade
 * qualquer impediria o motorista de trabalhar.
 */
async function registrarLocalizacaoSeHouver(
  contexto: ContextoDaAcao,
  corridaId: string,
  localizacao: EntradaLocalizacao | undefined,
): Promise<void> {
  if (!localizacao) return;

  try {
    await registrarLocalizacao(contexto.tx, corridaId, localizacao);
  } catch (erro) {
    logger.error('localizacao.falha_ao_gravar', {
      corridaId,
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });
  }
}

export const iniciar = definirAcao<EntradaIniciarCorrida, { id: string; jaExistia: boolean }>({
  nome: 'corrida.iniciar',
  esquema: esquemaIniciarCorrida,
  executar: async (dados, contexto) => {
    // Reenvio de um registro criado offline não cria segunda corrida (RN025).
    if (dados.clientUuid) {
      const jaSincronizada = await buscarPorClientUuid(contexto.tx, dados.clientUuid);
      if (jaSincronizada) return { id: jaSincronizada.id, jaExistia: true };
    }

    const jornada = await jornadaAbertaParaCorrida(contexto.tx, contexto.usuario.id);

    exigirJornadaAbertaParaCorrida(jornada !== null);
    const jornadaAberta = jornada!;

    const emAndamento = await corridaEmAndamento(contexto.tx, contexto.usuario.id);

    const rota = dados.rotaId
      ? await contexto.tx.rota.findUnique({
          where: { id: dados.rotaId },
          select: { id: true, status: true },
        })
      : null;

    if (dados.rotaId && !rota) throw new ErroNaoEncontrado('Rota não encontrada.');

    validarInicioDeCorrida({
      temCorridaEmAndamento: emAndamento !== null,
      rotaId: dados.rotaId ?? null,
      origemDescricao: ouNulo(dados.origemDescricao),
      destinoDescricao: ouNulo(dados.destinoDescricao),
      rotaEstaAtiva: rota ? rota.status === 'ATIVA' : null,
    });

    /**
     * Usa a maior leitura conhecida, inclusive a do encerramento anterior de
     * um dia reaberto. A leitura da van permanece registrada na reabertura;
     * usar só as corridas perderia os quilômetros anotados ao fechar o dia.
     */
    const maiorAteAgora = await maiorOdometroDaJornada(contexto.tx, jornadaAberta.id);
    const odometroInicial = odometroParaProximaCorrida(
      jornadaAberta.odometroInicial,
      maiorAteAgora,
      jornadaAberta.veiculo.odometroAtual,
    );

    const corrida = await iniciarCorrida(contexto.tx, {
      jornadaId: jornadaAberta.id,
      rotaId: dados.rotaId ?? null,
      origemDescricao: ouNulo(dados.origemDescricao),
      destinoDescricao: ouNulo(dados.destinoDescricao),
      iniciadaEm: new Date(),
      odometroInicial,
      clientUuid: dados.clientUuid ?? null,
      criadoPor: contexto.usuario.id,
    });

    await registrarLocalizacaoSeHouver(contexto, corrida.id, dados.localizacao);

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'corrida',
      entidadeId: corrida.id,
      valorNovo: {
        rotaId: dados.rotaId ?? null,
        odometroInicial,
        comLocalizacao: Boolean(dados.localizacao),
      },
    });

    return { id: corrida.id, jaExistia: false };
  },
});

export const obter = definirAcao<{ id: string }, CorridaDetalhada>({
  nome: 'corrida.obter',
  semTransacao: true,
  esquema: esquemaCancelarCorrida.pick({ id: true }),
  executar: async ({ id }, contexto) => {
    const corrida = await buscarCorridaPorId(contexto.tx, id);
    if (!corrida) throw new ErroNaoEncontrado('Corrida não encontrada.');

    // RN009 — corrida de outro motorista responde 404, não 403.
    if (
      contexto.usuario.perfil !== 'ADMIN' &&
      corrida.jornada.motoristaId !== contexto.usuario.id
    ) {
      throw new ErroNaoEncontrado('Corrida não encontrada.');
    }

    return corrida;
  },
});

export interface ResultadoDoEncerramento {
  kmPercorrido: number;
  duracaoMinutos: number;
}

export const encerrar = definirAcao<EntradaEncerrarCorrida, ResultadoDoEncerramento>({
  nome: 'corrida.encerrar',
  esquema: esquemaEncerrarCorrida,
  executar: async (dados, contexto) => {
    const corrida = await buscarCorridaPorId(contexto.tx, dados.id);
    if (!corrida) throw new ErroNaoEncontrado('Corrida não encontrada.');

    if (
      contexto.usuario.perfil !== 'ADMIN' &&
      corrida.jornada.motoristaId !== contexto.usuario.id
    ) {
      throw new ErroNaoEncontrado('Corrida não encontrada.');
    }

    const encerradaEm = new Date();

    // Os totais vêm do cálculo, nunca do que o cliente enviou (RN018).
    const totais = calcularEncerramento({
      status: corrida.status,
      iniciadaEm: corrida.iniciadaEm,
      encerradaEm,
      odometroInicial: corrida.odometroInicial,
      odometroFinal: dados.odometroFinal,
      quantidadePassageiros: dados.quantidadePassageiros ?? null,
      capacidadeDoVeiculo: corrida.jornada.veiculo.capacidadePassageiros,
      confirmaExcessoPassageiros: dados.confirmaExcessoPassageiros,
    });

    await gravarEncerramento(contexto.tx, dados.id, {
      encerradaEm,
      odometroFinal: dados.odometroFinal,
      kmPercorrido: totais.kmPercorrido,
      duracaoMinutos: totais.duracaoMinutos,
      quantidadePassageiros: dados.quantidadePassageiros ?? null,
      observacoes: ouNulo(dados.observacoes),
      atualizadoPor: contexto.usuario.id,
    });

    await registrarLocalizacaoSeHouver(contexto, dados.id, dados.localizacao);

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'corrida',
      entidadeId: dados.id,
      valorAnterior: { status: 'EM_ANDAMENTO', odometroFinal: null },
      valorNovo: {
        status: 'ENCERRADA',
        odometroFinal: dados.odometroFinal,
        kmPercorrido: totais.kmPercorrido,
        quantidadePassageiros: dados.quantidadePassageiros ?? null,
      },
    });

    return totais;
  },
});

export const cancelar = definirAcao<EntradaCancelarCorrida, { ok: true }>({
  nome: 'corrida.cancelar',
  esquema: esquemaCancelarCorrida,
  executar: async (dados, contexto) => {
    const corrida = await buscarCorridaPorId(contexto.tx, dados.id);
    if (!corrida) throw new ErroNaoEncontrado('Corrida não encontrada.');

    if (
      contexto.usuario.perfil !== 'ADMIN' &&
      corrida.jornada.motoristaId !== contexto.usuario.id
    ) {
      throw new ErroNaoEncontrado('Corrida não encontrada.');
    }

    if (corrida.status !== 'EM_ANDAMENTO') {
      throw new ErroDeConflito(
        CodigoErro.CORRIDA_JA_ENCERRADA,
        'Esta corrida já foi encerrada ou cancelada.',
      );
    }

    validarCancelamento(dados.motivo);

    await cancelarCorrida(contexto.tx, dados.id, dados.motivo.trim(), contexto.usuario.id);

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'corrida',
      entidadeId: dados.id,
      valorAnterior: { status: 'EM_ANDAMENTO' },
      valorNovo: { status: 'CANCELADA' },
      justificativa: dados.motivo.trim(),
    });

    return { ok: true };
  },
});

export interface ResultadoDaCorrecao {
  kmPercorrido: number;
  editadaEm: Date;
}

/**
 * Correção de uma corrida encerrada (US022 · RF023 · RN019, RN026, RN027).
 *
 * A regra de quem pode corrigir e até quando já existia em
 * `validarCorrecao` desde a Sprint 4, testada e sem nenhum caso de uso a
 * chamando. Este é o caso de uso.
 *
 * O km **não** é aceito do cliente: ele é recalculado do odômetro corrigido
 * (RN018), como no encerramento. Correção que aceitasse o total pronto abriria
 * a porta para um km que não corresponde à diferença dos odômetros — e é
 * justamente o cruzamento dos dois que dá confiança ao relatório.
 */
export const corrigir = definirAcao<EntradaCorrigirCorrida, ResultadoDaCorrecao>({
  nome: 'corrida.corrigir',
  esquema: esquemaCorrigirCorrida,
  executar: async (dados, contexto) => {
    const corrida = await buscarCorridaPorId(contexto.tx, dados.id);
    if (!corrida) throw new ErroNaoEncontrado('Corrida não encontrada.');

    // RN009 — corrida de outro motorista responde 404, não 403.
    if (
      contexto.usuario.perfil !== 'ADMIN' &&
      corrida.jornada.motoristaId !== contexto.usuario.id
    ) {
      throw new ErroNaoEncontrado('Corrida não encontrada.');
    }

    if (corrida.status !== 'ENCERRADA') {
      throw new ErroDeConflito(
        CodigoErro.CORRIDA_EM_ANDAMENTO,
        'Só é possível corrigir uma corrida já encerrada.',
      );
    }

    const janelaHoras = await obterValor(
      contexto.tx,
      CHAVES.janelaEdicaoHoras,
      JANELA_EDICAO_HORAS_PADRAO,
    );

    validarCorrecao({
      perfil: contexto.usuario.perfil,
      encerradaEm: corrida.encerradaEm,
      agora: new Date(),
      justificativa: dados.justificativa,
      janelaHoras,
    });

    validarOdometroDeCorrecao(corrida.odometroInicial, dados.odometroFinal);

    const kmPercorrido = arredondar(dados.odometroFinal - (corrida.odometroInicial ?? 0), 2);
    const editadaEm = new Date();

    await corrigirCorrida(contexto.tx, dados.id, {
      odometroFinal: dados.odometroFinal,
      kmPercorrido,
      quantidadePassageiros: dados.quantidadePassageiros ?? null,
      observacoes: ouNulo(dados.observacoes),
      editadaEm,
      atualizadoPor: contexto.usuario.id,
    });
    await recalcularTotaisDoDiaEncerrado(contexto.tx, corrida.jornadaId, contexto.usuario.id);

    // A justificativa vai para a trilha junto com o antes e o depois: é ela que
    // dá sentido ao "valor anterior" seis meses depois (RN026).
    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'corrida',
      entidadeId: dados.id,
      justificativa: dados.justificativa,
      valorAnterior: {
        odometroFinal: corrida.odometroFinal,
        kmPercorrido: corrida.kmPercorrido === null ? null : Number(corrida.kmPercorrido),
        quantidadePassageiros: corrida.quantidadePassageiros,
        observacoes: corrida.observacoes,
      },
      valorNovo: {
        odometroFinal: dados.odometroFinal,
        kmPercorrido,
        quantidadePassageiros: dados.quantidadePassageiros ?? null,
        observacoes: ouNulo(dados.observacoes),
      },
    });

    return { kmPercorrido, editadaEm };
  },
});

export interface JanelaDeCorrecao {
  horas: number;
  perfil: 'ADMIN' | 'MOTORISTA';
}

/**
 * Parâmetros da janela de correção, para a tela decidir o que mostrar.
 *
 * Devolve **dados**, não uma função: o resultado atravessa a fronteira entre
 * servidor e cliente, e função não é serializável. Quem combina os dados com o
 * relógio é `podeCorrigirAgora`, que é regra pura e roda dos dois lados.
 */
export const janelaDeCorrecao = definirAcao<void, JanelaDeCorrecao>({
  nome: 'corrida.janela-de-correcao',
  semTransacao: true,
  executar: async (_dados, contexto) => ({
    horas: await obterValor(contexto.tx, CHAVES.janelaEdicaoHoras, JANELA_EDICAO_HORAS_PADRAO),
    perfil: contexto.usuario.perfil,
  }),
});
