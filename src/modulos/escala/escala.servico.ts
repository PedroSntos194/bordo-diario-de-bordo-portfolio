import { z } from 'zod';
import { definirAcao } from '@/lib/acao-segura';
import { CodigoErro, ErroDeNegocio, ErroNaoEncontrado } from '@/lib/erros';
import {
  buscarEscalaPorId,
  criarEscala,
  escalasDoDia,
  escalasDoMotorista,
  escalasDoVeiculo,
  removerEscala,
  type EscalaDaTela,
  folgasDoDia,
  buscarFolga,
  salvarFolga,
  desativarFolga,
  folgaDoMotorista,
  escalasNoPeriodo,
  folgasNoPeriodo,
} from '@/modulos/escala/escala.repositorio';
import {
  chaveDaFolga,
  compararComEscala,
  datasDaRepeticao,
  planejarRepeticao,
  validarMotoristaLivre,
  validarVeiculoLivre,
  type DivergenciaDaEscala,
  type EscalaExistente,
  type ModeloDeEscala,
  type MotivoDoPulo,
  type OcupacaoDoDia,
  type TurnoDaEscala,
} from '@/modulos/escala/escala.regras';
import {
  esquemaCriarEscala,
  esquemaDiaDaEscala,
  esquemaRemoverEscala,
  esquemaRepetirEscala,
  type EntradaCriarEscala,
  type EntradaDiaDaEscala,
  type EntradaRemoverEscala,
  type EntradaRepetirEscala,
  esquemaRegistrarFolga,
  type EntradaRegistrarFolga,
} from '@/modulos/escala/escala.schema';
import { listarUsuarios } from '@/modulos/usuario/usuario.repositorio';
import { buscarVeiculoPorId, listarVeiculos } from '@/modulos/veiculo/veiculo.repositorio';
import { buscarRotaPorId, listarRotasAtivas } from '@/modulos/rota/rota.repositorio';
import { buscarPorId as buscarUsuarioPorId } from '@/modulos/usuario/usuario.repositorio';
import { buscarJornadaCompleta } from '@/modulos/jornada/jornada.repositorio';
import { comoDataIso, dataOperacional } from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

/**
 * Escala do dia (US014 · RF013 · RN013).
 *
 * A escala **não trava** a operação: ela pré-preenche a abertura da jornada e
 * serve de referência para o painel apontar divergência. Se a van escalada
 * quebrou, o motorista pega outra e registra normalmente — impedir faria o dia
 * parar por causa de um planejamento feito na véspera.
 */

export interface PainelDaEscala {
  data: string;
  escalas: EscalaDaTela[];
  folgas: Awaited<ReturnType<typeof folgasDoDia>>;
  motoristas: { id: string; nome: string }[];
  veiculos: { id: string; placa: string; modelo: string }[];
  rotas: { id: string; codigo: string; nome: string }[];
}

export const painelDoDia = definirAcao<EntradaDiaDaEscala, PainelDaEscala>({
  nome: 'escala.painel',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaDiaDaEscala,
  executar: async ({ data }, contexto) => {
    const dia = data ?? dataOperacional();

    const [escalas, folgas, motoristas, veiculos, rotas] = await Promise.all([
      escalasDoDia(contexto.tx, dia),
      folgasDoDia(contexto.tx, dia),
      listarUsuarios(contexto.tx, {
        perfil: 'MOTORISTA',
        status: 'ATIVO',
        ordenar: 'nome',
        direcao: 'asc',
        skip: 0,
        take: 200,
      }),
      listarVeiculos(contexto.tx, {
        status: 'ATIVO',
        ordenar: 'placa',
        direcao: 'asc',
        skip: 0,
        take: 200,
      }),
      listarRotasAtivas(contexto.tx),
    ]);

    return {
      data: dia,
      escalas,
      folgas,
      // Só ativos entram nas listas: escalar quem está afastado ou uma van em
      // manutenção produz um plano que a abertura da jornada vai recusar
      // (RN013), e a recusa apareceria só no dia seguinte, com o motorista na
      // porta da van.
      motoristas: motoristas.usuarios.map((usuario) => ({ id: usuario.id, nome: usuario.nome })),
      veiculos: veiculos.veiculos.map((veiculo) => ({
        id: veiculo.id,
        placa: veiculo.placa,
        modelo: veiculo.modelo,
      })),
      rotas: rotas.map((rota) => ({ id: rota.id, codigo: rota.codigo, nome: rota.nome })),
    };
  },
});

export const registrarFolga = definirAcao<EntradaRegistrarFolga, { id: string }>({
  nome: 'escala.registrar-folga',
  perfis: ['ADMIN'],
  esquema: esquemaRegistrarFolga,
  executar: async (dados, contexto) => {
    const motorista = await buscarUsuarioPorId(contexto.tx, dados.motoristaId);
    if (!motorista || motorista.perfil !== 'MOTORISTA')
      throw new ErroNaoEncontrado('Motorista não encontrado.');
    const atual = await folgaDoMotorista(contexto.tx, dados.motoristaId, dados.data);
    const folga = await salvarFolga(contexto.tx, {
      ...dados,
      observacoes: dados.observacoes || null,
      usuarioId: contexto.usuario.id,
    });
    contexto.auditar({
      acao: atual ? 'ATUALIZAR' : 'CRIAR',
      entidade: 'folga',
      entidadeId: folga.id,
      ...(atual ? { valorAnterior: { ativa: atual.ativa, observacoes: atual.observacoes } } : {}),
      valorNovo: {
        data: dados.data,
        motorista: motorista.nome,
        ativa: true,
        observacoes: folga.observacoes,
      },
    });
    return { id: folga.id };
  },
});

export const removerFolga = definirAcao<EntradaRemoverEscala, { ok: true }>({
  nome: 'escala.remover-folga',
  perfis: ['ADMIN'],
  esquema: esquemaRemoverEscala,
  executar: async ({ id }, contexto) => {
    const atual = await buscarFolga(contexto.tx, id);
    if (!atual) throw new ErroNaoEncontrado('Folga não encontrada.');
    await desativarFolga(contexto.tx, id, contexto.usuario.id);
    contexto.auditar({
      acao: 'ATUALIZAR',
      entidade: 'folga',
      entidadeId: id,
      valorAnterior: { ativa: atual.ativa },
      valorNovo: { ativa: false },
    });
    return { ok: true };
  },
});

export const escalar = definirAcao<EntradaCriarEscala, { id: string }>({
  nome: 'escala.criar',
  perfis: ['ADMIN'],
  esquema: esquemaCriarEscala,
  executar: async (dados, contexto) => {
    const [motorista, veiculo] = await Promise.all([
      buscarUsuarioPorId(contexto.tx, dados.motoristaId),
      buscarVeiculoPorId(contexto.tx, dados.veiculoId),
    ]);

    if (!motorista) throw new ErroNaoEncontrado('Motorista não encontrado.');
    if (!veiculo) throw new ErroNaoEncontrado('Veículo não encontrado.');

    if (motorista.status !== 'ATIVO') {
      throw new ErroDeNegocio(
        CodigoErro.CONTA_INATIVA,
        `${motorista.nome} não está ativo e não pode ser escalado.`,
        { motoristaId: 'Motorista inativo.' },
      );
    }

    // RN013 — só veículo ativo entra em jornada; escalar um em manutenção
    // criaria um plano que a abertura vai recusar no dia seguinte.
    if (veiculo.status !== 'ATIVO') {
      throw new ErroDeNegocio(
        CodigoErro.VEICULO_INATIVO,
        'Esta van não está ativa e não pode ser escalada.',
        { veiculoId: 'Van inativa.' },
      );
    }

    for (const rotaId of dados.rotaIds) {
      const rota = await buscarRotaPorId(contexto.tx, rotaId);
      if (!rota) throw new ErroNaoEncontrado('Rota não encontrada.');
      if (rota.status !== 'ATIVA') {
        throw new ErroDeNegocio(
          CodigoErro.ROTA_INATIVA,
          `A rota ${rota.codigo} está inativa e não pode ser escalada.`,
          { rotaIds: 'Rota inativa.' },
        );
      }
    }

    const turno = dados.turno as TurnoDaEscala;

    const [naVan, comOMotorista] = await Promise.all([
      escalasDoVeiculo(contexto.tx, dados.veiculoId, dados.data),
      escalasDoMotorista(contexto.tx, dados.motoristaId, dados.data),
    ]);

    // O índice único do banco cobre o turno **igual**; estas verificações cobrem
    // o que ele não alcança — `INTEGRAL` contra um turno específico são valores
    // diferentes na coluna e passariam pela restrição.
    validarVeiculoLivre(turno, naVan as EscalaExistente[]);
    validarMotoristaLivre(
      turno,
      comOMotorista.map((escala) => ({
        turno: escala.turno as TurnoDaEscala,
        motorista: escala.motorista,
        veiculo: escala.veiculo,
      })),
    );

    const escala = await criarEscala(contexto.tx, {
      data: dados.data,
      motoristaId: dados.motoristaId,
      veiculoId: dados.veiculoId,
      turno: dados.turno,
      rotaIds: dados.rotaIds,
      criadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'escala',
      entidadeId: escala.id,
      valorNovo: {
        data: dados.data,
        motorista: motorista.nome,
        veiculo: veiculo.placa,
        turno: dados.turno,
        rotas: escala.rotas.map((ligacao) => ligacao.rota.codigo),
      },
    });

    return { id: escala.id };
  },
});

export interface ResultadoDaRepeticao {
  datas: number;
  criadas: number;
  puladas: { data: string; motorista: string; placa: string; motivo: MotivoDoPulo }[];
  /** Escalas do modelo que ficaram de fora inteiras: motorista ou van inativos. */
  ignoradas: string[];
}

/**
 * Copia a escala de um dia para os dias da semana marcados, até uma data.
 *
 * Grava linhas comuns de escala — a cobrança, a divergência e a abertura da
 * jornada não mudam. Não sobrescreve nada já planejado e não escala quem está
 * de folga; o que foi pulado volta na resposta, para a tela dizer.
 */
export const repetirEscala = definirAcao<EntradaRepetirEscala, ResultadoDaRepeticao>({
  nome: 'escala.repetir',
  perfis: ['ADMIN'],
  esquema: esquemaRepetirEscala,
  // Dois meses de uma frota pequena passam de algumas centenas de linhas; o
  // limite padrão da transação do Prisma (5 s) não comporta isso pela rede.
  tempoLimiteMs: 30_000,
  executar: async (dados, contexto) => {
    const datas = datasDaRepeticao(dados.dataOrigem, dados.ate, dados.diasDaSemana);

    const doDia = await escalasDoDia(contexto.tx, dados.dataOrigem);
    if (doDia.length === 0) {
      throw new ErroDeNegocio(
        CodigoErro.DADOS_INVALIDOS,
        'Não há ninguém escalado neste dia para repetir.',
      );
    }

    // Mesmas exigências da escala manual: motorista e van ativos, rotas ativas.
    // Rota inativa sai da cópia em vez de derrubar a escala inteira — a van e o
    // motorista continuam úteis para pré-preencher a abertura.
    const modelos: ModeloDeEscala[] = [];
    const ignoradas: string[] = [];
    for (const escala of doDia) {
      const [motorista, veiculo] = await Promise.all([
        buscarUsuarioPorId(contexto.tx, escala.motorista.id),
        buscarVeiculoPorId(contexto.tx, escala.veiculo.id),
      ]);
      if (motorista?.status !== 'ATIVO' || veiculo?.status !== 'ATIVO') {
        ignoradas.push(`${escala.motorista.nome} · van ${formatarPlaca(escala.veiculo.placa)}`);
        continue;
      }

      const rotaIds: string[] = [];
      for (const ligacao of escala.rotas) {
        const rota = await buscarRotaPorId(contexto.tx, ligacao.rota.id);
        if (rota?.status === 'ATIVA') rotaIds.push(rota.id);
      }

      modelos.push({
        motoristaId: escala.motorista.id,
        motoristaNome: escala.motorista.nome,
        veiculoId: escala.veiculo.id,
        placa: escala.veiculo.placa,
        turno: escala.turno as TurnoDaEscala,
        rotaIds,
      });
    }

    const primeira = datas[0];
    const ultima = datas.at(-1);
    if (!primeira || !ultima || modelos.length === 0) {
      return { datas: datas.length, criadas: 0, puladas: [], ignoradas };
    }

    const [existentes, folgas] = await Promise.all([
      escalasNoPeriodo(contexto.tx, primeira, ultima),
      folgasNoPeriodo(contexto.tx, primeira, ultima),
    ]);

    const ocupacao = new Map<string, OcupacaoDoDia[]>();
    for (const escala of existentes) {
      const data = comoDataIso(escala.data);
      const lista = ocupacao.get(data) ?? [];
      lista.push({
        motoristaId: escala.motoristaId,
        veiculoId: escala.veiculoId,
        turno: escala.turno as TurnoDaEscala,
      });
      ocupacao.set(data, lista);
    }
    const chavesDeFolga = new Set(
      folgas.map((folga) => chaveDaFolga(comoDataIso(folga.data), folga.motoristaId)),
    );

    const plano = planejarRepeticao(modelos, datas, ocupacao, chavesDeFolga);

    for (const { data, modelo } of plano.criar) {
      await criarEscala(contexto.tx, {
        data,
        motoristaId: modelo.motoristaId,
        veiculoId: modelo.veiculoId,
        turno: modelo.turno,
        rotaIds: modelo.rotaIds,
        criadoPor: contexto.usuario.id,
      });
    }

    // Um registro para a operação inteira, e não um por linha: centenas de
    // entradas iguais enterrariam a trilha, e o que se quer saber depois é
    // quem repetiu qual dia, até quando e quanto entrou.
    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'escala',
      valorNovo: {
        repeticaoDe: dados.dataOrigem,
        ate: dados.ate,
        diasDaSemana: dados.diasDaSemana.join(','),
        criadas: plano.criar.length,
        puladas: plano.puladas.length,
        ignoradas: ignoradas.length,
      },
    });

    return {
      datas: datas.length,
      criadas: plano.criar.length,
      puladas: plano.puladas,
      ignoradas,
    };
  },
});

export const desfazerEscala = definirAcao<EntradaRemoverEscala, { ok: true }>({
  nome: 'escala.remover',
  perfis: ['ADMIN'],
  esquema: esquemaRemoverEscala,
  executar: async ({ id }, contexto) => {
    const escala = await buscarEscalaPorId(contexto.tx, id);
    if (!escala) throw new ErroNaoEncontrado('Escala não encontrada.');

    contexto.auditar({
      acao: 'EXCLUIR',
      entidade: 'escala',
      entidadeId: id,
      valorAnterior: {
        motorista: escala.motorista.nome,
        veiculo: escala.veiculo.placa,
        turno: escala.turno,
        rotas: escala.rotas.map((ligacao) => ligacao.rota.codigo),
      },
    });

    await removerEscala(contexto.tx, id);

    return { ok: true };
  },
});

/**
 * A escala do motorista para hoje, para pré-preencher a abertura da jornada.
 *
 * Sem perfil declarado: quem consulta é o próprio motorista, e o caso de uso
 * usa o id da sessão — não há como pedir a escala de outra pessoa.
 */
export interface EscalaDeHoje {
  veiculoId: string | null;
  placa: string | null;
  rotaIds: string[];
  turno: TurnoDaEscala | null;
}

export const minhaEscalaDeHoje = definirAcao<void, EscalaDeHoje>({
  nome: 'escala.minha-de-hoje',
  semTransacao: true,
  executar: async (_dados, contexto) => {
    const escalas = await escalasDoMotorista(contexto.tx, contexto.usuario.id, dataOperacional());

    // Com mais de uma escala no dia (manhã e tarde em vans diferentes), a
    // primeira é a que pré-preenche. Escolher a "certa" exigiria saber a hora
    // do turno, que o sistema não modela — e errar o palpite seria pior do que
    // pré-preencher o primeiro e deixar o motorista trocar.
    const primeira = escalas[0];
    if (!primeira) return { veiculoId: null, placa: null, rotaIds: [], turno: null };

    return {
      veiculoId: primeira.veiculo.id,
      placa: primeira.veiculo.placa,
      rotaIds: primeira.rotas.map((ligacao) => ligacao.rota.id),
      turno: primeira.turno as TurnoDaEscala,
    };
  },
});

/**
 * Comparação entre o dia planejado e o dia que aconteceu (US014).
 *
 * "A divergência é sinalizada ao administrador" é critério de aceitação, e a
 * comparação é feita **na leitura**, contra a escala vigente — não gravada na
 * jornada no momento da abertura. A diferença aparece quando o administrador
 * corrige a escala depois: o aviso some, porque o plano e o registro voltaram a
 * combinar. Congelar a comparação manteria um alerta sobre um desencontro que
 * já não existe.
 */
export const divergenciaDaJornada = definirAcao<{ jornadaId: string }, DivergenciaDaEscala>({
  nome: 'escala.divergencia',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: z.object({ jornadaId: z.string().uuid() }),
  executar: async ({ jornadaId }, contexto) => {
    const jornada = await buscarJornadaCompleta(contexto.tx, jornadaId);
    if (!jornada) throw new ErroNaoEncontrado('Jornada não encontrada.');

    const escalas = await escalasDoMotorista(
      contexto.tx,
      jornada.motoristaId,
      comoDataIso(jornada.data),
    );

    // Com mais de uma escala no dia, compara com a do veículo que ele usou —
    // e, na falta dela, com a primeira. É o que evita acusar divergência de
    // quem simplesmente cumpriu o segundo turno do próprio planejamento.
    const escolhida =
      escalas.find((escala) => escala.veiculo.id === jornada.veiculo.id) ?? escalas[0];

    const rotasUsadas = jornada.corridas
      .map((corrida) => corrida.rota)
      .filter((rota): rota is { id: string; codigo: string; nome: string } => rota !== null);

    return compararComEscala(
      escolhida
        ? {
            veiculoId: escolhida.veiculo.id,
            placa: escolhida.veiculo.placa,
            turno: escolhida.turno as TurnoDaEscala,
            rotas: escolhida.rotas.map((ligacao) => ({
              id: ligacao.rota.id,
              codigo: ligacao.rota.codigo,
            })),
          }
        : null,
      {
        veiculoId: jornada.veiculo.id,
        placa: jornada.veiculo.placa,
        // Rotas distintas: a mesma rota rodada três vezes é uma rota cumprida.
        rotasUsadas: [...new Map(rotasUsadas.map((rota) => [rota.id, rota])).values()],
      },
    );
  },
});
