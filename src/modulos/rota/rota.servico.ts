import { definirAcao } from '@/lib/acao-segura';
import { CodigoErro, ErroDeConflito, ErroNaoEncontrado } from '@/lib/erros';
import { montarPagina, paraIntervalo, type DadosPaginados } from '@/lib/paginacao';
import {
  alterarStatusRota,
  atualizarRota,
  buscarRotaPorId,
  contarRotas,
  criarRota,
  existeOutraComCodigo,
  listarRotas,
  listarRotasAtivas,
  substituirPontos,
  type Rota,
  type RotaDaListagem,
  type RotaDetalhada,
} from '@/modulos/rota/rota.repositorio';
import {
  esquemaAlterarStatusRota,
  esquemaCriarRota,
  esquemaEditarRota,
  esquemaListarRotas,
  esquemaSalvarPontos,
  type EntradaAlterarStatusRota,
  type EntradaCriarRota,
  type EntradaEditarRota,
  type EntradaListarRotas,
  type EntradaSalvarPontos,
} from '@/modulos/rota/rota.schema';

/** Casos de uso de rotas e pontos de parada (US012, US013). */

function ouNulo(valor: string | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

export const listar = definirAcao<
  EntradaListarRotas,
  DadosPaginados<RotaDaListagem> & { totalCadastrado: number }
>({
  nome: 'rota.listar',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaListarRotas,
  executar: async (filtros, contexto) => {
    const { skip, take } = paraIntervalo(filtros);

    const { rotas, total } = await listarRotas(contexto.tx, {
      busca: filtros.busca,
      turno: filtros.turno,
      status: filtros.status,
      ordenar: filtros.ordenar,
      direcao: filtros.direcao,
      skip,
      take,
    });

    return {
      ...montarPagina(rotas, total, filtros),
      totalCadastrado: await contarRotas(contexto.tx),
    };
  },
});

export const obter = definirAcao<{ id: string }, RotaDetalhada>({
  nome: 'rota.obter',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaAlterarStatusRota.pick({ id: true }),
  executar: async ({ id }, contexto) => {
    const rota = await buscarRotaPorId(contexto.tx, id);
    if (!rota) throw new ErroNaoEncontrado('Rota não encontrada.');
    return rota;
  },
});

/** Rotas que o motorista pode escolher (RN021 — inativas não aparecem). */
export const ativas = definirAcao<void, Awaited<ReturnType<typeof listarRotasAtivas>>>({
  nome: 'rota.ativas',
  semTransacao: true,
  executar: async (_dados, contexto) => listarRotasAtivas(contexto.tx),
});

export const criar = definirAcao<EntradaCriarRota, Rota>({
  nome: 'rota.criar',
  perfis: ['ADMIN'],
  esquema: esquemaCriarRota,
  executar: async (dados, contexto) => {
    if (await existeOutraComCodigo(contexto.tx, dados.codigo)) {
      throw new ErroDeConflito(CodigoErro.CODIGO_DUPLICADO, 'Já existe uma rota com este código.', {
        codigo: 'Código já utilizado.',
      });
    }

    const rota = await criarRota(contexto.tx, {
      codigo: dados.codigo,
      nome: dados.nome,
      origem: dados.origem,
      destino: dados.destino,
      turno: dados.turno,
      distanciaEstimadaKm: dados.distanciaEstimadaKm ?? null,
      criadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'rota',
      entidadeId: rota.id,
      valorNovo: { codigo: rota.codigo, nome: rota.nome, turno: rota.turno },
    });

    return rota;
  },
});

export const editar = definirAcao<EntradaEditarRota, Rota>({
  nome: 'rota.editar',
  perfis: ['ADMIN'],
  esquema: esquemaEditarRota,
  executar: async (dados, contexto) => {
    const atual = await buscarRotaPorId(contexto.tx, dados.id);
    if (!atual) throw new ErroNaoEncontrado('Rota não encontrada.');

    if (
      dados.codigo !== atual.codigo &&
      (await existeOutraComCodigo(contexto.tx, dados.codigo, dados.id))
    ) {
      throw new ErroDeConflito(CodigoErro.CODIGO_DUPLICADO, 'Já existe uma rota com este código.', {
        codigo: 'Código já utilizado.',
      });
    }

    const atualizada = await atualizarRota(contexto.tx, dados.id, {
      codigo: dados.codigo,
      nome: dados.nome,
      origem: dados.origem,
      destino: dados.destino,
      turno: dados.turno,
      distanciaEstimadaKm: dados.distanciaEstimadaKm ?? null,
      atualizadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'rota',
      entidadeId: dados.id,
      valorAnterior: {
        codigo: atual.codigo,
        nome: atual.nome,
        origem: atual.origem,
        destino: atual.destino,
        turno: atual.turno,
      },
      valorNovo: {
        codigo: atualizada.codigo,
        nome: atualizada.nome,
        origem: atualizada.origem,
        destino: atualizada.destino,
        turno: atualizada.turno,
      },
    });

    return atualizada;
  },
});

/**
 * RN021 — rota inativa some da seleção de novas corridas, mas continua
 * aparecendo nas corridas históricas que a referenciam. Por isso rota não é
 * excluída, só desativada.
 */
export const mudarStatus = definirAcao<EntradaAlterarStatusRota, { status: string }>({
  nome: 'rota.mudar-status',
  perfis: ['ADMIN'],
  esquema: esquemaAlterarStatusRota,
  executar: async (dados, contexto) => {
    const atual = await buscarRotaPorId(contexto.tx, dados.id);
    if (!atual) throw new ErroNaoEncontrado('Rota não encontrada.');

    if (atual.status === dados.status) {
      throw new ErroDeConflito(CodigoErro.CONFLITO, 'A rota já está com este status.');
    }

    await alterarStatusRota(contexto.tx, dados.id, dados.status, contexto.usuario.id);

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'rota',
      entidadeId: dados.id,
      valorAnterior: { status: atual.status },
      valorNovo: { status: dados.status },
    });

    return { status: dados.status };
  },
});

export const salvarPontos = definirAcao<EntradaSalvarPontos, { quantidade: number }>({
  nome: 'rota.salvar-pontos',
  perfis: ['ADMIN'],
  esquema: esquemaSalvarPontos,
  executar: async (dados, contexto) => {
    const rota = await buscarRotaPorId(contexto.tx, dados.rotaId);
    if (!rota) throw new ErroNaoEncontrado('Rota não encontrada.');

    // Coordenada só é gravada quando o par está completo: metade de um ponto no
    // mapa não posiciona nada e ainda daria a impressão de que há localização.
    const pontos = dados.pontos.map((ponto) => {
      const temPar =
        ponto.latitude !== null &&
        ponto.latitude !== undefined &&
        ponto.longitude !== null &&
        ponto.longitude !== undefined;

      return {
        nome: ponto.nome,
        endereco: ouNulo(ponto.endereco),
        latitude: temPar ? (ponto.latitude as number) : null,
        longitude: temPar ? (ponto.longitude as number) : null,
      };
    });

    await substituirPontos(contexto.tx, dados.rotaId, pontos);

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'rota',
      entidadeId: dados.rotaId,
      valorAnterior: { quantidadeDePontos: rota.pontos.length },
      valorNovo: { quantidadeDePontos: pontos.length },
    });

    return { quantidade: pontos.length };
  },
});
