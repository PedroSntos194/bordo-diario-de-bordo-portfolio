import { definirAcao } from '@/lib/acao-segura';
import { ErroNaoEncontrado } from '@/lib/erros';
import {
  calcularTotaisDaJornada,
  validarEncerramentoDaJornada,
  validarOdometroDeEncerramento,
  validarReabertura,
} from '@/modulos/jornada/jornada.regras';
import {
  corridaEmAndamento,
  corridasDaJornada,
  maiorOdometroDaJornada,
} from '@/modulos/corrida/corrida.repositorio';
import {
  esquemaEncerrarJornada,
  type EntradaEncerrarJornada,
} from '@/modulos/corrida/corrida.schema';
import { comoDataIso, dataOperacional, formatarDataHora } from '@/utilitarios/data';
import { CHAVES, obterValor } from '@/modulos/configuracao/configuracao.repositorio';
import {
  TOLERANCIA_ODOMETRO_KM_PADRAO,
  horarioDoRegistro,
  validarOdometroDeAbertura,
  validarVeiculoParaJornada,
} from '@/modulos/jornada/jornada.regras';
import {
  abrirJornada,
  buscarJornadaDoDia,
  buscarJornadaPorId,
  buscarPorClientUuid,
  encerrarJornada,
  jornadaAbertaDoMotorista,
  reabrirJornada,
  type JornadaDoDia,
} from '@/modulos/jornada/jornada.repositorio';
import { buscarVeiculoPorId, jornadaAbertaDoVeiculo } from '@/modulos/veiculo/veiculo.repositorio';
import {
  cancelarResumosDaJornada,
  notificacoesDaJornada,
} from '@/modulos/notificacao/notificacao.repositorio';
import {
  esquemaAbrirJornada,
  esquemaReabrirJornada,
  type EntradaAbrirJornada,
  type EntradaReabrirJornada,
} from '@/modulos/jornada/jornada.schema';

/** Casos de uso da jornada (US016 · RF014). */

export interface EstadoDoDia {
  data: string;
  jornada: JornadaDoDia | null;
  /** Jornada aberta em outra data — acontece quando o motorista esquece de encerrar. */
  jornadaAbertaDeOutroDia: { id: string; data: Date; placa: string } | null;
  /**
   * Instante do envio do resumo ao administrador, quando já confirmado (US036).
   *
   * Vem daqui e não da tela porque o botão de envio precisa nascer no estado
   * certo: mostrar "enviar" para quem já enviou convida ao envio duplicado, e o
   * administrador recebendo o mesmo resumo três vezes é ruído que faz ele parar
   * de ler os resumos.
   */
  resumoEnviadoEm: Date | null;
}

/**
 * Estado da tela "Meu dia" (T04).
 *
 * Devolve tudo o que a tela precisa numa chamada só: o motorista abre o
 * aplicativo na porta da van, e duas requisições em sequência numa rede 3G
 * instável dobram a chance de ele ficar olhando para uma tela vazia.
 */
export const meuDia = definirAcao<void, EstadoDoDia>({
  nome: 'jornada.meu-dia',
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const hoje = dataOperacional();
    const jornada = await buscarJornadaDoDia(contexto.tx, contexto.usuario.id, hoje);

    // Jornada aberta ontem e não encerrada é pendência, e precisa aparecer:
    // sem isso o motorista abriria o dia de hoje sem entender por que a van
    // está ocupada (RN013).
    const aberta = jornada
      ? null
      : await jornadaAbertaDoMotorista(contexto.tx, contexto.usuario.id);

    // Só faz sentido perguntar por notificação de um dia já encerrado (RN017).
    const envios =
      jornada && jornada.status === 'ENCERRADA'
        ? await notificacoesDaJornada(contexto.tx, jornada.id)
        : [];

    return {
      data: hoje,
      jornada,
      jornadaAbertaDeOutroDia: aberta
        ? { id: aberta.id, data: aberta.data, placa: aberta.veiculo.placa }
        : null,
      resumoEnviadoEm: envios.find((envio) => envio.status === 'ENVIADA')?.enviadaEm ?? null,
    };
  },
});

export interface DiaParaEncerrar {
  jornada: JornadaDoDia;
  /** A jornada é de uma data anterior a hoje — o motorista esqueceu de encerrar. */
  deOutroDia: boolean;
}

/**
 * O dia que a tela de encerrar deve mostrar (T09 · US017).
 *
 * Usa **o mesmo critério da ação `encerrar`**: o dia em aberto do motorista,
 * de qualquer data, o mais antigo primeiro. É o que garante que o motorista
 * veja exatamente o dia que vai ser encerrado.
 *
 * Existia porque a tela perguntava ao `meuDia`, que só devolve a jornada **de
 * hoje** no campo `jornada`. Depois da meia-noite, com o dia anterior ainda
 * aberto, a tela não achava nada e voltava para o início — e o início, vendo o
 * dia pendente, mandava de novo para a tela de encerrar. O motorista ficava
 * preso nesse ciclo, sem conseguir fechar o dia antigo nem abrir o novo.
 * Achado no teste do GPS, num dia aberto às 23h57.
 */
export const diaParaEncerrar = definirAcao<void, DiaParaEncerrar | null>({
  nome: 'jornada.dia-para-encerrar',
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const aberta = await jornadaAbertaDoMotorista(contexto.tx, contexto.usuario.id);
    if (!aberta) return null;

    const dataDaJornada = comoDataIso(aberta.data);
    const jornada = await buscarJornadaDoDia(contexto.tx, contexto.usuario.id, dataDaJornada);
    if (!jornada) return null;

    return { jornada, deOutroDia: dataDaJornada !== dataOperacional() };
  },
});

export const abrir = definirAcao<EntradaAbrirJornada, { id: string; jaExistia: boolean }>({
  nome: 'jornada.abrir',
  esquema: esquemaAbrirJornada,
  executar: async (dados, contexto) => {
    // Registrado sem sinal, vale o horário do celular, e o dia é o desse
    // horário: aberto às 05:50 do dia 7 e enviado no dia 8, é do dia 7.
    const { instante: agora, peloAparelho } = horarioDoRegistro(new Date(), dados.ocorridoEm);
    const hoje = dataOperacional(agora);

    // Reenvio do mesmo registro criado offline não cria uma segunda jornada.
    if (dados.clientUuid) {
      const jaSincronizada = await buscarPorClientUuid(contexto.tx, dados.clientUuid);
      if (jaSincronizada) return { id: jaSincronizada.id, jaExistia: true };
    }

    // RN012 — segunda abertura no mesmo dia retoma a jornada existente em vez
    // de recusar: para o motorista, "iniciar meu dia" duas vezes não é erro.
    const existente = await buscarJornadaDoDia(contexto.tx, contexto.usuario.id, hoje);
    if (existente) return { id: existente.id, jaExistia: true };

    const veiculo = await buscarVeiculoPorId(contexto.tx, dados.veiculoId);
    if (!veiculo) throw new ErroNaoEncontrado('Veículo não encontrado.');

    const ocupado = await jornadaAbertaDoVeiculo(contexto.tx, dados.veiculoId);
    validarVeiculoParaJornada(veiculo.status, ocupado !== null);

    const tolerancia = await obterValor(
      contexto.tx,
      CHAVES.toleranciaOdometroKm,
      TOLERANCIA_ODOMETRO_KM_PADRAO,
    );

    validarOdometroDeAbertura({
      odometroInformado: dados.odometroInicial,
      odometroAtualDoVeiculo: veiculo.odometroAtual,
      confirmaDivergencia: dados.confirmaDivergencia,
      toleranciaKm: tolerancia,
    });

    const jornada = await abrirJornada(contexto.tx, {
      motoristaId: contexto.usuario.id,
      veiculoId: dados.veiculoId,
      dataIso: hoje,
      iniciadaEm: agora,
      inicioPeloAparelho: peloAparelho,
      odometroInicial: dados.odometroInicial,
      clientUuid: dados.clientUuid ?? null,
      criadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'jornada',
      entidadeId: jornada.id,
      valorNovo: {
        data: hoje,
        veiculo: veiculo.placa,
        odometroInicial: dados.odometroInicial,
        ...(peloAparelho ? { horarioDoCelular: agora.toISOString() } : {}),
      },
    });

    return { id: jornada.id, jaExistia: false };
  },
});

export interface ResumoDoEncerramento {
  totalCorridas: number;
  kmTotal: number;
  totalPassageiros: number;
  duracaoMinutos: number;
}

/**
 * RF019 · US017 — encerra o dia e consolida os totais.
 *
 * É aqui que a jornada passa a valer para relatório: só jornada encerrada entra
 * no resumo do dia e nos consolidados (RN017). Enquanto aberta, ela é pendência.
 */
export const encerrar = definirAcao<EntradaEncerrarJornada, ResumoDoEncerramento>({
  nome: 'jornada.encerrar',
  esquema: esquemaEncerrarJornada,
  executar: async (dados, contexto) => {
    const aberta = await jornadaAbertaDoMotorista(contexto.tx, contexto.usuario.id);
    if (!aberta) throw new ErroNaoEncontrado('Você não tem um dia em aberto.');

    const jornada = await buscarJornadaPorId(contexto.tx, aberta.id);
    if (!jornada) throw new ErroNaoEncontrado('Jornada não encontrada.');

    const emAndamento = await corridaEmAndamento(contexto.tx, contexto.usuario.id);

    validarEncerramentoDaJornada({
      status: jornada.status,
      temCorridaEmAndamento: emAndamento !== null,
    });

    validarOdometroDeEncerramento(
      dados.odometroFinal,
      jornada.odometroInicial,
      await maiorOdometroDaJornada(contexto.tx, jornada.id),
      jornada.veiculo.odometroAtual,
    );

    const corridas = await corridasDaJornada(contexto.tx, jornada.id);

    // Sem sinal, vale o horário do celular — nunca antes da abertura.
    const { instante: encerradaEm, peloAparelho } = horarioDoRegistro(
      new Date(),
      dados.ocorridoEm,
      jornada.iniciadaEm,
    );

    const totais = calcularTotaisDaJornada(
      corridas.map((corrida) => ({
        kmPercorrido: corrida.kmPercorrido === null ? null : Number(corrida.kmPercorrido),
        duracaoMinutos: corrida.duracaoMinutos,
        quantidadePassageiros: corrida.quantidadePassageiros,
        status: corrida.status,
      })),
      jornada.iniciadaEm,
      encerradaEm,
    );

    await encerrarJornada(contexto.tx, jornada.id, jornada.veiculo.id, {
      encerradaEm,
      fimPeloAparelho: peloAparelho,
      odometroFinal: dados.odometroFinal,
      kmTotal: totais.kmTotal,
      totalCorridas: totais.totalCorridas,
      totalPassageiros: totais.totalPassageiros,
      duracaoMinutos: totais.duracaoMinutos,
      observacoes: dados.observacoes?.trim() || null,
      atualizadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'jornada',
      entidadeId: jornada.id,
      valorAnterior: { status: 'ABERTA', odometroFinal: null },
      valorNovo: {
        status: 'ENCERRADA',
        odometroFinal: dados.odometroFinal,
        kmTotal: totais.kmTotal,
        totalCorridas: totais.totalCorridas,
      },
    });

    return totais;
  },
});

/**
 * Reabre o dia de hoje de um motorista (caso de 08/10: o motorista encerrou o
 * dia depois da primeira viagem e precisava sair de novo).
 *
 * Só a administração reabre, com motivo: a saída mais tarde muda a hora extra,
 * e reabrir para "sair depois" precisa de alguém que saiba o que aconteceu.
 */
export const reabrir = definirAcao<EntradaReabrirJornada, { id: string }>({
  nome: 'jornada.reabrir',
  perfis: ['ADMIN'],
  esquema: esquemaReabrirJornada,
  executar: async ({ id, motivo }, contexto) => {
    const jornada = await buscarJornadaPorId(contexto.tx, id);
    if (!jornada) throw new ErroNaoEncontrado('Jornada não encontrada.');

    const [doMotorista, daVan, veiculo] = await Promise.all([
      jornadaAbertaDoMotorista(contexto.tx, jornada.motoristaId),
      jornadaAbertaDoVeiculo(contexto.tx, jornada.veiculo.id),
      buscarVeiculoPorId(contexto.tx, jornada.veiculo.id),
    ]);
    if (!veiculo) throw new ErroNaoEncontrado('Veículo não encontrado.');

    validarReabertura({
      status: jornada.status,
      dataDaJornada: comoDataIso(jornada.data),
      hoje: dataOperacional(),
      motoristaTemOutroDiaAberto: doMotorista !== null && doMotorista.id !== id,
      vanEmUsoPorOutro: daVan !== null && daVan.id !== id,
    });
    validarVeiculoParaJornada(veiculo.status, daVan !== null && daVan.id !== id);

    await reabrirJornada(contexto.tx, id, contexto.usuario.id);
    const resumosCancelados = await cancelarResumosDaJornada(contexto.tx, id);

    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'jornada',
      entidadeId: id,
      valorAnterior: {
        status: 'ENCERRADA',
        encerradaEm: jornada.encerradaEm ? formatarDataHora(jornada.encerradaEm) : null,
        odometroFinal: jornada.odometroFinal,
      },
      valorNovo: { status: 'ABERTA', motivo, resumosCancelados },
    });

    return { id };
  },
});
