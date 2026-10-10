import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { definirAcao, type ContextoDaAcao } from '@/lib/acao-segura';
import { logger } from '@/lib/logger';
import type { ClientePrisma } from '@/lib/prisma';
import { armazenarERegistrar } from '@/modulos/arquivo/arquivo.servico';
import { obterValor } from '@/modulos/configuracao/configuracao.repositorio';
import { valorPadraoDe } from '@/modulos/configuracao/configuracao.regras';
import { MIME_XLSX } from '@/modulos/exportacao/exportacao.regras';
import {
  arquivosDeFechamento,
  escalasNoturnasDoCiclo,
  fechamentoAutomaticoJaGerado,
  jornadasDoCiclo,
  type JornadaDoCiclo,
} from '@/modulos/fechamento/fechamento.repositorio';
import {
  avaliarHoraExtra,
  cicloAnterior,
  cicloQueContem,
  emCentavos,
  emReais,
  juntarDiasDoMotorista,
  kmDoDia,
  kmEntreCorridas,
  medirVan,
  montarLinhaDoMotorista,
  resumirMedicao,
  resumirPorMotorista,
  rotuloDoCiclo,
  type Ciclo,
  type ContratoDaVan,
  type DiaDaVan,
  type DiaDoMotorista,
  type LinhaDoMotorista,
  type MedicaoDaVan,
  type RegrasDeHoraExtra,
  type RegrasDeKm,
  type ResumoDaMedicao,
  type ResumoDoMotorista,
} from '@/modulos/fechamento/fechamento.regras';
import {
  planilhaDaMedicao,
  planilhaDosMotoristas,
} from '@/modulos/fechamento/fechamento.planilhas';
import { feriadosDoPeriodo } from '@/modulos/feriado/feriado.repositorio';
import {
  administradoresParaNotificar,
  registrarNotificacao,
} from '@/modulos/notificacao/notificacao.repositorio';
import { pedagiosDoPeriodo, totalPedagiosDoDia } from '@/modulos/pedagio/pedagio.repositorio';
import { contratosDosVeiculos } from '@/modulos/veiculo/veiculo.repositorio';
import { comoDataIso, dataOperacional } from '@/utilitarios/data';

/**
 * Fechamento mensal (observações do cliente de 07/10/2026).
 *
 * Junta jornadas, feriados, pedágios e contratos do ciclo e entrega as duas
 * contas de `fechamento.regras.ts`: o pagamento dos motoristas e o boletim de
 * medição do cliente. Só a administração vê — são valores de contrato e de
 * folha.
 */

// ------------------------------------------------------------ parâmetros

async function parametro<T>(cliente: ClientePrisma, chave: string): Promise<T> {
  return obterValor<T>(cliente, chave, valorPadraoDe(chave) as T);
}

export interface RegrasDoFechamento {
  diaInicio: number;
  horaExtra: RegrasDeHoraExtra;
  km: RegrasDeKm;
  divisor: number;
  /** Cabeçalho do boletim, como no BM atual. */
  boletim: { razaoSocial: string; contrato: string };
}

async function lerRegras(cliente: ClientePrisma): Promise<RegrasDoFechamento> {
  const [
    diaInicio,
    valorDiaria,
    exigeAmbas,
    limiteEntrada,
    saidaSegQui,
    saidaSexDom,
    saidaFeriado,
    noturnoInicio,
    noturnoFim,
    limiteDia,
    valorPorKm,
    divisor,
    razaoSocial,
    contrato,
  ] = await Promise.all([
    parametro<number>(cliente, 'ciclo_dia_inicio'),
    parametro<number>(cliente, 'he_valor_diaria'),
    parametro<boolean>(cliente, 'he_exige_ambas'),
    parametro<string>(cliente, 'he_limite_entrada'),
    parametro<string>(cliente, 'he_saida_seg_qui'),
    parametro<string>(cliente, 'he_saida_sex_dom'),
    parametro<string>(cliente, 'he_saida_feriado'),
    parametro<string>(cliente, 'he_noturno_inicio'),
    parametro<string>(cliente, 'he_noturno_fim'),
    parametro<number>(cliente, 'km_limite_dia'),
    parametro<number>(cliente, 'km_valor_motorista'),
    parametro<number>(cliente, 'medicao_divisor'),
    parametro<string>(cliente, 'empresa_razao_social'),
    parametro<string>(cliente, 'medicao_contrato'),
  ]);

  return {
    diaInicio,
    horaExtra: {
      limiteEntrada,
      saidaSegQui,
      saidaSexDom,
      saidaFeriado,
      noturnoInicio,
      noturnoFim,
      exigeAmbas,
      valorDiaria,
    },
    km: { limiteDia, valorPorKm },
    divisor,
    boletim: { razaoSocial, contrato },
  };
}

// ------------------------------------------------------------ cálculo

export interface PedagioDoFechamento {
  data: string;
  placa: string;
  motorista: string;
  pagoEm: Date;
  valor: number;
  praca: string | null;
  formaPagamento: 'DINHEIRO' | 'CARTAO' | 'TAG';
}

export interface Fechamento {
  ciclo: Ciclo;
  rotulo: string;
  regras: RegrasDoFechamento;
  feriados: { data: string; nome: string }[];
  linhas: LinhaDoMotorista[];
  motoristas: ResumoDoMotorista[];
  vans: MedicaoDaVan[];
  medicao: ResumoDaMedicao;
  pedagios: PedagioDoFechamento[];
  /** Soma das diárias de hora extra do ciclo, em reais. */
  totalHoraExtra: number;
  /** Veículos + hora extra + pedágios, como o total do boletim atual. */
  totalGeral: number;
  avisos: {
    diasParaConferir: number;
    diasAbertos: number;
    vansSemContrato: string[];
  };
}

const numeroOuNulo = (valor: unknown): number | null => (valor === null ? null : Number(valor));

/** Km do dia encerrado, sem o rodado entre as corridas; nulo se o dia está aberto. */
function kmDaJornada(jornada: JornadaDoCiclo): number | null {
  if (jornada.status !== 'ENCERRADA') return null;
  return kmDoDia(jornada.odometroInicial, jornada.odometroFinal, kmEntreCorridas(jornada.corridas));
}

/** `noturnos` tem `data|motoristaId` de quem foi escalado no turno da noite. */
function paraDiaDoMotorista(
  jornada: JornadaDoCiclo,
  noturnos: ReadonlySet<string>,
): DiaDoMotorista {
  const data = comoDataIso(jornada.data);
  const encerrada = jornada.status === 'ENCERRADA';
  return {
    data,
    iniciadaEm: jornada.iniciadaEm,
    encerradaEm: encerrada ? jornada.encerradaEm : null,
    // Escalado à noite, ou na van que o contrato diz noturna.
    noturno:
      noturnos.has(`${data}|${jornada.motorista.id}`) ||
      jornada.veiculo.categoriaMedicao === 'VAN_NOTURNA',
    inicioPeloAparelho: jornada.inicioPeloAparelho,
    fimPeloAparelho: jornada.fimPeloAparelho,
    motoristaId: jornada.motorista.id,
    motorista: jornada.motorista.nome,
    placa: jornada.veiculo.placa,
    km: kmDaJornada(jornada),
  };
}

async function calcular(
  cliente: ClientePrisma,
  ciclo: Ciclo,
  regras: RegrasDoFechamento,
): Promise<Fechamento> {
  const [jornadas, escalasNoturnas, feriadosGravados, pedagiosGravados, contratos] =
    await Promise.all([
      jornadasDoCiclo(cliente, ciclo.inicio, ciclo.fim),
      escalasNoturnasDoCiclo(cliente, ciclo.inicio, ciclo.fim),
      feriadosDoPeriodo(cliente, ciclo.inicio, ciclo.fim),
      pedagiosDoPeriodo(cliente, ciclo.inicio, ciclo.fim),
      contratosDosVeiculos(cliente),
    ]);

  const feriados = new Set(feriadosGravados.map((feriado) => comoDataIso(feriado.data)));
  const noturnos = new Set(
    escalasNoturnas.map((escala) => `${comoDataIso(escala.data)}|${escala.motoristaId}`),
  );

  // Pagamento dos motoristas: uma linha por motorista e dia — duas jornadas no
  // mesmo dia viram um dia só, com uma diária.
  const linhas = juntarDiasDoMotorista(
    jornadas.map((jornada) => paraDiaDoMotorista(jornada, noturnos)),
  ).map((dia) => montarLinhaDoMotorista(dia, feriados, regras.horaExtra, regras.km));

  // Boletim: as vans que trabalharam e as ativas que têm contrato.
  const diasPorVan = new Map<string, DiaDaVan[]>();
  for (const jornada of jornadas) {
    const dias = diasPorVan.get(jornada.veiculo.id) ?? [];
    dias.push({
      data: comoDataIso(jornada.data),
      motorista: jornada.motorista.nome,
      km: kmDaJornada(jornada),
    });
    diasPorVan.set(jornada.veiculo.id, dias);
  }

  const vans = contratos
    .filter(
      (contrato) =>
        diasPorVan.has(contrato.id) ||
        (contrato.status === 'ATIVO' && (contrato.valorMensal !== null || contrato.cliente)),
    )
    .map((contrato) => {
      const daVan: ContratoDaVan = {
        veiculoId: contrato.id,
        placa: contrato.placa,
        cliente: contrato.cliente,
        categoria: contrato.categoriaMedicao,
        valorMensal: numeroOuNulo(contrato.valorMensal),
        valorKmExcedido: numeroOuNulo(contrato.valorKmExcedido),
        valorDiaExtra: numeroOuNulo(contrato.valorDiaExtra),
        limiteKmDia: contrato.limiteKmDia,
        linhaOrigem: contrato.linhaOrigem,
        linhaDestino: contrato.linhaDestino,
      };
      return medirVan(
        daVan,
        diasPorVan.get(contrato.id) ?? [],
        feriados,
        regras.divisor,
        regras.km.limiteDia,
      );
    });

  const pedagios: PedagioDoFechamento[] = pedagiosGravados.map((pedagio) => ({
    data: comoDataIso(pedagio.jornada.data),
    placa: pedagio.veiculo.placa,
    motorista: pedagio.jornada.motorista.nome,
    pagoEm: pedagio.pagoEm,
    valor: Number(pedagio.valor),
    praca: pedagio.praca,
    formaPagamento: pedagio.formaPagamento,
  }));
  const totalPedagios = emReais(
    pedagios.reduce((soma, pedagio) => soma + emCentavos(pedagio.valor), 0),
  );

  const motoristas = resumirPorMotorista(linhas);
  const totalHoraExtra = emReais(
    motoristas.reduce((soma, motorista) => soma + emCentavos(motorista.valorHoraExtra), 0),
  );
  const medicao = resumirMedicao(vans, totalPedagios);

  return {
    ciclo,
    rotulo: rotuloDoCiclo(ciclo),
    regras,
    feriados: feriadosGravados.map((feriado) => ({
      data: comoDataIso(feriado.data),
      nome: feriado.nome,
    })),
    linhas,
    motoristas,
    vans,
    medicao,
    pedagios,
    totalHoraExtra,
    totalGeral: emReais(emCentavos(medicao.totalGeral) + emCentavos(totalHoraExtra)),
    avisos: {
      diasParaConferir: linhas.filter((linha) => linha.horaExtra.conferir.length > 0).length,
      diasAbertos: linhas.filter((linha) => linha.horaExtra.pendente).length,
      vansSemContrato: vans
        .filter((van) => van.contrato.valorMensal === null || van.contrato.categoria === null)
        .map((van) => van.contrato.placa),
    },
  };
}

// ------------------------------------------------------------ consulta

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');

const esquemaCiclo = z.object({ inicio: dataIso.optional() });

type EntradaCiclo = z.infer<typeof esquemaCiclo>;

/** Qualquer data do ciclo serve para escolhê-lo; sem data, é o ciclo de hoje. */
function cicloDaEntrada(entrada: EntradaCiclo, diaInicio: number): Ciclo {
  return cicloQueContem(entrada.inicio ?? dataOperacional(), diaInicio);
}

export interface FechamentoDaTela {
  fechamento: Fechamento;
  /** Os últimos ciclos, do atual para trás, para o seletor. */
  ciclos: { inicio: string; fim: string; rotulo: string }[];
  arquivos: {
    id: string;
    nome: string;
    tipo: string;
    ciclo: string | null;
    criadoEm: Date;
    autor: string;
  }[];
}

const CICLOS_NO_SELETOR = 6;

export const consultar = definirAcao<EntradaCiclo, FechamentoDaTela>({
  nome: 'fechamento.consultar',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaCiclo,
  executar: async (entrada, contexto) => {
    const regras = await lerRegras(contexto.tx);
    const ciclo = cicloDaEntrada(entrada, regras.diaInicio);

    const ciclos: Ciclo[] = [cicloQueContem(dataOperacional(), regras.diaInicio)];
    while (ciclos.length < CICLOS_NO_SELETOR) {
      ciclos.push(cicloAnterior(ciclos[ciclos.length - 1]!, regras.diaInicio));
    }

    const [fechamento, arquivos] = await Promise.all([
      calcular(contexto.tx, ciclo, regras),
      arquivosDeFechamento(contexto.tx, 12),
    ]);

    return {
      fechamento,
      ciclos: ciclos.map((item) => ({ ...item, rotulo: rotuloDoCiclo(item) })),
      arquivos: arquivos.map((arquivo) => {
        const parametros = (arquivo.parametros ?? {}) as {
          ciclo?: string;
          fim?: string;
          planilha?: string;
        };
        return {
          id: arquivo.id,
          nome: arquivo.nomeOriginal,
          tipo: parametros.planilha ?? '',
          ciclo:
            parametros.ciclo && parametros.fim
              ? rotuloDoCiclo({ inicio: parametros.ciclo, fim: parametros.fim })
              : null,
          criadoEm: arquivo.criadoEm,
          autor: arquivo.autor?.nome ?? 'Sistema (rotina automática)',
        };
      }),
    };
  },
});

// ------------------------------------------------------------ geração

export interface FechamentoGerado {
  ciclo: Ciclo;
  motoristas: { id: string; nome: string };
  medicao: { id: string; nome: string };
  jaGerado: boolean;
}

async function gerar(
  contexto: ContextoDaAcao,
  ciclo: Ciclo,
  regras: RegrasDoFechamento,
  geradoPor: string | null,
  autor: string,
): Promise<Omit<FechamentoGerado, 'jaGerado'>> {
  const agora = new Date();
  const fechamento = await calcular(contexto.tx, ciclo, regras);
  const cabecalho = { geradoEm: agora, geradoPor: autor };

  const [conteudoMotoristas, conteudoMedicao] = await Promise.all([
    planilhaDosMotoristas(fechamento, cabecalho),
    planilhaDaMedicao(fechamento, cabecalho),
  ]);

  const sufixo = `${ciclo.inicio}_a_${ciclo.fim}`;
  const nomeMotoristas = `bordo_pagamento-motoristas_${sufixo}.xlsx`;
  const nomeMedicao = `bordo_boletim-medicao_${sufixo}.xlsx`;

  // Um arquivo novo a cada geração (RN030): corrigir um dia e gerar de novo
  // não apaga o que já foi enviado.
  const motoristas = await armazenarERegistrar(contexto.tx, {
    tipo: 'FECHAMENTO_MENSAL',
    nome: nomeMotoristas,
    mimeType: MIME_XLSX,
    conteudo: conteudoMotoristas,
    parametros: {
      planilha: 'PAGAMENTO_MOTORISTAS',
      ciclo: ciclo.inicio,
      fim: ciclo.fim,
    } as Prisma.InputJsonValue,
    geradoPor,
    geradoEm: agora,
  });
  const medicao = await armazenarERegistrar(contexto.tx, {
    tipo: 'FECHAMENTO_MENSAL',
    nome: nomeMedicao,
    mimeType: MIME_XLSX,
    conteudo: conteudoMedicao,
    parametros: {
      planilha: 'BOLETIM_MEDICAO',
      ciclo: ciclo.inicio,
      fim: ciclo.fim,
    } as Prisma.InputJsonValue,
    geradoPor,
    geradoEm: agora,
  });

  for (const arquivo of [
    { id: motoristas.id, nome: nomeMotoristas },
    { id: medicao.id, nome: nomeMedicao },
  ]) {
    contexto.auditar({
      acao: 'EXPORTAR',
      entidade: 'arquivo',
      entidadeId: arquivo.id,
      valorNovo: {
        tipo: 'FECHAMENTO_MENSAL',
        ciclo: ciclo.inicio,
        fim: ciclo.fim,
        automatico: geradoPor === null,
        nome: arquivo.nome,
      },
    });
  }

  logger.info('fechamento.gerado', {
    ciclo: ciclo.inicio,
    dias: fechamento.linhas.length,
    vans: fechamento.vans.length,
    automatico: geradoPor === null,
  });

  return {
    ciclo,
    motoristas: { id: motoristas.id, nome: nomeMotoristas },
    medicao: { id: medicao.id, nome: nomeMedicao },
  };
}

/** "Gerar planilhas" na tela do fechamento. */
export const gerarAgora = definirAcao<EntradaCiclo, FechamentoGerado>({
  nome: 'fechamento.gerar',
  perfis: ['ADMIN'],
  esquema: esquemaCiclo,
  tempoLimiteMs: 30_000,
  executar: async (entrada, contexto) => {
    const regras = await lerRegras(contexto.tx);
    const ciclo = cicloDaEntrada(entrada, regras.diaInicio);
    const gerado = await gerar(contexto, ciclo, regras, contexto.usuario.id, contexto.usuario.nome);
    return { ...gerado, jaGerado: false };
  },
});

/**
 * Rotina do dia de virada: fecha o ciclo que terminou ontem e avisa a
 * administração. Uma segunda passagem na mesma hora reconhece o aviso já dado
 * e não gera de novo.
 */
export const gerarAgendado = definirAcao<{ hoje?: string }, FechamentoGerado | null>({
  nome: 'fechamento.agendado',
  sistema: true,
  esquema: z.object({ hoje: dataIso.optional() }),
  tempoLimiteMs: 30_000,
  executar: async ({ hoje }, contexto) => {
    const regras = await lerRegras(contexto.tx);
    const ciclo = cicloAnterior(
      cicloQueContem(hoje ?? dataOperacional(), regras.diaInicio),
      regras.diaInicio,
    );

    if (await fechamentoAutomaticoJaGerado(contexto.tx, ciclo.inicio)) return null;

    const gerado = await gerar(contexto, ciclo, regras, null, 'Sistema (rotina automática)');

    const administradores = await administradoresParaNotificar(contexto.tx);
    for (const administrador of administradores) {
      await registrarNotificacao(contexto.tx, {
        canal: 'INTERNA',
        tipo: 'EXPORTACAO_PRONTA',
        destinatarioUsuarioId: administrador.id,
        destinatarioTelefone: null,
        conteudo:
          `Fechamento de ${rotuloDoCiclo(ciclo)} pronto: pagamento dos motoristas e boletim ` +
          'de medição. Confira os dias marcados antes de enviar.',
        arquivoId: gerado.medicao.id,
        referenciaTipo: 'fechamento',
        referenciaId: null,
        referenciaChave: ciclo.inicio,
        status: 'PENDENTE',
        enviadaEm: null,
        ultimoErro: null,
      });
    }

    return { ...gerado, jaGerado: false };
  },
});

// ------------------------------------------------------------ painel

export interface FechamentoDoDia {
  /** Motoristas que já fazem jus à diária hoje. */
  comHoraExtra: number;
  valorHoraExtra: number;
  totalPedagios: number;
}

/** Hora extra e pedágio do dia, para o painel (pedido do cliente de 07/10). */
export const doDia = definirAcao<{ data?: string }, FechamentoDoDia>({
  nome: 'fechamento.dia',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: z.object({ data: dataIso.optional() }),
  executar: async ({ data }, contexto) => {
    const hoje = data ?? dataOperacional();
    const regras = await lerRegras(contexto.tx);
    const [jornadas, escalasNoturnas, feriadosGravados, totalPedagios] = await Promise.all([
      jornadasDoCiclo(contexto.tx, hoje, hoje),
      escalasNoturnasDoCiclo(contexto.tx, hoje, hoje),
      feriadosDoPeriodo(contexto.tx, hoje, hoje),
      totalPedagiosDoDia(contexto.tx, hoje),
    ]);

    const feriados = new Set(feriadosGravados.map((feriado) => comoDataIso(feriado.data)));
    const noturnos = new Set(
      escalasNoturnas.map((escala) => `${comoDataIso(escala.data)}|${escala.motoristaId}`),
    );
    const comDiaria = juntarDiasDoMotorista(
      jornadas.map((jornada) => paraDiaDoMotorista(jornada, noturnos)),
    ).filter((dia) => avaliarHoraExtra(dia, feriados, regras.horaExtra).temDiaria);

    return {
      comHoraExtra: comDiaria.length,
      valorHoraExtra: emReais(comDiaria.length * emCentavos(regras.horaExtra.valorDiaria)),
      totalPedagios,
    };
  },
});
