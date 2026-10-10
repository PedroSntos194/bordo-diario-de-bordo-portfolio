import { definirAcao } from '@/lib/acao-segura';
import { ErroNaoEncontrado } from '@/lib/erros';
import { jornadaAbertaDoMotorista } from '@/modulos/jornada/jornada.repositorio';
import { criarPedagio, pedagiosDaJornada } from '@/modulos/pedagio/pedagio.repositorio';
import {
  esquemaRegistrarPedagio,
  type EntradaRegistrarPedagio,
} from '@/modulos/pedagio/pedagio.schema';
import type { FormaDePagamento } from '@/modulos/pedagio/pedagio.regras';

/** Pedágio registrado pelo motorista no dia de trabalho. */

export const registrar = definirAcao<EntradaRegistrarPedagio, { id: string }>({
  nome: 'pedagio.registrar',
  esquema: esquemaRegistrarPedagio,
  executar: async (dados, contexto) => {
    const jornada = await jornadaAbertaDoMotorista(contexto.tx, contexto.usuario.id);
    if (!jornada) {
      throw new ErroNaoEncontrado('Você precisa ter o dia aberto para registrar um pedágio.');
    }

    const pedagio = await criarPedagio(contexto.tx, {
      jornadaId: jornada.id,
      veiculoId: jornada.veiculo.id,
      pagoEm: new Date(),
      valor: dados.valor,
      praca: dados.praca?.trim() || null,
      formaPagamento: dados.formaPagamento,
      criadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'pedagio',
      entidadeId: pedagio.id,
      valorNovo: {
        jornadaId: jornada.id,
        veiculo: jornada.veiculo.placa,
        valor: dados.valor,
        praca: dados.praca?.trim() || null,
        formaPagamento: dados.formaPagamento,
      },
    });

    return pedagio;
  },
});

export interface PedagiosDoMeuDia {
  placa: string | null;
  pedagios: {
    id: string;
    pagoEm: Date;
    valor: number;
    praca: string | null;
    formaPagamento: FormaDePagamento;
  }[];
  total: number;
}

export const doMeuDia = definirAcao<void, PedagiosDoMeuDia>({
  nome: 'pedagio.meu-dia',
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const jornada = await jornadaAbertaDoMotorista(contexto.tx, contexto.usuario.id);
    if (!jornada) return { placa: null, pedagios: [], total: 0 };

    const pedagios = (await pedagiosDaJornada(contexto.tx, jornada.id)).map((pedagio) => ({
      ...pedagio,
      valor: Number(pedagio.valor),
    }));
    return {
      placa: jornada.veiculo.placa,
      pedagios,
      total: Math.round(pedagios.reduce((soma, p) => soma + p.valor * 100, 0)) / 100,
    };
  },
});
