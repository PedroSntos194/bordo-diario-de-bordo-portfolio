import type { TipoOperacaoOffline } from '@prisma/client';
import { definirAcao, type ContextoDaAcao, type Resultado } from '@/lib/acao-segura';
import { CodigoErro } from '@/lib/erros';
import { logger } from '@/lib/logger';
import {
  abrir as abrirJornada,
  encerrar as encerrarJornada,
} from '@/modulos/jornada/jornada.servico';
import {
  encerrar as encerrarCorrida,
  iniciar as iniciarCorrida,
} from '@/modulos/corrida/corrida.servico';
import { registrar as registrarEvento } from '@/modulos/evento/evento.servico';
import { buscarJornadaDoDia } from '@/modulos/jornada/jornada.repositorio';
import { listarDisponiveis } from '@/modulos/veiculo/veiculo.repositorio';
import { listarRotasAtivas } from '@/modulos/rota/rota.repositorio';
import { dataOperacional } from '@/utilitarios/data';
import {
  buscarOperacao,
  corridaPorClientUuid,
  registrarOperacao,
} from '@/modulos/sincronizacao/sincronizacao.repositorio';
import {
  classificarFalha,
  ordenarOperacoes,
  type OperacaoOffline,
  type ResultadoDaOperacao,
  type RetratoDoDia,
  type TipoDeOperacao,
} from '@/modulos/sincronizacao/sincronizacao.regras';
import {
  esquemaSincronizar,
  type EntradaSincronizar,
} from '@/modulos/sincronizacao/sincronizacao.schema';

/**
 * Sincronização das operações criadas sem conexão (US025 · RF022 · RN025).
 *
 * ## O lote **não** é uma transação
 *
 * `semTransacao: true`, e é o ponto central do desenho. O critério de aceitação
 * diz que "uma operação em conflito não interrompe as demais": um dia com seis
 * corridas em que a terceira colide não pode perder as outras cinco. Uma
 * transação única faria exatamente isso.
 *
 * Em troca, cada operação é **delegada ao caso de uso normal** — o mesmo que a
 * tela usa quando há rede —, e cada um traz a própria transação, a própria
 * autorização e a própria auditoria. Nada aqui reimplementa regra de negócio:
 * o odômetro é validado pela mesma `validarOdometroDeAbertura`, a corrida é
 * encerrada pelo mesmo `encerrarCorrida`. A alternativa — um caminho de
 * gravação paralelo para o offline — seria uma segunda implementação das
 * regras, divergindo da primeira na primeira mudança.
 *
 * ## Idempotência (RN025)
 *
 * Duas camadas, e elas cobrem coisas diferentes:
 *
 * 1. As operações que **criam** já eram idempotentes: `jornada.abrir`,
 *    `corrida.iniciar` e `evento.registrar` procuram pelo `clientUuid` antes de
 *    inserir, e o banco tem índice único na coluna.
 * 2. As que **atualizam** — encerrar corrida, encerrar dia — não criam linha
 *    onde carimbar o identificador. Para elas existe o livro-razão
 *    `operacao_sincronizada`, consultado antes e gravado depois.
 *
 * O registro no livro-razão acontece **depois** do sucesso, e não antes, por
 * escolha explícita: a falha que sobra nessa ordem é o motorista ver um
 * conflito ("esta corrida já foi encerrada") numa operação que na verdade deu
 * certo — visível, explicável e resolvível na tela de pendências. Na ordem
 * inversa, uma queda entre reservar e executar faria o registro sumir em
 * silêncio, que é o defeito que este sistema inteiro existe para não ter.
 */

interface Delegacao {
  entidade: string;
  executar: (
    dados: Record<string, unknown>,
    contexto: ContextoDaAcao,
  ) => Promise<{ resultado: Resultado<unknown>; id: string | null }>;
}

/**
 * Resolve a referência a uma corrida que pode existir só no aparelho.
 *
 * A corrida iniciada sem rede não tem id do servidor até subir. O aparelho a
 * conhece pelo `clientUuid` que ele mesmo gerou, e é assim que o encerramento e
 * as paradas apontam para ela.
 */
async function resolverCorrida(
  contexto: ContextoDaAcao,
  dados: Record<string, unknown>,
): Promise<string | null> {
  const idDireto = dados.corridaId ?? dados.id;
  if (typeof idDireto === 'string' && idDireto !== '') return idDireto;

  const local = dados.corridaClientUuid;
  if (typeof local !== 'string' || local === '') return null;

  const corrida = await corridaPorClientUuid(contexto.tx, local);
  return corrida?.id ?? null;
}

/**
 * Recusa explicada para a operação que aponta para uma corrida inexistente.
 *
 * Acontece quando o início da corrida foi recusado e o que veio depois na fila
 * ainda aponta para ele. Sem esta mensagem, o caso de uso receberia um
 * identificador nulo e responderia "verifique os campos destacados" — que não
 * diz nada a quem está olhando uma tela sem campo nenhum. A causa é sempre a
 * mesma e cabe numa frase: resolva o registro anterior primeiro.
 */
function corridaNaoResolvida(assunto: string): Resultado<never> {
  return {
    sucesso: false,
    erro: {
      codigo: CodigoErro.NAO_ENCONTRADO,
      mensagem:
        `${assunto} aponta para uma corrida que não chegou ao servidor. ` +
        'Resolva primeiro o registro de início da corrida.',
    },
  };
}

const DELEGACOES: Record<TipoDeOperacao, Delegacao> = {
  ABRIR_JORNADA: {
    entidade: 'jornada',
    executar: async (dados) => {
      const resultado = await abrirJornada(dados);
      return { resultado, id: resultado.sucesso ? resultado.dados.id : null };
    },
  },

  INICIAR_CORRIDA: {
    entidade: 'corrida',
    executar: async (dados) => {
      const resultado = await iniciarCorrida(dados);
      return { resultado, id: resultado.sucesso ? resultado.dados.id : null };
    },
  },

  REGISTRAR_EVENTO: {
    entidade: 'corrida_evento',
    executar: async (dados, contexto) => {
      const corridaId = await resolverCorrida(contexto, dados);
      if (!corridaId) {
        return { resultado: corridaNaoResolvida('Esta parada'), id: null };
      }

      const resultado = await registrarEvento({ ...dados, corridaId });
      return { resultado, id: resultado.sucesso ? resultado.dados.id : null };
    },
  },

  ENCERRAR_CORRIDA: {
    entidade: 'corrida',
    executar: async (dados, contexto) => {
      const id = await resolverCorrida(contexto, dados);
      if (!id) {
        return { resultado: corridaNaoResolvida('Este encerramento'), id: null };
      }

      const resultado = await encerrarCorrida({ ...dados, id });
      // O encerramento devolve os totais, não o identificador: quem o conhece
      // é a própria entrada, depois de resolvida.
      return { resultado, id: resultado.sucesso ? id : null };
    },
  },

  ENCERRAR_JORNADA: {
    entidade: 'jornada',
    executar: async (dados) => {
      const resultado = await encerrarJornada(dados);
      // A jornada encerrada é sempre a aberta do motorista — o caso de uso a
      // descobre sozinho e não devolve o id.
      return { resultado, id: null };
    },
  },
};

async function aplicar(
  contexto: ContextoDaAcao,
  operacao: OperacaoOffline,
): Promise<ResultadoDaOperacao> {
  // 1 · o livro-razão responde antes de qualquer trabalho (RN025).
  const jaAplicada = await buscarOperacao(contexto.tx, operacao.clientUuid);
  if (jaAplicada) {
    return {
      clientUuid: operacao.clientUuid,
      situacao: 'JA_PROCESSADA',
      id: jaAplicada.entidadeId,
      codigo: null,
      mensagem: null,
    };
  }

  const delegacao = DELEGACOES[operacao.tipo];

  let resultado: Resultado<unknown>;
  let id: string | null;

  try {
    /**
     * O identificador do envelope entra nos **dados** da operação.
     *
     * É ele que vai parar na coluna `client_uuid` de jornada, corrida e evento
     * — e sem isso a camada de idempotência que já existia desde a Sprint 4
     * ficaria morta: as colunas nasceriam nulas, `buscarPorClientUuid` nunca
     * acharia nada, e o encerramento de uma corrida criada sem rede não teria
     * como apontar para ela.
     *
     * Encerrar corrida e encerrar dia não têm o campo nos seus esquemas; o Zod
     * descarta a chave a mais, e para eles quem garante a idempotência é o
     * livro-razão.
     */
    ({ resultado, id } = await delegacao.executar(
      // `ocorridoEm` vai junto: abrir e encerrar o dia usam o horário do
      // celular (ver `horarioDoRegistro`); os demais esquemas descartam o campo.
      { ...operacao.dados, clientUuid: operacao.clientUuid, ocorridoEm: operacao.ocorridoEm },
      contexto,
    ));
  } catch (erro) {
    // Exceção que escapou do caso de uso é falha de ambiente, não recusa de
    // regra: vale repetir mais tarde em vez de cobrar uma decisão do motorista.
    logger.error('sincronizacao.operacao.excecao', {
      tipo: operacao.tipo,
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });

    return {
      clientUuid: operacao.clientUuid,
      situacao: 'FALHA',
      id: null,
      codigo: CodigoErro.ERRO_INTERNO,
      mensagem: 'Não conseguimos enviar este registro agora. Vamos tentar de novo.',
    };
  }

  if (!resultado.sucesso) {
    const situacao = classificarFalha(resultado.erro.codigo);

    logger.warn('sincronizacao.operacao.recusada', {
      tipo: operacao.tipo,
      codigo: resultado.erro.codigo,
      situacao,
    });

    return {
      clientUuid: operacao.clientUuid,
      situacao,
      id: null,
      codigo: resultado.erro.codigo,
      mensagem: resultado.erro.mensagem,
    };
  }

  await registrarOperacao(contexto.tx, {
    clientUuid: operacao.clientUuid,
    usuarioId: contexto.usuario.id,
    tipo: operacao.tipo as TipoOperacaoOffline,
    ocorridoEm: new Date(operacao.ocorridoEm),
    entidade: delegacao.entidade,
    entidadeId: id,
  });

  return {
    clientUuid: operacao.clientUuid,
    situacao: 'APLICADA',
    id,
    codigo: null,
    mensagem: null,
  };
}

export interface ResultadoDaSincronizacao {
  resultados: ResultadoDaOperacao[];
  aplicadas: number;
  conflitos: number;
  falhas: number;
}

export const sincronizar = definirAcao<EntradaSincronizar, ResultadoDaSincronizacao>({
  nome: 'sincronizacao.lote',
  // Ver a nota do topo: o lote não é transação, de propósito.
  semTransacao: true,
  esquema: esquemaSincronizar,
  executar: async ({ operacoes }, contexto) => {
    // O cliente já manda ordenado; ordenar de novo é barato e protege contra a
    // fila embaralhada — encerrar uma corrida antes de iniciá-la produziria um
    // conflito que ninguém entenderia.
    const emOrdem = ordenarOperacoes(operacoes as OperacaoOffline[]);

    const resultados: ResultadoDaOperacao[] = [];

    for (const operacao of emOrdem) {
      resultados.push(await aplicar(contexto, operacao));
    }

    const contar = (situacao: string): number =>
      resultados.filter((resultado) => resultado.situacao === situacao).length;

    const resumo = {
      resultados,
      aplicadas: contar('APLICADA') + contar('JA_PROCESSADA'),
      conflitos: contar('CONFLITO'),
      falhas: contar('FALHA'),
    };

    logger.info('sincronizacao.lote.processado', {
      usuarioId: contexto.usuario.id,
      operacoes: emOrdem.length,
      aplicadas: resumo.aplicadas,
      conflitos: resumo.conflitos,
      falhas: resumo.falhas,
    });

    return resumo;
  },
});

/**
 * Retrato do dia para uso sem conexão (US025).
 *
 * Uma chamada só, e não três, pelo mesmo motivo de `jornada.meuDia`: quem
 * consome isto é um celular numa rede instável, e cada requisição a mais é uma
 * chance a mais de o motorista ficar sem os dados de que vai precisar quando o
 * sinal sumir.
 *
 * O retrato é gravado no aparelho e é o que permite ao modo sem conexão saber
 * quais vans existem, quais rotas estão ativas e em que pé estava o dia. Sem
 * ele, o motorista sem sinal não teria nem a lista de veículos para escolher.
 */
export const retratoDoDia = definirAcao<void, RetratoDoDia>({
  nome: 'sincronizacao.retrato',
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const hoje = dataOperacional();

    const [jornada, veiculos, rotas] = await Promise.all([
      buscarJornadaDoDia(contexto.tx, contexto.usuario.id, hoje),
      listarDisponiveis(contexto.tx),
      listarRotasAtivas(contexto.tx),
    ]);

    const emAndamento = jornada?.corridas.find((corrida) => corrida.status === 'EM_ANDAMENTO');

    return {
      data: hoje,
      atualizadoEm: new Date().toISOString(),
      jornadaAberta:
        jornada && jornada.status === 'ABERTA'
          ? { id: jornada.id, placa: jornada.veiculo.placa }
          : null,
      corridaEmAndamento: emAndamento
        ? {
            id: emAndamento.id,
            descricao:
              emAndamento.rota?.nome ??
              `${emAndamento.origemDescricao ?? '—'} → ${emAndamento.destinoDescricao ?? '—'}`,
          }
        : null,
      // A van que o motorista está usando some de "disponíveis" (ela já está
      // numa jornada aberta), e sem ela a tela sem conexão não teria como
      // mostrar de que veículo é o dia em curso.
      veiculos: veiculos.map((veiculo) => ({
        id: veiculo.id,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        odometroAtual: veiculo.odometroAtual,
      })),
      rotas: rotas.map((rota) => ({ id: rota.id, codigo: rota.codigo, nome: rota.nome })),
    };
  },
});
