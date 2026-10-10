import { definirAcao } from '@/lib/acao-segura';
import { filtroDeMotorista } from '@/lib/autorizacao';
import { ErroNaoEncontrado } from '@/lib/erros';
import { montarPagina, paraIntervalo, type DadosPaginados } from '@/lib/paginacao';
import { arredondar } from '@/utilitarios/numero';
import {
  corridasEmAndamentoAgora,
  indicadoresDoDia,
  motoristasSemRegistro,
  motoristasComJornada,
  resumoPorMotorista,
  type CorridaAgora,
  type IndicadoresDoDia,
  type JornadaDoResumo,
} from '@/modulos/relatorio/relatorio.repositorio';
import {
  buscarJornadaCompleta,
  listarJornadas,
  type JornadaCompleta,
  type JornadaDaListagem,
} from '@/modulos/jornada/jornada.repositorio';
import { listarCorridas, type CorridaDaListagem } from '@/modulos/corrida/corrida.repositorio';
import {
  esquemaDia,
  esquemaResumoDoDia,
  esquemaListarCorridas,
  esquemaListarJornadas,
  type EntradaDia,
  type EntradaResumoDoDia,
  type EntradaListarCorridas,
  type EntradaListarJornadas,
} from '@/modulos/relatorio/relatorio.schema';
import { z } from 'zod';

/** Casos de uso do painel e do resumo (US026, US027, US028, US030). */

export interface PainelDoDia {
  data: string;
  indicadores: IndicadoresDoDia;
  corridasAgora: CorridaAgora[];
  pendentes: { id: string; nome: string }[];
}

export const painel = definirAcao<EntradaDia, PainelDoDia>({
  nome: 'relatorio.painel',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaDia,
  executar: async ({ data }, contexto) => {
    const [indicadores, corridasAgora, pendentes] = await Promise.all([
      indicadoresDoDia(contexto.tx, data),
      corridasEmAndamentoAgora(contexto.tx, data),
      motoristasSemRegistro(contexto.tx, data),
    ]);

    return { data, indicadores, corridasAgora, pendentes };
  },
});

export const listarJornadasDoPainel = definirAcao<
  EntradaListarJornadas,
  DadosPaginados<JornadaDaListagem>
>({
  nome: 'relatorio.listar-jornadas',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaListarJornadas,
  executar: async (filtros, contexto) => {
    const { skip, take } = paraIntervalo(filtros);

    const { jornadas, total } = await listarJornadas(contexto.tx, {
      dataInicio: filtros.dataInicio,
      dataFim: filtros.dataFim,
      motoristaId: filtros.motoristaId,
      veiculoId: filtros.veiculoId,
      status: filtros.status,
      ordenar: filtros.ordenar,
      direcao: filtros.direcao,
      skip,
      take,
    });

    return montarPagina(jornadas, total, filtros);
  },
});

export const listarCorridasDoPainel = definirAcao<
  EntradaListarCorridas,
  DadosPaginados<CorridaDaListagem>
>({
  nome: 'relatorio.listar-corridas',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaListarCorridas,
  executar: async (filtros, contexto) => {
    const { skip, take } = paraIntervalo(filtros);

    const { corridas, total } = await listarCorridas(contexto.tx, {
      dataInicio: filtros.dataInicio,
      dataFim: filtros.dataFim,
      motoristaId: filtros.motoristaId,
      veiculoId: filtros.veiculoId,
      rotaId: filtros.rotaId,
      status: filtros.status,
      ordenar: filtros.ordenar,
      direcao: filtros.direcao,
      skip,
      take,
    });

    return montarPagina(corridas, total, filtros);
  },
});

export const detalheDaJornada = definirAcao<{ id: string }, JornadaCompleta>({
  nome: 'relatorio.detalhe-jornada',
  semTransacao: true,
  esquema: z.object({ id: z.string().uuid() }),
  executar: async ({ id }, contexto) => {
    const jornada = await buscarJornadaCompleta(contexto.tx, id);
    if (!jornada) throw new ErroNaoEncontrado('Jornada não encontrada.');

    // RN009 — jornada de outro motorista responde 404, não 403.
    if (contexto.usuario.perfil !== 'ADMIN' && jornada.motoristaId !== contexto.usuario.id) {
      throw new ErroNaoEncontrado('Jornada não encontrada.');
    }

    return jornada;
  },
});

export interface ResumoDoDia {
  data: string;
  /** Jornadas encerradas — as únicas que compõem o consolidado (RN017). */
  encerradas: JornadaDoResumo[];
  /** Ainda em curso: aparecem como pendência, fora dos totais. */
  emAberto: JornadaDoResumo[];
  consolidado: {
    motoristas: number;
    corridas: number;
    kmTotal: number;
    passageiros: number;
    ocorrencias: number;
  };
}

export const listarMotoristasDoResumo = definirAcao<void, { id: string; nome: string }[]>({
  nome: 'relatorio.motoristas-do-resumo',
  perfis: ['ADMIN'],
  semTransacao: true,
  executar: (_entrada, contexto) => motoristasComJornada(contexto.tx),
});

export const resumoDoDia = definirAcao<EntradaResumoDoDia, ResumoDoDia>({
  nome: 'relatorio.resumo-do-dia',
  semTransacao: true,
  esquema: esquemaResumoDoDia,
  executar: async ({ data, motoristaId }, contexto) => {
    const motoristaEfetivo = filtroDeMotorista(contexto.usuario, motoristaId);
    const todas = await resumoPorMotorista(contexto.tx, data, motoristaEfetivo);

    // O motorista só enxerga o próprio dia (RN009). O filtro é aplicado aqui, e
    // não na tela, para que o dado alheio nunca chegue ao navegador dele.
    const visiveis = motoristaEfetivo
      ? todas.filter((jornada) => jornada.motorista.id === motoristaEfetivo)
      : todas;

    const encerradas = visiveis.filter((jornada) => jornada.status === 'ENCERRADA');
    const emAberto = visiveis.filter((jornada) => jornada.status === 'ABERTA');

    return {
      data,
      encerradas,
      emAberto,
      consolidado: {
        motoristas: encerradas.length,
        corridas: encerradas.reduce((soma, jornada) => soma + (jornada.totalCorridas ?? 0), 0),
        kmTotal: arredondar(
          encerradas.reduce((soma, jornada) => soma + Number(jornada.kmTotal ?? 0), 0),
          2,
        ),
        passageiros: encerradas.reduce(
          (soma, jornada) => soma + (jornada.totalPassageiros ?? 0),
          0,
        ),
        ocorrencias: visiveis.reduce((soma, jornada) => soma + jornada.ocorrencias.length, 0),
      },
    };
  },
});

/** Histórico pessoal: até o administrador consulta aqui somente o próprio dia. */
export const meuResumoDoDia = definirAcao<
  EntradaDia,
  { data: string; jornadas: JornadaDoResumo[] }
>({
  nome: 'relatorio.meu-resumo-do-dia',
  semTransacao: true,
  esquema: esquemaDia,
  executar: async ({ data }, contexto) => ({
    data,
    jornadas: await resumoPorMotorista(contexto.tx, data, contexto.usuario.id),
  }),
});
