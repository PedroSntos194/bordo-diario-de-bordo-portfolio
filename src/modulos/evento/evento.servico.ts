import { definirAcao } from '@/lib/acao-segura';
import { ErroNaoEncontrado } from '@/lib/erros';
import { logger } from '@/lib/logger';
import { buscarCorridaPorId, registrarLocalizacao } from '@/modulos/corrida/corrida.repositorio';
import {
  buscarEventoPorId,
  buscarPontoParada,
  buscarPorClientUuid,
  criarEvento,
  removerEvento,
} from '@/modulos/evento/evento.repositorio';
import {
  validarCorridaParaEvento,
  validarDesfazer,
  validarIdentificacaoDaParada,
  validarPontoDaRota,
} from '@/modulos/evento/evento.regras';
import {
  esquemaDesfazerEvento,
  esquemaRegistrarEvento,
  type EntradaDesfazerEvento,
  type EntradaRegistrarEvento,
} from '@/modulos/evento/evento.schema';

/**
 * Casos de uso dos eventos da corrida (US021 · RF017).
 *
 * O motorista toca uma vez e o sistema resolve o resto: horário do servidor,
 * localização quando houver, vínculo com o ponto da rota. Nenhum campo a
 * preencher — é o que faz a diferença entre marcar as paradas e não marcar.
 */

export const registrar = definirAcao<EntradaRegistrarEvento, { id: string; jaExistia: boolean }>({
  nome: 'evento.registrar',
  esquema: esquemaRegistrarEvento,
  executar: async (dados, contexto) => {
    // Reenvio de um registro criado offline não cria segundo evento (RN025).
    if (dados.clientUuid) {
      const jaSincronizado = await buscarPorClientUuid(contexto.tx, dados.clientUuid);
      if (jaSincronizado) return { id: jaSincronizado.id, jaExistia: true };
    }

    const corrida = await buscarCorridaPorId(contexto.tx, dados.corridaId);
    if (!corrida) throw new ErroNaoEncontrado('Corrida não encontrada.');

    // RN009 — corrida de outro motorista responde 404, não 403.
    if (
      contexto.usuario.perfil !== 'ADMIN' &&
      corrida.jornada.motoristaId !== contexto.usuario.id
    ) {
      throw new ErroNaoEncontrado('Corrida não encontrada.');
    }

    validarCorridaParaEvento(corrida.status);

    const ponto = dados.pontoParadaId
      ? await buscarPontoParada(contexto.tx, dados.pontoParadaId)
      : null;

    if (dados.pontoParadaId && !ponto) {
      throw new ErroNaoEncontrado('Ponto de parada não encontrado.');
    }

    validarPontoDaRota({
      pontoParadaId: dados.pontoParadaId ?? null,
      rotaDoPonto: ponto?.rotaId ?? null,
      rotaDaCorrida: corrida.rota?.id ?? null,
    });

    const descricao = dados.descricao?.trim() || null;

    validarIdentificacaoDaParada({
      pontoParadaId: dados.pontoParadaId ?? null,
      descricao,
    });

    const evento = await criarEvento(contexto.tx, {
      corridaId: corrida.id,
      pontoParadaId: dados.pontoParadaId ?? null,
      tipo: dados.tipo,
      // Ponto cadastrado já tem nome; guardar de novo duplicaria a fonte da
      // verdade e divergiria no dia em que o ponto fosse renomeado.
      descricao: ponto ? null : descricao,
      // Relógio do servidor: é ele que decide a ordem da linha do tempo.
      ocorridoEm: new Date(),
      clientUuid: dados.clientUuid ?? null,
      criadoPor: contexto.usuario.id,
    });

    // Falha ao gravar o ponto vira log, não exceção (RN022): a parada aconteceu
    // mesmo que o GPS não tenha respondido.
    if (dados.localizacao) {
      try {
        await registrarLocalizacao(contexto.tx, corrida.id, dados.localizacao, evento.id);
      } catch (erro) {
        logger.error('evento.localizacao.falha_ao_gravar', {
          eventoId: evento.id,
          detalhe: erro instanceof Error ? erro.message : String(erro),
        });
      }
    }

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'corrida_evento',
      entidadeId: evento.id,
      valorNovo: {
        corridaId: corrida.id,
        tipo: dados.tipo,
        ponto: ponto?.nome ?? descricao,
        comLocalizacao: Boolean(dados.localizacao),
      },
    });

    return { id: evento.id, jaExistia: false };
  },
});

/**
 * Desfazer o último registro, dentro da janela de 2 minutos (US021).
 *
 * É apagamento de verdade, não marcação: o evento desfeito não aconteceu, e
 * deixá-lo como "cancelado" na linha do tempo poluiria a leitura de quem
 * confere a corrida depois. A trilha de auditoria guarda que houve o desfazer —
 * é lá que o histórico vive (RN026, RN027).
 */
export const desfazer = definirAcao<EntradaDesfazerEvento, { ok: true }>({
  nome: 'evento.desfazer',
  esquema: esquemaDesfazerEvento,
  executar: async ({ id }, contexto) => {
    const evento = await buscarEventoPorId(contexto.tx, id);
    if (!evento) throw new ErroNaoEncontrado('Evento não encontrado.');

    if (
      contexto.usuario.perfil !== 'ADMIN' &&
      evento.corrida.jornada.motoristaId !== contexto.usuario.id
    ) {
      throw new ErroNaoEncontrado('Evento não encontrado.');
    }

    validarCorridaParaEvento(evento.corrida.status);
    validarDesfazer(evento.ocorridoEm, new Date());

    contexto.auditar({
      acao: 'EXCLUIR',
      entidade: 'corrida_evento',
      entidadeId: evento.id,
      valorAnterior: {
        corridaId: evento.corridaId,
        tipo: evento.tipo,
        ocorridoEm: evento.ocorridoEm,
      },
    });

    await removerEvento(contexto.tx, evento.id);

    return { ok: true };
  },
});
