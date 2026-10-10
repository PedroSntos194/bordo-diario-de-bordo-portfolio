import { z } from 'zod';
import { definirAcao } from '@/lib/acao-segura';
import { ErroNaoEncontrado } from '@/lib/erros';
import {
  abastecimentosDaJornada,
  abastecimentosDoVeiculo,
  criarAbastecimento,
  type AbastecimentoDoVeiculo,
} from '@/modulos/abastecimento/abastecimento.repositorio';
import {
  calcularConsumo,
  validarOdometroDoAbastecimento,
  validarQuantidade,
  type ConsumoDoVeiculo,
} from '@/modulos/abastecimento/abastecimento.regras';
import {
  esquemaRegistrarAbastecimento,
  type EntradaRegistrarAbastecimento,
} from '@/modulos/abastecimento/abastecimento.schema';
import { jornadaAbertaDoMotorista } from '@/modulos/jornada/jornada.repositorio';
import { atualizarOdometro, buscarVeiculoPorId } from '@/modulos/veiculo/veiculo.repositorio';

/**
 * Registro de abastecimento (US024 · RF021 · RN020).
 *
 * Exige **jornada aberta**, e não é burocracia: o abastecimento pertence a um
 * dia de operação, e é o vínculo com a jornada que permite dizer depois quem
 * abasteceu e em que rodagem. Sem ele, o registro seria um número solto sem
 * responsável.
 *
 * O odômetro informado **move** o odômetro da van, como o encerramento da
 * jornada faz (RN020). É o mesmo painel sendo lido, e deixar os dois valores
 * divergirem faria a próxima abertura de jornada acusar divergência de uma
 * quilometragem que o próprio sistema já conhecia.
 */

export interface AbastecimentoRegistrado {
  id: string;
  odometro: number;
}

export const registrar = definirAcao<EntradaRegistrarAbastecimento, AbastecimentoRegistrado>({
  nome: 'abastecimento.registrar',
  esquema: esquemaRegistrarAbastecimento,
  executar: async (dados, contexto) => {
    const jornada = await jornadaAbertaDoMotorista(contexto.tx, contexto.usuario.id);
    if (!jornada) {
      throw new ErroNaoEncontrado('Você precisa ter o dia aberto para registrar um abastecimento.');
    }

    const veiculo = await buscarVeiculoPorId(contexto.tx, jornada.veiculo.id);
    if (!veiculo) throw new ErroNaoEncontrado('Veículo não encontrado.');

    validarQuantidade(dados.litros);
    validarOdometroDoAbastecimento(dados.odometro, veiculo.odometroAtual);

    const agora = new Date();

    const abastecimento = await criarAbastecimento(contexto.tx, {
      jornadaId: jornada.id,
      veiculoId: veiculo.id,
      abastecidoEm: agora,
      litros: dados.litros,
      valorTotal: dados.valorTotal ?? null,
      odometro: dados.odometro,
      posto: dados.posto?.trim() || null,
      tipoCombustivel: dados.tipoCombustivel,
      tanqueCheio: dados.tanqueCheio,
      criadoPor: contexto.usuario.id,
    });

    await atualizarOdometro(contexto.tx, veiculo.id, dados.odometro);

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'abastecimento',
      entidadeId: abastecimento.id,
      valorNovo: {
        jornadaId: jornada.id,
        veiculo: veiculo.placa,
        litros: dados.litros,
        odometro: dados.odometro,
        tipoCombustivel: dados.tipoCombustivel,
        tanqueCheio: dados.tanqueCheio,
      },
    });

    return { id: abastecimento.id, odometro: dados.odometro };
  },
});

export interface MeuDiaDeAbastecimento {
  /** Nulo quando o motorista não tem o dia aberto. */
  veiculo: { placa: string; odometroAtual: number } | null;
  abastecimentos: Awaited<ReturnType<typeof abastecimentosDaJornada>>;
}

/**
 * O que a tela do motorista precisa, numa chamada só.
 *
 * Inclui o odômetro atual da van — que a projeção de jornada não traz, e que
 * seria o segundo pedido ao servidor numa tela que o motorista abre no posto,
 * com a rede do celular. Mesma razão de `jornada.meuDia` devolver tudo junto.
 */
export const doMeuDia = definirAcao<void, MeuDiaDeAbastecimento>({
  nome: 'abastecimento.meu-dia',
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const jornada = await jornadaAbertaDoMotorista(contexto.tx, contexto.usuario.id);
    if (!jornada) return { veiculo: null, abastecimentos: [] };

    const veiculo = await buscarVeiculoPorId(contexto.tx, jornada.veiculo.id);

    return {
      veiculo: veiculo ? { placa: veiculo.placa, odometroAtual: veiculo.odometroAtual } : null,
      abastecimentos: await abastecimentosDaJornada(contexto.tx, jornada.id),
    };
  },
});

export interface RelatorioDoVeiculo {
  abastecimentos: AbastecimentoDoVeiculo[];
  consumo: ConsumoDoVeiculo;
}

/**
 * Abastecimentos e consumo médio de uma van (critério da US024).
 *
 * Leitura de administrador: o motorista registra, a administração compara. Um
 * consumo que cai de repente é sintoma mecânico antes de ser custo.
 */
export const relatorioDoVeiculo = definirAcao<{ veiculoId: string }, RelatorioDoVeiculo>({
  nome: 'abastecimento.relatorio-do-veiculo',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: z.object({ veiculoId: z.string().uuid() }),
  executar: async ({ veiculoId }, contexto) => {
    const abastecimentos = await abastecimentosDoVeiculo(contexto.tx, veiculoId);

    return {
      abastecimentos,
      consumo: calcularConsumo(
        abastecimentos.map((abastecimento) => ({
          odometro: abastecimento.odometro,
          litros: Number(abastecimento.litros),
          tanqueCheio: abastecimento.tanqueCheio,
          tipoCombustivel: abastecimento.tipoCombustivel,
        })),
      ),
    };
  },
});
