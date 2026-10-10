import { CodigoErro, ErroDeNegocio } from '@/lib/erros';
import { normalizarTelefone } from '@/utilitarios/telefone';

/**
 * Regras dos parâmetros do sistema (US042 · RF040 · RN019, RN026).
 *
 * Cada parâmetro tem uma faixa válida, e a faixa não é decoração: são valores
 * que o agendador e as regras de negócio consomem em produção. Uma janela de
 * edição de 9.999 horas revoga na prática a RN019; um horário de consolidado
 * malformado deixa a planilha do dia sem gerar. Recusar aqui, com explicação, é
 * mais barato do que descobrir depois.
 */

export const HORA_MINUTO = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type TipoDeParametro =
  'inteiro' | 'horario' | 'telefones' | 'dinheiro' | 'sim-nao' | 'texto';

export type GrupoDeParametro = 'operacao' | 'fechamento';

export const ROTULO_DO_GRUPO: Record<GrupoDeParametro, string> = {
  operacao: 'Operação',
  fechamento: 'Fechamento do mês',
};

export interface DefinicaoDeParametro {
  chave: string;
  rotulo: string;
  /** O que muda na operação quando este valor muda. */
  explicacao: string;
  tipo: TipoDeParametro;
  grupo?: GrupoDeParametro;
  minimo?: number;
  /** No tipo `texto`, o número máximo de caracteres. */
  maximo?: number;
  unidade?: string;
  /**
   * Valor usado enquanto ninguém gravou outro. A tela mostra este valor no
   * campo — sem ele, um parâmetro novo apareceria vazio e salvar o formulário
   * daria erro por um campo que o administrador nem tocou.
   */
  padrao?: number | string | boolean;
}

/**
 * Os cinco parâmetros que a US042 abre ao administrador.
 *
 * `versao_aviso_privacidade` e `retencao_localizacao_meses` ficam de fora **de
 * propósito**: mudar a versão do aviso força todo mundo a aceitar de novo
 * (RF042), e a retenção apaga dado pessoal em definitivo (RNF007). Os dois
 * merecem uma tela própria com confirmação explícita, não um campo no meio de
 * uma lista de horários.
 */
export const PARAMETROS: DefinicaoDeParametro[] = [
  {
    chave: 'janela_edicao_horas',
    rotulo: 'Janela de correção do motorista',
    explicacao:
      'Depois de encerrar, por quanto tempo o motorista ainda pode corrigir a corrida. ' +
      'Passado o prazo, só o administrador corrige.',
    tipo: 'inteiro',
    minimo: 1,
    maximo: 72,
    unidade: 'horas',
  },
  {
    chave: 'horario_consolidado',
    rotulo: 'Horário do consolidado do dia',
    explicacao:
      'Quando o agendador gera a planilha consolidada. Deve ficar depois do fim da operação — ' +
      'jornadas ainda abertas não entram no consolidado.',
    tipo: 'horario',
  },
  {
    chave: 'horario_alerta_pendencia',
    rotulo: 'Horário do alerta de pendências',
    explicacao: 'Quando o sistema cobra jornadas não encerradas e motoristas sem registro.',
    tipo: 'horario',
  },
  {
    chave: 'tolerancia_odometro_km',
    rotulo: 'Tolerância de divergência do odômetro',
    explicacao:
      'Diferença entre o odômetro digitado e o último conhecido da van que passa a exigir ' +
      'confirmação do motorista. Valor baixo demais gera confirmação a toda hora e vira ruído.',
    tipo: 'inteiro',
    minimo: 10,
    maximo: 5000,
    unidade: 'km',
  },
  {
    chave: 'destinatarios_resumo',
    rotulo: 'Telefones que recebem o resumo do dia',
    explicacao:
      'Um por linha. Vazio faz o resumo ir para os administradores ativos que tiverem telefone ' +
      'cadastrado.',
    tipo: 'telefones',
  },

  // ------------------------------------------------------------ fechamento
  // Pedidos do cliente de 07/10/2026. Os valores iniciais são os informados;
  // o que ainda não foi confirmado está dito na explicação.
  {
    chave: 'ciclo_dia_inicio',
    rotulo: 'Dia em que começa o ciclo do fechamento',
    explicacao:
      'O fechamento vai deste dia até a véspera dele no mês seguinte (16 = de 16 a 15). ' +
      'É a data das planilhas mensais e da geração automática.',
    tipo: 'inteiro',
    grupo: 'fechamento',
    minimo: 1,
    maximo: 28,
    padrao: 16,
  },
  {
    chave: 'he_valor_diaria',
    rotulo: 'Valor da diária de hora extra',
    explicacao:
      'Pago uma vez por dia ao motorista que entrou antes ou saiu depois do horário. ' +
      'Mudar este valor vale para os cálculos daqui em diante; as planilhas já geradas ficam como estão.',
    tipo: 'dinheiro',
    grupo: 'fechamento',
    minimo: 0,
    maximo: 10000,
    unidade: 'R$',
    padrao: 105,
  },
  {
    chave: 'he_exige_ambas',
    rotulo: 'A diária exige entrar cedo e sair tarde no mesmo dia',
    explicacao:
      'Não: basta uma das duas coisas para contar a diária. Sim: só conta quando o motorista ' +
      'entrou antes e também saiu depois do horário. Combinado com o cliente: Não, e sem ' +
      'tolerância — um minuto já conta.',
    tipo: 'sim-nao',
    grupo: 'fechamento',
    padrao: false,
  },
  {
    chave: 'he_limite_entrada',
    rotulo: 'Hora extra: entrada antes de',
    explicacao: 'Iniciar o dia antes deste horário conta para a diária de hora extra.',
    tipo: 'horario',
    grupo: 'fechamento',
    padrao: '06:00',
  },
  {
    chave: 'he_saida_seg_qui',
    rotulo: 'Hora extra: saída depois de (segunda a quinta)',
    explicacao: 'Encerrar o dia depois deste horário, de segunda a quinta, conta para a diária.',
    tipo: 'horario',
    grupo: 'fechamento',
    padrao: '18:00',
  },
  {
    chave: 'he_saida_sex_dom',
    rotulo: 'Hora extra: saída depois de (sexta a domingo)',
    explicacao: 'Encerrar o dia depois deste horário, de sexta a domingo, conta para a diária.',
    tipo: 'horario',
    grupo: 'fechamento',
    padrao: '17:00',
  },
  {
    chave: 'he_saida_feriado',
    rotulo: 'Hora extra: saída depois de (feriado)',
    explicacao:
      'Encerrar o dia depois deste horário, em feriado cadastrado, conta para a diária. ' +
      'Combinado com o cliente: 17:00, como sexta a domingo.',
    tipo: 'horario',
    grupo: 'fechamento',
    padrao: '17:00',
  },
  {
    chave: 'he_noturno_inicio',
    rotulo: 'Turno da noite: entrada antes de',
    explicacao:
      'Para quem está escalado no turno da noite, iniciar antes deste horário conta para a diária.',
    tipo: 'horario',
    grupo: 'fechamento',
    padrao: '18:00',
  },
  {
    chave: 'he_noturno_fim',
    rotulo: 'Turno da noite: saída depois de',
    explicacao: 'Para o turno da noite, encerrar depois deste horário (já no dia seguinte) conta.',
    tipo: 'horario',
    grupo: 'fechamento',
    padrao: '07:00',
  },
  {
    chave: 'km_limite_dia',
    rotulo: 'Km por dia antes do excedente',
    explicacao:
      'Acima disto, no dia, cada km é pago ao motorista. Também é o limite do boletim para a van ' +
      'que não tiver limite próprio no contrato. O km do dia é a diferença dos odômetros.',
    tipo: 'inteiro',
    grupo: 'fechamento',
    minimo: 1,
    maximo: 2000,
    unidade: 'km',
    padrao: 130,
  },
  {
    chave: 'km_valor_motorista',
    rotulo: 'Valor do km excedente pago ao motorista',
    explicacao: 'Por quilômetro acima do limite do dia.',
    tipo: 'dinheiro',
    grupo: 'fechamento',
    minimo: 0,
    maximo: 1000,
    unidade: 'R$',
    padrao: 3,
  },
  {
    chave: 'medicao_divisor',
    rotulo: 'Divisor do valor mensal no boletim',
    explicacao:
      'O valor do dia de cada van é o valor mensal do contrato dividido por este número, ' +
      'como no boletim atual (22).',
    tipo: 'inteiro',
    grupo: 'fechamento',
    minimo: 1,
    maximo: 31,
    padrao: 22,
  },
  {
    chave: 'empresa_razao_social',
    rotulo: 'Razão social no boletim',
    explicacao:
      'Nome da empresa no topo do boletim de medição, como no boletim enviado hoje ao cliente.',
    tipo: 'texto',
    grupo: 'fechamento',
    maximo: 120,
    padrao: 'TRANSPORTES EXEMPLO LTDA',
  },
  {
    chave: 'medicao_contrato',
    rotulo: 'Número do contrato no boletim',
    explicacao:
      'Aparece no cabeçalho do boletim, ao lado do período (por exemplo, CT-001/2026). ' +
      'Deixe vazio se não houver.',
    tipo: 'texto',
    grupo: 'fechamento',
    maximo: 60,
    padrao: '',
  },
];

export const CHAVES_EDITAVEIS = PARAMETROS.map((parametro) => parametro.chave);

/** O valor de um parâmetro quando ninguém gravou outro. */
export function valorPadraoDe(chave: string): number | string | boolean | undefined {
  return definicaoDe(chave)?.padrao;
}

/** `105` → `105,00`; o campo de dinheiro mostra e aceita vírgula. */
export function formatarDinheiroDoCampo(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

export function definicaoDe(chave: string): DefinicaoDeParametro | undefined {
  return PARAMETROS.find((parametro) => parametro.chave === chave);
}

/**
 * Valida e **normaliza** um valor para a chave informada.
 *
 * Devolve o valor no formato em que ele será gravado: inteiro como número,
 * horário como `HH:MM`, telefones em E.164. Normalizar na entrada evita que o
 * consumidor — agendador, regra de negócio — precise adivinhar o formato.
 */
export function validarParametro(
  chave: string,
  valorBruto: unknown,
): number | string | string[] | boolean {
  const definicao = definicaoDe(chave);

  if (!definicao) {
    throw new ErroDeNegocio(CodigoErro.DADOS_INVALIDOS, 'Parâmetro desconhecido.', {
      [chave]: 'Este parâmetro não é configurável.',
    });
  }

  if (definicao.tipo === 'sim-nao') {
    if (typeof valorBruto === 'boolean') return valorBruto;
    const texto = String(valorBruto ?? '')
      .trim()
      .toLowerCase();
    if (texto === 'sim' || texto === 'true') return true;
    if (texto === 'nao' || texto === 'não' || texto === 'false') return false;
    throw new ErroDeNegocio(
      CodigoErro.DADOS_INVALIDOS,
      `${definicao.rotulo}: escolha sim ou não.`,
      { [chave]: 'Escolha sim ou não.' },
    );
  }

  if (definicao.tipo === 'texto') {
    const texto = String(valorBruto ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const maximo = definicao.maximo ?? 120;
    if (texto.length > maximo) {
      throw new ErroDeNegocio(
        CodigoErro.DADOS_INVALIDOS,
        `${definicao.rotulo}: use até ${maximo} caracteres.`,
        { [chave]: `Use até ${maximo} caracteres.` },
      );
    }
    return texto;
  }

  if (definicao.tipo === 'dinheiro') {
    // Aceita "105", "105,00", "1.250,50" e 105.5 — o administrador digita como
    // escreve; grava em reais, com duas casas.
    const texto =
      typeof valorBruto === 'number'
        ? String(valorBruto)
        : String(valorBruto ?? '')
            .trim()
            .replace(/^R\$\s*/i, '')
            .replace(/\.(?=\d{3}(\D|$))/g, '')
            .replace(',', '.');
    const numero = Number(texto);
    const minimo = definicao.minimo ?? 0;
    const maximo = definicao.maximo ?? Number.POSITIVE_INFINITY;

    if (texto === '' || !Number.isFinite(numero)) {
      throw new ErroDeNegocio(
        CodigoErro.DADOS_INVALIDOS,
        `${definicao.rotulo}: informe um valor.`,
        { [chave]: 'Informe um valor, como 105,00.' },
      );
    }
    if (numero < minimo || numero > maximo) {
      throw new ErroDeNegocio(
        CodigoErro.DADOS_INVALIDOS,
        `${definicao.rotulo}: use um valor entre R$ ${formatarDinheiroDoCampo(minimo)} e ` +
          `R$ ${formatarDinheiroDoCampo(maximo)}.`,
        {
          [chave]: `Entre ${formatarDinheiroDoCampo(minimo)} e ${formatarDinheiroDoCampo(maximo)}.`,
        },
      );
    }
    return Math.round(numero * 100) / 100;
  }

  if (definicao.tipo === 'inteiro') {
    const numero = typeof valorBruto === 'number' ? valorBruto : Number(String(valorBruto).trim());

    if (!Number.isInteger(numero)) {
      throw new ErroDeNegocio(
        CodigoErro.DADOS_INVALIDOS,
        `${definicao.rotulo}: informe um número inteiro.`,
        {
          [chave]: 'Informe um número inteiro.',
        },
      );
    }

    const minimo = definicao.minimo ?? Number.NEGATIVE_INFINITY;
    const maximo = definicao.maximo ?? Number.POSITIVE_INFINITY;

    if (numero < minimo || numero > maximo) {
      throw new ErroDeNegocio(
        CodigoErro.DADOS_INVALIDOS,
        `${definicao.rotulo}: use um valor entre ${minimo} e ${maximo} ${definicao.unidade ?? ''}`.trim(),
        { [chave]: `Entre ${minimo} e ${maximo}.` },
      );
    }

    return numero;
  }

  if (definicao.tipo === 'horario') {
    const texto = String(valorBruto ?? '').trim();

    if (!HORA_MINUTO.test(texto)) {
      throw new ErroDeNegocio(
        CodigoErro.HORARIO_INVALIDO,
        `${definicao.rotulo}: use o formato HH:MM, entre 00:00 e 23:59.`,
        { [chave]: 'Use o formato HH:MM.' },
      );
    }

    return texto;
  }

  // telefones — texto com um por linha, ou lista pronta.
  const linhas = Array.isArray(valorBruto)
    ? valorBruto.map(String)
    : String(valorBruto ?? '')
        .split(/[\n,;]/)
        .map((linha) => linha.trim())
        .filter(Boolean);

  const normalizados: string[] = [];
  const invalidos: string[] = [];

  for (const linha of linhas) {
    const telefone = normalizarTelefone(linha);
    if (telefone) normalizados.push(telefone);
    else invalidos.push(linha);
  }

  // Aqui o inválido **recusa**, ao contrário de `escolherDestinatarios`, que o
  // descarta. São momentos diferentes: no cadastro dá para corrigir; na hora do
  // envio, recusar tudo por causa de um número ruim deixaria o resumo sem sair.
  if (invalidos.length > 0) {
    throw new ErroDeNegocio(
      CodigoErro.DADOS_INVALIDOS,
      `Telefone inválido: ${invalidos.join(', ')}. Use DDD e número, como (11) 99999-8888.`,
      { [chave]: `Não reconheci: ${invalidos.join(', ')}` },
    );
  }

  // Duplicado faria o mesmo administrador receber o resumo duas vezes.
  return [...new Set(normalizados)];
}

/**
 * O consolidado precisa rodar **depois** do alerta de pendências.
 *
 * Invertidos, o sistema cobraria o registro de um dia que ele já fechou — e o
 * motorista receberia a cobrança de algo que a planilha já deu por encerrado.
 */
export function validarOrdemDosHorarios(alerta: string, consolidado: string): void {
  if (!HORA_MINUTO.test(alerta) || !HORA_MINUTO.test(consolidado)) return;

  if (alerta >= consolidado) {
    throw new ErroDeNegocio(
      CodigoErro.HORARIO_INVALIDO,
      'O alerta de pendências precisa acontecer antes do consolidado do dia — ' +
        'do contrário o sistema cobraria um dia que já fechou.',
      { horario_alerta_pendencia: 'Precisa ser anterior ao horário do consolidado.' },
    );
  }
}
