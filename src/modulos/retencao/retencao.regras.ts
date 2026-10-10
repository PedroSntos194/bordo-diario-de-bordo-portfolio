import { CodigoErro, ErroDeNegocio } from '@/lib/erros';

/**
 * Regras da retenção e do descarte (US044 · RNF007 · RN029).
 *
 * O que a LGPD pede é simples de dizer e fácil de esquecer: dado pessoal não
 * fica guardado para sempre. A tabela `ponto_localizacao` é a maior do sistema
 * e a mais sensível — ela reconstrói por onde uma pessoa passou —, e sem uma
 * rotina que a limpe o sistema acumula rastreamento indefinido de sessenta
 * motoristas.
 *
 * Funções puras: prazos, datas de corte e tamanho de lote. Quem apaga é o
 * repositório; quem decide **até quando** guardar é este arquivo.
 */

/**
 * O expurgo **não** toca em nada que sustente número já publicado.
 *
 * Os totais de km, duração e passageiros vivem em `corrida` e `jornada`, não
 * nos pontos de GPS: apagar o rastro não muda um relatório já emitido. É o que
 * o critério chama de "preservando os totais consolidados", e é por isso que a
 * rotina apaga os **pontos**, nunca as corridas que os originaram.
 */
export const TABELAS_QUE_O_EXPURGO_TOCA = ['ponto_localizacao', 'arquivo', 'sessao'] as const;

export const CHAVE_RETENCAO_LOCALIZACAO = 'retencao_localizacao_meses';
export const CHAVE_RETENCAO_ARQUIVOS = 'retencao_arquivos_meses';

export interface PoliticaDeRetencao {
  chave: string;
  rotulo: string;
  /** O que exatamente some quando o prazo vence. */
  explicacao: string;
  padraoMeses: number;
  minimoMeses: number;
  maximoMeses: number;
}

/**
 * As duas políticas que a aplicação consegue aplicar sozinha.
 *
 * Os prazos vêm da RNF007. O mínimo não é decoração: um mês de retenção de
 * localização apagaria o rastro antes de a própria janela de correção de
 * registro fechar, e o administrador perderia a evidência justamente quando
 * fosse conferir uma correção contestada.
 */
export const POLITICAS: PoliticaDeRetencao[] = [
  {
    chave: CHAVE_RETENCAO_LOCALIZACAO,
    rotulo: 'Pontos de localização',
    explicacao:
      'Por quanto tempo as coordenadas de GPS das corridas ficam guardadas. Passado o prazo elas ' +
      'são apagadas em definitivo. Os totais de km, horários e passageiros NÃO dependem delas e ' +
      'continuam intactos — o que se perde é o traçado no mapa.',
    padraoMeses: 12,
    minimoMeses: 3,
    maximoMeses: 120,
  },
  {
    chave: CHAVE_RETENCAO_ARQUIVOS,
    rotulo: 'Planilhas geradas',
    explicacao:
      'Por quanto tempo o conteúdo das planilhas exportadas e dos consolidados fica disponível ' +
      'para download. O registro de que o arquivo existiu, quem o gerou e com quais filtros ' +
      'permanece na trilha; some apenas o conteúdo. Arquivos com prazo próprio — como o relatório ' +
      'de importação, que carrega senhas — vencem antes, no prazo deles.',
    padraoMeses: 60,
    minimoMeses: 1,
    maximoMeses: 120,
  },
];

export function politicaDe(chave: string): PoliticaDeRetencao | undefined {
  return POLITICAS.find((politica) => politica.chave === chave);
}

/**
 * Valida um prazo em meses.
 *
 * Mesma disciplina de `configuracao.regras.ts`: faixa explícita, mensagem que
 * diz o intervalo. A diferença é a consequência — aqui um valor errado apaga
 * dado pessoal em definitivo, e por isso o mínimo é mais alto do que o
 * tecnicamente possível.
 */
export function validarPrazo(chave: string, valorBruto: unknown): number {
  const politica = politicaDe(chave);

  if (!politica) {
    throw new ErroDeNegocio(CodigoErro.DADOS_INVALIDOS, 'Política de retenção desconhecida.', {
      [chave]: 'Este prazo não é configurável.',
    });
  }

  const meses = typeof valorBruto === 'number' ? valorBruto : Number(String(valorBruto).trim());

  if (!Number.isInteger(meses)) {
    throw new ErroDeNegocio(
      CodigoErro.DADOS_INVALIDOS,
      `${politica.rotulo}: informe o prazo em meses inteiros.`,
      { [chave]: 'Informe um número inteiro de meses.' },
    );
  }

  if (meses < politica.minimoMeses || meses > politica.maximoMeses) {
    throw new ErroDeNegocio(
      CodigoErro.DADOS_INVALIDOS,
      `${politica.rotulo}: use um prazo entre ${politica.minimoMeses} e ${politica.maximoMeses} meses.`,
      { [chave]: `Entre ${politica.minimoMeses} e ${politica.maximoMeses} meses.` },
    );
  }

  return meses;
}

/**
 * Data de corte: tudo **anterior** a ela vence.
 *
 * A subtração é feita em meses de calendário, não em "30 dias × N": doze meses
 * a partir de 31 de março precisa cair em 31 de março, e não três dias antes.
 * `setUTCMonth` já normaliza o dia inexistente (31 de fevereiro vira 3 de
 * março), que é o comportamento aceitável aqui — a alternativa seria guardar
 * dado pessoal por mais tempo do que o prazo autoriza.
 */
export function dataDeCorte(meses: number, agora: Date = new Date()): Date {
  const corte = new Date(agora.getTime());
  corte.setUTCMonth(corte.getUTCMonth() - meses);
  return corte;
}

/**
 * Quantas linhas cada `DELETE` remove por vez.
 *
 * A tabela de localização é a de maior volume do sistema (assim declarada no
 * schema). Um `DELETE` único de um ano de pontos manteria uma transação longa
 * segurando bloqueios no mesmo banco que atende os motoristas em campo. Lotes
 * pequenos e sequenciais demoram mais no total e atrapalham menos — que é a
 * troca certa para uma rotina que roda de madrugada, uma vez por semana.
 */
export const LOTE_DE_EXCLUSAO = 5_000;

/**
 * Teto de linhas por execução.
 *
 * A primeira execução numa base antiga pode ter milhões de pontos vencidos.
 * Parar no teto e voltar na semana seguinte é preferível a uma rotina que roda
 * por horas na primeira vez — e o resultado diz explicitamente que sobrou, para
 * ninguém concluir que o expurgo terminou quando não terminou.
 */
export const MAXIMO_POR_EXECUCAO = 200_000;

export interface ResultadoDoExpurgo {
  localizacoesRemovidas: number;
  arquivosExpurgados: number;
  sessoesRemovidas: number;
  /** O teto foi atingido e ainda há dado vencido esperando a próxima execução. */
  restaram: boolean;
}

/** Nada foi encontrado para apagar? Distingue "rodou e estava limpo" de "não rodou". */
export function expurgoVazio(resultado: ResultadoDoExpurgo): boolean {
  return (
    resultado.localizacoesRemovidas === 0 &&
    resultado.arquivosExpurgados === 0 &&
    resultado.sessoesRemovidas === 0
  );
}

/** Frase única para o log e para a tela. */
export function resumirExpurgo(resultado: ResultadoDoExpurgo): string {
  if (expurgoVazio(resultado)) return 'Nada vencido: nenhum dado foi apagado.';

  const partes: string[] = [];
  if (resultado.localizacoesRemovidas > 0) {
    partes.push(
      `${resultado.localizacoesRemovidas.toLocaleString('pt-BR')} ${
        resultado.localizacoesRemovidas === 1 ? 'ponto de GPS' : 'pontos de GPS'
      }`,
    );
  }
  if (resultado.arquivosExpurgados > 0) {
    partes.push(
      `${resultado.arquivosExpurgados} ${
        resultado.arquivosExpurgados === 1 ? 'planilha' : 'planilhas'
      }`,
    );
  }
  if (resultado.sessoesRemovidas > 0) {
    partes.push(
      `${resultado.sessoesRemovidas} ${
        resultado.sessoesRemovidas === 1 ? 'sessão expirada' : 'sessões expiradas'
      }`,
    );
  }

  const texto = partes.join(' · ');
  return resultado.restaram
    ? `${texto}. O teto por execução foi atingido — ainda há dado vencido para a próxima rodada.`
    : `${texto}.`;
}
