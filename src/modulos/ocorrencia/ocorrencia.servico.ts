import { z } from 'zod';
import { definirAcao } from '@/lib/acao-segura';
import { ErroNaoEncontrado } from '@/lib/erros';
import { buscarCorridaPorId } from '@/modulos/corrida/corrida.repositorio';
import { buscarJornadaDoDia } from '@/modulos/jornada/jornada.repositorio';
import {
  criarOcorrencia,
  ocorrenciasDaJornada,
  ocorrenciasDoDia,
  type OcorrenciaDaJornada,
  type OcorrenciaDoDia,
} from '@/modulos/ocorrencia/ocorrencia.repositorio';
import {
  validarJornadaParaOcorrencia,
  validarVinculo,
} from '@/modulos/ocorrencia/ocorrencia.regras';
import {
  esquemaRegistrarOcorrencia,
  type EntradaRegistrarOcorrencia,
} from '@/modulos/ocorrencia/ocorrencia.schema';
import { dataOperacional } from '@/utilitarios/data';

/**
 * Casos de uso da ocorrência (US023 · RF020 · RN023).
 *
 * O registro é deliberadamente **barato de fazer**: tipo, descrição e pronto —
 * horário e localização o sistema resolve. Um motorista com a van quebrada no
 * acostamento não vai preencher formulário; se não couber em segundos, o relato
 * não acontece e a empresa fica sabendo por telefone, como antes.
 */

export const registrar = definirAcao<EntradaRegistrarOcorrencia, { id: string }>({
  nome: 'ocorrencia.registrar',
  esquema: esquemaRegistrarOcorrencia,
  executar: async (dados, contexto) => {
    // A ocorrência pertence ao dia do motorista. Não se pede a jornada por
    // parâmetro: o cliente não deve escolher em nome de quem registra.
    //
    // Vale para o dia **já encerrado** também: o motorista costuma lembrar do
    // problema depois de fechar o dia, e RN023 garante que o relato não mexe em
    // km, horário nem status. Recusar aqui só empurraria o relato para fora do
    // sistema, que é o problema que este projeto veio resolver.
    const jornada = await buscarJornadaDoDia(contexto.tx, contexto.usuario.id, dataOperacional());
    if (!jornada) {
      throw new ErroNaoEncontrado('Você precisa ter iniciado o dia para registrar uma ocorrência.');
    }

    validarJornadaParaOcorrencia(jornada.status);

    // A corrida, quando informada, precisa ser da mesma jornada — senão o
    // relato de um motorista acabaria pendurado na corrida de outro.
    let jornadaDaCorrida: string | null = null;
    if (dados.corridaId) {
      const corrida = await buscarCorridaPorId(contexto.tx, dados.corridaId);
      if (!corrida) throw new ErroNaoEncontrado('Corrida não encontrada.');
      jornadaDaCorrida = corrida.jornadaId;
    }

    validarVinculo({
      jornadaId: jornada.id,
      corridaId: dados.corridaId ?? null,
      jornadaDaCorrida,
    });

    const ocorrencia = await criarOcorrencia(contexto.tx, {
      jornadaId: jornada.id,
      corridaId: dados.corridaId ?? null,
      tipo: dados.tipo,
      descricao: dados.descricao,
      // Relógio do servidor, não do dispositivo: este registro pode virar prova
      // numa discussão de seguro, e celular com hora errada é comum.
      ocorridoEm: new Date(),
      latitude: dados.localizacao?.latitude ?? null,
      longitude: dados.localizacao?.longitude ?? null,
      criadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'ocorrencia',
      entidadeId: ocorrencia.id,
      valorNovo: {
        tipo: dados.tipo,
        jornadaId: jornada.id,
        corridaId: dados.corridaId ?? null,
        comLocalizacao: Boolean(dados.localizacao),
      },
    });

    return { id: ocorrencia.id };
  },
});

export const listarDaJornada = definirAcao<{ jornadaId: string }, OcorrenciaDaJornada[]>({
  nome: 'ocorrencia.listar-da-jornada',
  semTransacao: true,
  esquema: z.object({ jornadaId: z.string().uuid() }),
  executar: async ({ jornadaId }, contexto) => {
    // RN009 — o motorista só enxerga a própria jornada.
    if (contexto.usuario.perfil !== 'ADMIN') {
      const propria = await buscarJornadaDoDia(contexto.tx, contexto.usuario.id, dataOperacional());
      if (!propria || propria.id !== jornadaId) {
        throw new ErroNaoEncontrado('Jornada não encontrada.');
      }
    }

    return ocorrenciasDaJornada(contexto.tx, jornadaId);
  },
});

export const listarDoDia = definirAcao<{ data?: string }, OcorrenciaDoDia[]>({
  nome: 'ocorrencia.listar-do-dia',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: z.object({
    data: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  executar: async ({ data }, contexto) => ocorrenciasDoDia(contexto.tx, data ?? dataOperacional()),
});
