import { definirAcao } from '@/lib/acao-segura';
import { CodigoErro, ErroDeConflito, ErroNaoEncontrado } from '@/lib/erros';
import { montarPagina, paraIntervalo, type DadosPaginados } from '@/lib/paginacao';
import {
  alterarStatusVeiculo,
  atualizarVeiculo,
  buscarContratoDoVeiculo,
  buscarVeiculoPorId,
  contarVeiculos,
  criarVeiculo,
  existeOutroComPlaca,
  jornadaAbertaDoVeiculo,
  listarDisponiveis,
  listarVeiculos,
  salvarContratoDoVeiculo,
  type Veiculo,
  type VeiculoDisponivel,
} from '@/modulos/veiculo/veiculo.repositorio';
import {
  esquemaAlterarStatusVeiculo,
  esquemaContratoVeiculo,
  esquemaCriarVeiculo,
  esquemaEditarVeiculo,
  esquemaListarVeiculos,
  type EntradaAlterarStatusVeiculo,
  type EntradaContratoVeiculo,
  type EntradaCriarVeiculo,
  type EntradaEditarVeiculo,
  type EntradaListarVeiculos,
} from '@/modulos/veiculo/veiculo.schema';

/** Casos de uso de veículos (US011 · RF010). */

function ouNulo(valor: string | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

export const listar = definirAcao<
  EntradaListarVeiculos,
  DadosPaginados<Veiculo> & { totalCadastrado: number }
>({
  nome: 'veiculo.listar',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaListarVeiculos,
  executar: async (filtros, contexto) => {
    const { skip, take } = paraIntervalo(filtros);

    const { veiculos, total } = await listarVeiculos(contexto.tx, {
      busca: filtros.busca,
      status: filtros.status,
      ordenar: filtros.ordenar,
      direcao: filtros.direcao,
      skip,
      take,
    });

    return {
      ...montarPagina(veiculos, total, filtros),
      totalCadastrado: await contarVeiculos(contexto.tx),
    };
  },
});

export const obter = definirAcao<{ id: string }, Veiculo>({
  nome: 'veiculo.obter',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaAlterarStatusVeiculo.pick({ id: true }),
  executar: async ({ id }, contexto) => {
    const veiculo = await buscarVeiculoPorId(contexto.tx, id);
    if (!veiculo) throw new ErroNaoEncontrado('Veículo não encontrado.');
    return veiculo;
  },
});

/** Consumido pela tela de abertura de jornada (RF014 · RN013). */
export const disponiveis = definirAcao<void, VeiculoDisponivel[]>({
  nome: 'veiculo.disponiveis',
  semTransacao: true,
  executar: async (_dados, contexto) => listarDisponiveis(contexto.tx),
});

export const criar = definirAcao<EntradaCriarVeiculo, Veiculo>({
  nome: 'veiculo.criar',
  perfis: ['ADMIN'],
  esquema: esquemaCriarVeiculo,
  executar: async (dados, contexto) => {
    if (await existeOutroComPlaca(contexto.tx, dados.placa)) {
      throw new ErroDeConflito(CodigoErro.PLACA_DUPLICADA, 'Já existe um veículo com esta placa.', {
        placa: 'Placa já cadastrada.',
      });
    }

    const veiculo = await criarVeiculo(contexto.tx, {
      placa: dados.placa,
      modelo: dados.modelo,
      marca: ouNulo(dados.marca),
      ano: dados.ano ?? null,
      capacidadePassageiros: dados.capacidadePassageiros,
      observacoes: ouNulo(dados.observacoes),
      odometroAtual: dados.odometroAtual,
      criadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'veiculo',
      entidadeId: veiculo.id,
      valorNovo: {
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        capacidadePassageiros: veiculo.capacidadePassageiros,
        odometroAtual: veiculo.odometroAtual,
      },
    });

    return veiculo;
  },
});

export const editar = definirAcao<EntradaEditarVeiculo, Veiculo>({
  nome: 'veiculo.editar',
  perfis: ['ADMIN'],
  esquema: esquemaEditarVeiculo,
  executar: async (dados, contexto) => {
    const atual = await buscarVeiculoPorId(contexto.tx, dados.id);
    if (!atual) throw new ErroNaoEncontrado('Veículo não encontrado.');

    if (
      dados.placa !== atual.placa &&
      (await existeOutroComPlaca(contexto.tx, dados.placa, dados.id))
    ) {
      throw new ErroDeConflito(CodigoErro.PLACA_DUPLICADA, 'Já existe um veículo com esta placa.', {
        placa: 'Placa já cadastrada.',
      });
    }

    const atualizado = await atualizarVeiculo(contexto.tx, dados.id, {
      placa: dados.placa,
      modelo: dados.modelo,
      marca: ouNulo(dados.marca),
      ano: dados.ano ?? null,
      capacidadePassageiros: dados.capacidadePassageiros,
      observacoes: ouNulo(dados.observacoes),
      atualizadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'veiculo',
      entidadeId: dados.id,
      valorAnterior: {
        placa: atual.placa,
        modelo: atual.modelo,
        marca: atual.marca,
        ano: atual.ano,
        capacidadePassageiros: atual.capacidadePassageiros,
      },
      valorNovo: {
        placa: atualizado.placa,
        modelo: atualizado.modelo,
        marca: atualizado.marca,
        ano: atualizado.ano,
        capacidadePassageiros: atualizado.capacidadePassageiros,
      },
    });

    return atualizado;
  },
});

/**
 * RN013 — desativar veículo em jornada aberta é bloqueado.
 *
 * Não há exclusão de veículo: o histórico de jornadas referencia a van, e
 * apagá-la deixaria registros órfãos. O que existe é `INATIVO` (US011).
 */
export const mudarStatus = definirAcao<EntradaAlterarStatusVeiculo, { status: string }>({
  nome: 'veiculo.mudar-status',
  perfis: ['ADMIN'],
  esquema: esquemaAlterarStatusVeiculo,
  executar: async (dados, contexto) => {
    const atual = await buscarVeiculoPorId(contexto.tx, dados.id);
    if (!atual) throw new ErroNaoEncontrado('Veículo não encontrado.');

    if (atual.status === dados.status) {
      throw new ErroDeConflito(CodigoErro.CONFLITO, 'O veículo já está com este status.');
    }

    if (dados.status !== 'ATIVO') {
      const jornada = await jornadaAbertaDoVeiculo(contexto.tx, dados.id);
      if (jornada) {
        throw new ErroDeConflito(
          CodigoErro.VEICULO_EM_USO,
          `Esta van está em uma jornada em andamento de ${jornada.motorista.nome}. Encerre a jornada antes de alterar o status.`,
        );
      }
    }

    await alterarStatusVeiculo(contexto.tx, dados.id, dados.status, contexto.usuario.id);

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'veiculo',
      entidadeId: dados.id,
      valorAnterior: { status: atual.status },
      valorNovo: { status: dados.status },
    });

    return { status: dados.status };
  },
});

// ------------------------------------------------------------ contrato

export interface ContratoDaTela {
  id: string;
  placa: string;
  cliente: string | null;
  categoriaMedicao: 'ONIBUS' | 'VAN_DIURNA' | 'VAN_NOTURNA' | null;
  valorMensal: number | null;
  valorKmExcedido: number | null;
  valorDiaExtra: number | null;
  limiteKmDia: number | null;
  linhaOrigem: string | null;
  linhaDestino: string | null;
}

const numeroOuNulo = (valor: unknown): number | null => (valor === null ? null : Number(valor));

/** Contrato da van com o cliente, para o boletim de medição (pedido de 07/10). */
export const obterContrato = definirAcao<{ id: string }, ContratoDaTela>({
  nome: 'veiculo.contrato',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaAlterarStatusVeiculo.pick({ id: true }),
  executar: async ({ id }, contexto) => {
    const contrato = await buscarContratoDoVeiculo(contexto.tx, id);
    if (!contrato) throw new ErroNaoEncontrado('Veículo não encontrado.');
    return {
      id: contrato.id,
      placa: contrato.placa,
      cliente: contrato.cliente,
      categoriaMedicao: contrato.categoriaMedicao,
      valorMensal: numeroOuNulo(contrato.valorMensal),
      valorKmExcedido: numeroOuNulo(contrato.valorKmExcedido),
      valorDiaExtra: numeroOuNulo(contrato.valorDiaExtra),
      limiteKmDia: contrato.limiteKmDia,
      linhaOrigem: contrato.linhaOrigem,
      linhaDestino: contrato.linhaDestino,
    };
  },
});

export const salvarContrato = definirAcao<EntradaContratoVeiculo, { ok: true }>({
  nome: 'veiculo.salvar-contrato',
  perfis: ['ADMIN'],
  esquema: esquemaContratoVeiculo,
  executar: async ({ id, ...dados }, contexto) => {
    const anterior = await buscarContratoDoVeiculo(contexto.tx, id);
    if (!anterior) throw new ErroNaoEncontrado('Veículo não encontrado.');

    await salvarContratoDoVeiculo(contexto.tx, id, {
      ...dados,
      atualizadoPor: contexto.usuario.id,
    });

    // Valor de contrato muda a cobrança do cliente: fica na trilha, antes e depois.
    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'veiculo',
      entidadeId: id,
      valorAnterior: {
        cliente: anterior.cliente,
        categoriaMedicao: anterior.categoriaMedicao,
        valorMensal: numeroOuNulo(anterior.valorMensal),
        valorKmExcedido: numeroOuNulo(anterior.valorKmExcedido),
        valorDiaExtra: numeroOuNulo(anterior.valorDiaExtra),
        limiteKmDia: anterior.limiteKmDia,
        linhaOrigem: anterior.linhaOrigem,
        linhaDestino: anterior.linhaDestino,
      },
      valorNovo: dados,
    });

    return { ok: true };
  },
});
