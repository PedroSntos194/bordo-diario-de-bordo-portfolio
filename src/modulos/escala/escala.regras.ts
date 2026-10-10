import { CodigoErro, ErroDeConflito, ErroDeNegocio } from '@/lib/erros';
import { diasNoPeriodo, somarDias } from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

/**
 * Regras da escala (US014 · RF013 · RN013).
 *
 * A escala é uma **sugestão**, não uma trava. O motorista pode dirigir outra
 * van se a escalada quebrou, e o sistema não o impede — impedir faria o dia
 * parar por causa de um planejamento feito na véspera. O que o sistema faz é
 * pré-preencher, para economizar toques, e **sinalizar a divergência** ao
 * administrador, que é quem precisa saber que o plano e a realidade separaram.
 */

export const TURNOS_DA_ESCALA = ['MANHA', 'TARDE', 'NOITE', 'INTEGRAL'] as const;
export type TurnoDaEscala = (typeof TURNOS_DA_ESCALA)[number];

export const ROTULO_DO_TURNO: Record<TurnoDaEscala, string> = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
  INTEGRAL: 'Dia inteiro',
};

/**
 * Dois turnos ocupam o mesmo espaço?
 *
 * `INTEGRAL` cobre o dia todo e por isso conflita com qualquer outro. Turnos
 * diferentes e específicos convivem: a mesma van pode rodar de manhã com um
 * motorista e à tarde com outro, que é o uso normal de uma frota pequena.
 *
 * O banco garante o caso exato — `UNIQUE (data, veículo, turno)` —, e é ele que
 * resolve a corrida entre duas requisições simultâneas. Esta função existe para
 * o caso que o índice **não** alcança: `INTEGRAL` contra `MANHA` são valores
 * diferentes na coluna e passariam pela restrição.
 */
export function turnosConflitam(um: TurnoDaEscala, outro: TurnoDaEscala): boolean {
  if (um === outro) return true;
  return um === 'INTEGRAL' || outro === 'INTEGRAL';
}

export interface EscalaExistente {
  turno: TurnoDaEscala;
  motorista: { nome: string };
  veiculo: { placa: string };
}

/**
 * Recusa escalar a mesma van para dois motoristas no mesmo espaço de tempo.
 *
 * Critério de aceitação literal da US014. A mensagem diz **quem** já está com a
 * van: sem isso o administrador vê "conflito" e precisa procurar na lista para
 * descobrir o que fazer.
 */
export function validarVeiculoLivre(
  turnoPretendido: TurnoDaEscala,
  jaEscalados: EscalaExistente[],
): void {
  const conflito = jaEscalados.find((escala) => turnosConflitam(escala.turno, turnoPretendido));
  if (!conflito) return;

  throw new ErroDeConflito(
    CodigoErro.VEICULO_EM_USO,
    `A van ${formatarPlaca(conflito.veiculo.placa)} já está escalada para ` +
      `${conflito.motorista.nome} no turno ${ROTULO_DO_TURNO[conflito.turno].toLowerCase()}.`,
    { veiculoId: 'Van já escalada neste turno.' },
  );
}

/**
 * Recusa escalar o mesmo motorista em dois lugares no mesmo espaço de tempo.
 *
 * O critério fala do veículo; esta é a outra metade da mesma impossibilidade
 * física, e sem ela a escala aceitaria mandar uma pessoa para duas vans.
 */
export function validarMotoristaLivre(
  turnoPretendido: TurnoDaEscala,
  jaEscalados: EscalaExistente[],
): void {
  const conflito = jaEscalados.find((escala) => turnosConflitam(escala.turno, turnoPretendido));
  if (!conflito) return;

  throw new ErroDeConflito(
    CodigoErro.CONFLITO,
    `${conflito.motorista.nome} já está escalado na van ` +
      `${formatarPlaca(conflito.veiculo.placa)} no turno ` +
      `${ROTULO_DO_TURNO[conflito.turno].toLowerCase()}.`,
    { motoristaId: 'Motorista já escalado neste turno.' },
  );
}

// ------------------------------------------------------------ divergência

export interface EscalaDoDia {
  veiculoId: string;
  placa: string;
  turno: TurnoDaEscala;
  rotas: { id: string; codigo: string }[];
}

export interface JornadaParaComparar {
  veiculoId: string;
  placa: string;
  rotasUsadas: { id: string; codigo: string }[];
}

export interface DivergenciaDaEscala {
  /** Havia escala para este motorista nesta data? */
  temEscala: boolean;
  /** A van usada é diferente da escalada. */
  veiculoDivergente: boolean;
  placaEscalada: string | null;
  /** Rotas rodadas que não estavam na escala. */
  rotasForaDaEscala: string[];
  /** Rotas escaladas em que ele não rodou nenhuma corrida. */
  rotasNaoCumpridas: string[];
}

/**
 * Compara o dia que aconteceu com o dia que estava planejado.
 *
 * Corrida avulsa — sem rota cadastrada — **não** conta como divergência de
 * rota: ela é um recurso previsto da operação (US018), não um desvio do plano.
 * Marcar toda avulsa como divergente encheria o painel de alertas sobre o
 * funcionamento normal, e alerta que aparece sempre é alerta que ninguém lê.
 */
export function compararComEscala(
  escala: EscalaDoDia | null,
  jornada: JornadaParaComparar,
): DivergenciaDaEscala {
  if (!escala) {
    return {
      temEscala: false,
      veiculoDivergente: false,
      placaEscalada: null,
      rotasForaDaEscala: [],
      rotasNaoCumpridas: [],
    };
  }

  const escaladas = new Set(escala.rotas.map((rota) => rota.id));
  const rodadas = new Set(jornada.rotasUsadas.map((rota) => rota.id));

  return {
    temEscala: true,
    veiculoDivergente: escala.veiculoId !== jornada.veiculoId,
    placaEscalada: escala.placa,
    rotasForaDaEscala: jornada.rotasUsadas
      .filter((rota) => !escaladas.has(rota.id))
      .map((rota) => rota.codigo),
    rotasNaoCumpridas: escala.rotas
      .filter((rota) => !rodadas.has(rota.id))
      .map((rota) => rota.codigo),
  };
}

export function houveDivergencia(divergencia: DivergenciaDaEscala): boolean {
  return (
    divergencia.temEscala &&
    (divergencia.veiculoDivergente ||
      divergencia.rotasForaDaEscala.length > 0 ||
      divergencia.rotasNaoCumpridas.length > 0)
  );
}

/** Frase curta para a etiqueta do painel. */
export function resumirDivergencia(divergencia: DivergenciaDaEscala): string | null {
  if (!houveDivergencia(divergencia)) return null;

  const partes: string[] = [];

  if (divergencia.veiculoDivergente && divergencia.placaEscalada) {
    partes.push(`van diferente da escalada (${formatarPlaca(divergencia.placaEscalada)})`);
  }
  if (divergencia.rotasForaDaEscala.length > 0) {
    partes.push(`rota fora da escala: ${divergencia.rotasForaDaEscala.join(', ')}`);
  }
  if (divergencia.rotasNaoCumpridas.length > 0) {
    partes.push(`rota escalada sem corrida: ${divergencia.rotasNaoCumpridas.join(', ')}`);
  }

  return partes.join(' · ');
}

// ------------------------------------------------------------ repetição

/**
 * Repetir a escala de um dia nos dias seguintes.
 *
 * A escala é gravada dia a dia, e era assim que o administrador precisava
 * montá-la: um dia esquecido significava ninguém cobrado naquele dia, porque a
 * cobrança de "sem registro" só considera quem está escalado. Repetir copia o
 * dia escolhido para os dias da semana marcados, até uma data — e continua
 * gravando linhas comuns de escala, então a cobrança, a divergência e a
 * abertura da jornada seguem funcionando sem nenhuma regra nova. Um dia
 * diferente se corrige naquele dia, como sempre.
 */

/** Rótulos curtos, na ordem da semana de trabalho. `valor` segue `getUTCDay`. */
export const DIAS_DA_SEMANA = [
  { valor: 1, rotulo: 'Seg' },
  { valor: 2, rotulo: 'Ter' },
  { valor: 3, rotulo: 'Qua' },
  { valor: 4, rotulo: 'Qui' },
  { valor: 5, rotulo: 'Sex' },
  { valor: 6, rotulo: 'Sáb' },
  { valor: 0, rotulo: 'Dom' },
] as const;

/**
 * Até quantos dias à frente uma repetição alcança.
 *
 * Dois meses cobrem o planejamento real de uma frota pequena. Mais que isso é
 * quase sempre engano no campo "até", e desfazer centenas de linhas uma a uma
 * custaria mais do que repetir de novo daqui a dois meses.
 */
export const LIMITE_DE_DIAS_DA_REPETICAO = 62;

/** Dia da semana de uma data operacional (`AAAA-MM-DD`), como `getUTCDay`. */
export function diaDaSemanaDaData(dataIso: string): number {
  return new Date(`${dataIso}T00:00:00Z`).getUTCDay();
}

/**
 * As datas que recebem a cópia: do dia seguinte ao modelo até `ate`, inclusive,
 * só nos dias da semana marcados.
 */
export function datasDaRepeticao(
  dataOrigem: string,
  ate: string,
  diasDaSemana: readonly number[],
): string[] {
  if (ate <= dataOrigem) {
    throw new ErroDeNegocio(
      CodigoErro.DADOS_INVALIDOS,
      'A data final precisa ser depois do dia que está sendo repetido.',
      { ate: 'Escolha uma data depois deste dia.' },
    );
  }

  // `diasNoPeriodo` conta as duas pontas; a origem não recebe cópia.
  const dias = diasNoPeriodo(dataOrigem, ate) - 1;
  if (dias > LIMITE_DE_DIAS_DA_REPETICAO) {
    throw new ErroDeNegocio(
      CodigoErro.PERIODO_MUITO_LONGO,
      `A repetição alcança no máximo ${LIMITE_DE_DIAS_DA_REPETICAO} dias à frente.`,
      { ate: `No máximo ${LIMITE_DE_DIAS_DA_REPETICAO} dias depois deste dia.` },
    );
  }

  const marcados = new Set(diasDaSemana);
  const datas: string[] = [];
  for (let passo = 1; passo <= dias; passo++) {
    const data = somarDias(dataOrigem, passo);
    if (marcados.has(diaDaSemanaDaData(data))) datas.push(data);
  }
  return datas;
}

/** Uma escala do dia modelo, já reduzida ao que a cópia precisa. */
export interface ModeloDeEscala {
  motoristaId: string;
  motoristaNome: string;
  veiculoId: string;
  placa: string;
  turno: TurnoDaEscala;
  rotaIds: string[];
}

/** O que já existe nas datas de destino. */
export interface OcupacaoDoDia {
  motoristaId: string;
  veiculoId: string;
  turno: TurnoDaEscala;
}

export type MotivoDoPulo = 'folga' | 'motorista-ocupado' | 'van-ocupada';

export const ROTULO_DO_MOTIVO: Record<MotivoDoPulo, string> = {
  folga: 'está de folga',
  'motorista-ocupado': 'já está escalado neste turno',
  'van-ocupada': 'a van já está escalada neste turno',
};

export interface PlanoDeRepeticao {
  criar: { data: string; modelo: ModeloDeEscala }[];
  puladas: { data: string; motorista: string; placa: string; motivo: MotivoDoPulo }[];
}

/**
 * Decide o que copiar e o que pular.
 *
 * Nunca sobrescreve: o que já está planejado num dia de destino vale mais do
 * que a cópia, porque alguém o escolheu para aquele dia. Pula também quem está
 * de folga — a folga já prevalece sobre a escala na cobrança, e escalar por
 * cima dela só criaria uma linha que contradiz a outra.
 *
 * O conflito usa a mesma regra de turno da escala manual (`turnosConflitam`), e
 * cada cópia planejada passa a ocupar o dia para as seguintes: duas linhas do
 * modelo nunca disputam a mesma van no destino sem que uma seja recusada.
 */
export function planejarRepeticao(
  modelos: readonly ModeloDeEscala[],
  datas: readonly string[],
  ocupacao: ReadonlyMap<string, readonly OcupacaoDoDia[]>,
  folgas: ReadonlySet<string>,
): PlanoDeRepeticao {
  const plano: PlanoDeRepeticao = { criar: [], puladas: [] };

  for (const data of datas) {
    const ocupados: OcupacaoDoDia[] = [...(ocupacao.get(data) ?? [])];

    for (const modelo of modelos) {
      const pular = (motivo: MotivoDoPulo): void => {
        plano.puladas.push({
          data,
          motorista: modelo.motoristaNome,
          placa: modelo.placa,
          motivo,
        });
      };

      if (folgas.has(chaveDaFolga(data, modelo.motoristaId))) {
        pular('folga');
        continue;
      }

      const conflita = (outro: OcupacaoDoDia): boolean =>
        turnosConflitam(outro.turno, modelo.turno);

      if (ocupados.some((outro) => outro.motoristaId === modelo.motoristaId && conflita(outro))) {
        pular('motorista-ocupado');
        continue;
      }
      if (ocupados.some((outro) => outro.veiculoId === modelo.veiculoId && conflita(outro))) {
        pular('van-ocupada');
        continue;
      }

      plano.criar.push({ data, modelo });
      ocupados.push({
        motoristaId: modelo.motoristaId,
        veiculoId: modelo.veiculoId,
        turno: modelo.turno,
      });
    }
  }

  return plano;
}

/** Chave de uma folga no conjunto que `planejarRepeticao` consulta. */
export function chaveDaFolga(data: string, motoristaId: string): string {
  return `${data}|${motoristaId}`;
}
