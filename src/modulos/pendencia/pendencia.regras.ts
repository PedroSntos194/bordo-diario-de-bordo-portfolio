import { formatarDataOperacional, formatarHora } from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

/**
 * Regras do alerta de pendências (US038 · RF026 · RN012, RN028).
 *
 * O problema declarado pelo cliente é de **adesão**: os motoristas não
 * preenchem o diário. Todo o resto do sistema torna o registro fácil; esta
 * história é a única que vai atrás de quem não registrou. Por isso as mensagens
 * são escritas para serem lidas em cinco segundos, no celular, por alguém que
 * já terminou o expediente — e sem tom de punição, que faria o motorista
 * silenciar as notificações no primeiro dia.
 *
 * Funções puras: montam texto, não conversam com banco nem com o WhatsApp. É o
 * que permite verificar a redação e os limites de tamanho sem subir nada.
 */

/** Uma jornada que passou do fim do expediente sem ser encerrada. */
export interface JornadaEmAberto {
  id: string;
  /** Data operacional (`AAAA-MM-DD` ou a coluna `date` do banco). */
  data: Date | string;
  iniciadaEm: Date;
  motorista: { id: string; nome: string; telefone: string };
  veiculo: { placa: string };
  /** Ainda existe corrida rodando? Distingue esquecimento de trabalho em curso. */
  temCorridaEmAndamento: boolean;
}

/** Motorista ativo que não abriu jornada nenhuma no dia. */
export interface MotoristaSemRegistro {
  id: string;
  nome: string;
  telefone: string;
}

export interface PendenciasDoDia {
  data: string;
  jornadasEmAberto: JornadaEmAberto[];
  motoristasSemRegistro: MotoristaSemRegistro[];
}

/**
 * Quantos itens de cada lista cabem na mensagem consolidada.
 *
 * Existe porque uma frota de 60 motoristas num dia ruim produziria uma mensagem
 * de WhatsApp que ninguém lê e que o provedor pode recusar por tamanho. O que
 * não coube vira "e mais N", e a lista completa fica na tela — que é onde ela
 * é útil de qualquer forma.
 */
export const MAXIMO_DE_ITENS_NA_MENSAGEM = 12;

/** Há algo a cobrar? Usado para não gerar notificação de dia limpo. */
export function houvePendencia(pendencias: PendenciasDoDia): boolean {
  return pendencias.jornadasEmAberto.length > 0 || pendencias.motoristasSemRegistro.length > 0;
}

function listar(itens: string[]): string[] {
  const visiveis = itens.slice(0, MAXIMO_DE_ITENS_NA_MENSAGEM);
  const linhas = visiveis.map((item) => `• ${item}`);

  const restante = itens.length - visiveis.length;
  if (restante > 0) linhas.push(`• … e mais ${restante}.`);

  return linhas;
}

/**
 * Cobrança ao motorista que deixou o dia aberto.
 *
 * Diz **o que fazer**, não só o que está errado: a jornada aberta é a diferença
 * entre o dia entrar ou não no relatório (RN017), e o motorista não tem como
 * saber disso sozinho.
 */
export function montarMensagemDeJornadaEmAberto(
  jornada: JornadaEmAberto,
  linkDoAplicativo: string,
): string {
  return [
    '*Bordo · Dia em aberto*',
    '',
    `Sua jornada de ${formatarDataOperacional(jornada.data)} com a van ` +
      `${formatarPlaca(jornada.veiculo.placa)} começou às ${formatarHora(jornada.iniciadaEm)} ` +
      'e ainda não foi encerrada.',
    '',
    jornada.temCorridaEmAndamento
      ? 'Encerre a corrida em andamento e depois o dia — enquanto estiver aberto, o registro não entra no relatório.'
      : 'Encerre o dia no aplicativo para o registro entrar no relatório.',
    '',
    linkDoAplicativo,
  ].join('\n');
}

/**
 * Cobrança a quem não registrou nada.
 *
 * O fecho ("se não rodou, ignore") não é cortesia: sem ele, o motorista de
 * folga que recebe a mensagem entende que o sistema está errado — e um sistema
 * que cobra sem motivo é um sistema que se aprende a ignorar.
 */
export function montarMensagemDeSemRegistro(
  motorista: MotoristaSemRegistro,
  dataIso: string,
  linkDoAplicativo: string,
): string {
  return [
    '*Bordo · Sem registro hoje*',
    '',
    `${motorista.nome}, não há nenhum registro seu em ${formatarDataOperacional(dataIso)}.`,
    '',
    'Se você rodou hoje, ainda dá para registrar pelo aplicativo. Se não rodou, pode ignorar esta mensagem.',
    '',
    linkDoAplicativo,
  ].join('\n');
}

/**
 * Lista consolidada para o administrador — uma mensagem, não uma por pendência.
 *
 * O critério de aceitação pede "a lista consolidada", e a razão é prática:
 * quinze mensagens separadas às 20h viram quinze notificações que o
 * administrador arrasta para o lado sem ler.
 */
export function montarMensagemConsolidada(
  pendencias: PendenciasDoDia,
  linkDoPainel: string,
): string {
  const linhas: string[] = [
    `*Bordo · Pendências de ${formatarDataOperacional(pendencias.data)}*`,
    '',
  ];

  if (pendencias.jornadasEmAberto.length > 0) {
    linhas.push(`*Dias não encerrados:* ${pendencias.jornadasEmAberto.length}`);
    linhas.push(
      ...listar(
        pendencias.jornadasEmAberto.map((jornada) => {
          const desde =
            formatarDataOperacional(jornada.data) === formatarDataOperacional(pendencias.data)
              ? `desde ${formatarHora(jornada.iniciadaEm)}`
              : `aberto desde ${formatarDataOperacional(jornada.data)}`;

          return (
            `${jornada.motorista.nome} · van ${formatarPlaca(jornada.veiculo.placa)} · ${desde}` +
            (jornada.temCorridaEmAndamento ? ' · corrida em andamento' : '')
          );
        }),
      ),
    );
    linhas.push('');
  }

  if (pendencias.motoristasSemRegistro.length > 0) {
    linhas.push(`*Sem registro no dia:* ${pendencias.motoristasSemRegistro.length}`);
    linhas.push(...listar(pendencias.motoristasSemRegistro.map((motorista) => motorista.nome)));
    linhas.push('');
  }

  linhas.push(linkDoPainel);

  return linhas.join('\n');
}

/** Endereço da tela de pendências, para o administrador abrir a lista inteira. */
export function montarLinkDasPendencias(appUrl: string, dataIso: string): string {
  return `${appUrl.replace(/\/+$/, '')}/admin/pendencias?data=${dataIso}`;
}

/** Endereço da tela do motorista. */
export function montarLinkDoAplicativo(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, '')}/app`;
}

/**
 * Chave que identifica a cobrança de um dia (RN028 · critério "a rotina não
 * dispara duas vezes para o mesmo dia").
 *
 * É a data operacional, e não o instante da execução: reiniciar o agendador às
 * 20h05 não pode cobrar todo mundo de novo, e uma tentativa repetida depois de
 * falha parcial precisa reconhecer o que já saiu.
 */
export const REFERENCIA_DO_ALERTA = 'alerta-pendencia';
