import { definirAcao } from '@/lib/acao-segura';
import { CodigoErro, ErroDeConflito, ErroNaoEncontrado } from '@/lib/erros';
import {
  buscarFeriado,
  buscarFeriadoPorData,
  criarFeriado,
  criarFeriados,
  feriadosDoPeriodo,
  removerFeriado,
} from '@/modulos/feriado/feriado.repositorio';
import { feriadosNacionais, feriadosQueFaltam } from '@/modulos/feriado/feriado.regras';
import {
  esquemaAnoDosFeriados,
  esquemaCriarFeriado,
  esquemaNacionaisDoAno,
  esquemaRemoverFeriado,
  type EntradaAnoDosFeriados,
  type EntradaCriarFeriado,
  type EntradaNacionaisDoAno,
  type EntradaRemoverFeriado,
} from '@/modulos/feriado/feriado.schema';
import { comoDataIso, dataOperacional } from '@/utilitarios/data';

/** Calendário de feriados do fechamento — só a administração mexe. */

export interface FeriadosDoAno {
  ano: number;
  feriados: { id: string; data: string; nome: string }[];
  /** Nacionais do ano que ainda não estão cadastrados. */
  nacionaisQueFaltam: number;
}

export const feriadosDoAno = definirAcao<EntradaAnoDosFeriados, FeriadosDoAno>({
  nome: 'feriado.do-ano',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaAnoDosFeriados,
  executar: async ({ ano }, contexto) => {
    const anoEscolhido = ano ?? Number(dataOperacional().slice(0, 4));
    const linhas = await feriadosDoPeriodo(
      contexto.tx,
      `${anoEscolhido}-01-01`,
      `${anoEscolhido}-12-31`,
    );
    const feriados = linhas.map((linha) => ({
      id: linha.id,
      data: comoDataIso(linha.data),
      nome: linha.nome,
    }));
    return {
      ano: anoEscolhido,
      feriados,
      nacionaisQueFaltam: feriadosQueFaltam(
        feriadosNacionais(anoEscolhido),
        new Set(feriados.map((feriado) => feriado.data)),
      ).length,
    };
  },
});

export const cadastrarFeriado = definirAcao<EntradaCriarFeriado, { id: string }>({
  nome: 'feriado.criar',
  perfis: ['ADMIN'],
  esquema: esquemaCriarFeriado,
  executar: async (dados, contexto) => {
    if (await buscarFeriadoPorData(contexto.tx, dados.data)) {
      throw new ErroDeConflito(CodigoErro.CONFLITO, 'Já existe um feriado nesta data.', {
        data: 'Data já cadastrada.',
      });
    }
    const feriado = await criarFeriado(contexto.tx, { ...dados, criadoPor: contexto.usuario.id });
    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'feriado',
      entidadeId: feriado.id,
      valorNovo: dados,
    });
    return feriado;
  },
});

export const adicionarNacionais = definirAcao<EntradaNacionaisDoAno, { adicionados: number }>({
  nome: 'feriado.nacionais',
  perfis: ['ADMIN'],
  esquema: esquemaNacionaisDoAno,
  executar: async ({ ano }, contexto) => {
    const existentes = await feriadosDoPeriodo(contexto.tx, `${ano}-01-01`, `${ano}-12-31`);
    const faltam = feriadosQueFaltam(
      feriadosNacionais(ano),
      new Set(existentes.map((feriado) => comoDataIso(feriado.data))),
    );
    const adicionados =
      faltam.length === 0 ? 0 : await criarFeriados(contexto.tx, faltam, contexto.usuario.id);
    if (adicionados > 0) {
      contexto.auditar({
        acao: 'CRIAR',
        entidade: 'feriado',
        valorNovo: { nacionaisDe: ano, adicionados, datas: faltam.map((f) => f.data).join(',') },
      });
    }
    return { adicionados };
  },
});

export const excluirFeriado = definirAcao<EntradaRemoverFeriado, { ok: true }>({
  nome: 'feriado.remover',
  perfis: ['ADMIN'],
  esquema: esquemaRemoverFeriado,
  executar: async ({ id }, contexto) => {
    const feriado = await buscarFeriado(contexto.tx, id);
    if (!feriado) throw new ErroNaoEncontrado('Feriado não encontrado.');
    await removerFeriado(contexto.tx, id);
    contexto.auditar({
      acao: 'EXCLUIR',
      entidade: 'feriado',
      entidadeId: id,
      valorAnterior: { data: comoDataIso(feriado.data), nome: feriado.nome },
    });
    return { ok: true };
  },
});
