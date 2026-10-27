import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import {
  EMPRESA,
  NOME_SISTEMA,
  type Coluna,
  type FormatoDeCelula,
  type ParDeIdentificacao,
} from '@/modulos/exportacao/exportacao.regras';

/**
 * Construção do arquivo `.xlsx` (US032 · doc 13 — `PlanilhaService`).
 *
 * Camada de infraestrutura: com `fechamento.planilhas.ts` — de desenho livre,
 * no formato que o cliente já usava —, é um dos dois arquivos que conhecem o
 * ExcelJS. As colunas, os rótulos e a ordem vêm de `exportacao.regras.ts`, que
 * é puro; aqui só se decide como aquilo vira bytes.
 *
 * A separação paga na hora de trocar de biblioteca — e paga antes disso, no
 * teste: verificar que a coluna "Km total" existe e é numérica não deveria
 * exigir descompactar um zip.
 */

/** Formatos numéricos do Excel, por tipo lógico de coluna. */
const FORMATO_NUMERICO: Record<FormatoDeCelula, string | undefined> = {
  texto: undefined,
  inteiro: '#,##0',
  decimal: '#,##0.00',
  data: 'dd/mm/yyyy',
  hora: 'hh:mm',
  dataHora: 'dd/mm/yyyy hh:mm',
};

const ALINHAMENTO_DIREITA = new Set<FormatoDeCelula>(['inteiro', 'decimal']);

const ROXO_CABECALHO = 'FF5B21B6';

function estilizarCabecalho(linha: ExcelJS.Row): void {
  linha.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  linha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO_CABECALHO } };
  linha.alignment = { vertical: 'middle', horizontal: 'left' };
  linha.height = 22;
}

export interface AbaDeDados<T> {
  nome: string;
  colunas: Coluna<T>[];
  registros: T[];
}

export interface Planilha<T> {
  identificacao: ParDeIdentificacao[];
  aba: AbaDeDados<T>;
  /**
   * Texto exibido no lugar da tabela quando não há registros. Usado pelo
   * consolidado diário, que **precisa** gerar arquivo mesmo em dia parado
   * (US033) — a exportação manual, por sua vez, é recusada antes de chegar aqui.
   */
  avisoQuandoVazio?: string;
}

/**
 * A primeira aba é de identificação, não de dados.
 *
 * Parece cerimônia e não é: seis meses depois, uma planilha solta numa pasta
 * compartilhada sem dizer de que período é e quem gerou não serve como
 * evidência de nada. É o que RN030 chama de rastreável.
 */
function montarAbaDeIdentificacao(
  livro: ExcelJS.Workbook,
  identificacao: ParDeIdentificacao[],
): void {
  const aba = livro.addWorksheet('Identificação', {
    properties: { defaultRowHeight: 18 },
  });

  aba.columns = [
    { key: 'rotulo', width: 22 },
    { key: 'valor', width: 52 },
  ];

  const titulo = aba.addRow([`${EMPRESA} · ${NOME_SISTEMA}`]);
  titulo.font = { bold: true, size: 14, color: { argb: ROXO_CABECALHO } };
  aba.mergeCells('A1:B1');
  aba.addRow([]);

  for (const par of identificacao) {
    const linha = aba.addRow([par.rotulo, par.valor]);
    linha.getCell(1).font = { bold: true };
    linha.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  }
}

/**
 * Valores de uma linha, na ordem das colunas.
 *
 * Compartilhado pelos dois caminhos de geração — o em memória e o em fluxo —
 * porque é aqui que mora a única decisão sutil: `null` vira célula vazia,
 * enquanto `''` viraria uma string vazia que o Excel conta como preenchida e
 * que atrapalha filtro e contagem.
 */
function valoresDaLinha<T>(colunas: Coluna<T>[], registro: T): (string | number | Date | null)[] {
  return colunas.map((coluna) => {
    const valor = coluna.valor(registro);
    return valor === null ? null : valor;
  });
}

function aplicarFormatos<T>(linha: ExcelJS.Row, colunas: Coluna<T>[]): void {
  colunas.forEach((coluna, indice) => {
    const celula = linha.getCell(indice + 1);
    const formato = FORMATO_NUMERICO[coluna.formato];
    if (formato) celula.numFmt = formato;
    if (ALINHAMENTO_DIREITA.has(coluna.formato)) {
      celula.alignment = { horizontal: 'right' };
    }
  });
}

/**
 * Cabeçalho congelado e filtro automático: a planilha existe para ser
 * trabalhada fora do sistema, e rolar 400 linhas sem saber de que coluna é o
 * número é o motivo mais comum de alguém desistir e voltar a pedir o dado.
 */
function congelarCabecalho<T>(aba: ExcelJS.Worksheet, colunas: Coluna<T>[]): void {
  aba.views = [{ state: 'frozen', ySplit: 1 }];
  aba.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colunas.length },
  };
}

function montarAbaDeDados<T>(livro: ExcelJS.Workbook, planilha: Planilha<T>): void {
  const { nome, colunas, registros } = planilha.aba;
  const aba = livro.addWorksheet(nome);

  aba.columns = colunas.map((coluna) => ({ width: coluna.largura }));

  if (registros.length === 0 && planilha.avisoQuandoVazio) {
    const aviso = aba.addRow([planilha.avisoQuandoVazio]);
    aviso.font = { italic: true, size: 12 };
    aba.mergeCells(1, 1, 1, Math.max(2, colunas.length));
    return;
  }

  estilizarCabecalho(aba.addRow(colunas.map((coluna) => coluna.cabecalho)));

  for (const registro of registros) {
    aplicarFormatos(aba.addRow(valoresDaLinha(colunas, registro)), colunas);
  }

  congelarCabecalho(aba, colunas);
}

export async function gerarPlanilha<T>(planilha: Planilha<T>): Promise<Buffer> {
  const livro = new ExcelJS.Workbook();
  livro.creator = `${EMPRESA} · ${NOME_SISTEMA}`;
  livro.created = new Date();

  montarAbaDeIdentificacao(livro, planilha.identificacao);
  montarAbaDeDados(livro, planilha);

  // `writeBuffer` devolve um ArrayBuffer-like; o `Buffer` é o que a camada de
  // armazenamento e a resposta HTTP consomem.
  const conteudo = await livro.xlsx.writeBuffer();
  return Buffer.from(conteudo as ArrayBuffer);
}

// ------------------------------------------------------------------ fluxo

export interface PlanilhaEmFluxo<T> {
  identificacao: ParDeIdentificacao[];
  aba: { nome: string; colunas: Coluna<T>[] };
  /**
   * Páginas de registros, lidas **sob demanda**.
   *
   * É um `AsyncIterable` e não um array porque é exatamente esta a diferença
   * entre os dois caminhos: quem chama consulta a próxima página só quando a
   * anterior já virou bytes, e nunca existe mais de uma na memória.
   */
  paginas: AsyncIterable<T[]>;
}

/**
 * Monta a planilha **sem manter as linhas na memória** (US031).
 *
 * O `Workbook` comum guarda cada célula como um objeto rico: cinquenta mil
 * linhas de corrida passam de meio gigabyte antes de virar um único byte de
 * arquivo. O `WorkbookWriter` do ExcelJS escreve cada linha no disco assim que
 * ela é confirmada, então o consumo fica plano — é o que torna "segundo plano"
 * diferente de "a mesma coisa, só que mais tarde".
 *
 * Duas opções não são enfeite:
 *
 * - `useSharedStrings: false` — a tabela de textos compartilhados só é gravada
 *   no fim e vive inteira na memória até lá, o que devolveria o problema que
 *   este caminho existe para resolver. Custa alguns bytes a mais no arquivo.
 * - `useStyles: true` — sem isso a coluna de km sai como texto, e o critério
 *   de aceitação pede célula numérica.
 *
 * Devolve o conteúdo como `Buffer` porque é o que a camada de armazenamento
 * consome. O arquivo final é uma fração do modelo em memória — um `.xlsx` é um
 * zip, e cinquenta mil linhas cabem em poucos megabytes —, então o pico está no
 * caminho de montagem, não aqui.
 */
export async function gerarPlanilhaEmFluxo<T>(
  planilha: PlanilhaEmFluxo<T>,
): Promise<{ conteudo: Buffer; linhas: number }> {
  const pasta = await mkdtemp(join(tmpdir(), 'bordo-exportacao-'));
  const caminho = join(pasta, 'planilha.xlsx');

  try {
    const livro = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: caminho,
      useStyles: true,
      useSharedStrings: false,
    });

    livro.creator = `${EMPRESA} · ${NOME_SISTEMA}`;
    livro.created = new Date();

    // A aba de identificação é escrita primeiro e fechada antes da de dados: no
    // modo de fluxo as abas são gravadas em ordem e não se pode voltar a uma já
    // confirmada. É a razão de o total de linhas precisar ser conhecido antes
    // de a primeira linha de dados ser lida.
    const identificacao = livro.addWorksheet('Identificação', {
      properties: { defaultRowHeight: 18 },
    });
    identificacao.columns = [
      { key: 'rotulo', width: 22 },
      { key: 'valor', width: 52 },
    ];

    const titulo = identificacao.addRow([`${EMPRESA} · ${NOME_SISTEMA}`]);
    titulo.font = { bold: true, size: 14, color: { argb: ROXO_CABECALHO } };
    titulo.commit();
    identificacao.addRow([]).commit();

    for (const par of planilha.identificacao) {
      const linha = identificacao.addRow([par.rotulo, par.valor]);
      linha.getCell(1).font = { bold: true };
      linha.getCell(2).alignment = { wrapText: true, vertical: 'top' };
      linha.commit();
    }
    identificacao.commit();

    const { nome, colunas } = planilha.aba;
    const dados = livro.addWorksheet(nome, {
      // `views` precisa vir na criação: o congelamento é gravado no cabeçalho
      // da aba, que no modo de fluxo já foi escrito quando a primeira linha
      // é confirmada.
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    dados.columns = colunas.map((coluna) => ({ width: coluna.largura }));

    const cabecalho = dados.addRow(colunas.map((coluna) => coluna.cabecalho));
    estilizarCabecalho(cabecalho);
    cabecalho.commit();

    let linhas = 0;

    for await (const pagina of planilha.paginas) {
      for (const registro of pagina) {
        const linha = dados.addRow(valoresDaLinha(colunas, registro));
        aplicarFormatos(linha, colunas);
        linha.commit();
        linhas += 1;
      }
    }

    dados.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: colunas.length },
    };
    dados.commit();

    await livro.commit();

    return { conteudo: await readFile(caminho), linhas };
  } finally {
    // O temporário sai mesmo quando a geração falha no meio — senão cada
    // tentativa frustrada deixaria uma planilha parcial no disco do servidor.
    await rm(pasta, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- leitura

/**
 * Converte o valor de uma célula em texto.
 *
 * O ExcelJS devolve sete formas diferentes para a mesma coluna, dependendo de
 * como a pessoa preencheu: texto puro, número, `Date`, texto rico, fórmula com
 * resultado, hiperlink e valor de erro. Tratar só `string` faria a importação
 * recusar a planilha que o próprio Excel produziu.
 */
function celulaComoTexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((parte) => parte.text).join('');
    if ('text' in valor) return String(valor.text);
    if ('result' in valor) return valor.result === undefined ? '' : String(valor.result);
    if ('error' in valor) return String(valor.error);
    return '';
  }
  return String(valor);
}

/**
 * Lê um `.xlsx` como uma matriz de textos (US015 · RF035).
 *
 * Este arquivo continua sendo o **único** que conhece o ExcelJS, agora nas duas
 * direções. A conferência do cabeçalho e a validação das linhas ficam em
 * `importacao.regras.ts`, que é puro — a fronteira é a mesma de sempre: aqui se
 * decide como bytes viram texto, lá se decide o que aquele texto significa.
 *
 * A aba escolhida é a de nome informado, com queda para a **primeira**: o
 * modelo distribuído tem os dados na primeira aba e as instruções na segunda,
 * mas quem monta a própria planilha costuma entregar uma aba só, com outro
 * nome. Recusar por causa do nome da aba seria um "cabeçalho inválido" que a
 * pessoa não teria como entender.
 */
export async function lerPlanilha(conteudo: Buffer, nomeDaAba?: string): Promise<string[][]> {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(conteudo as unknown as ArrayBuffer);

  const alvo =
    (nomeDaAba
      ? livro.worksheets.find(
          (aba) => aba.name.trim().toLowerCase() === nomeDaAba.trim().toLowerCase(),
        )
      : undefined) ?? livro.worksheets[0];

  if (!alvo) return [];

  const linhas: string[][] = [];

  alvo.eachRow({ includeEmpty: false }, (linha) => {
    const celulas: string[] = [];
    // `values` do ExcelJS é 1-based e traz um vazio na posição 0.
    const valores = linha.values as ExcelJS.CellValue[];
    for (let coluna = 1; coluna < valores.length; coluna += 1) {
      celulas.push(celulaComoTexto(valores[coluna] ?? null));
    }
    linhas.push(celulas);
  });

  // Linha inteiramente em branco é resíduo de edição, não registro.
  return linhas.filter((linha) => linha.some((celula) => celula.trim() !== ''));
}

// ----------------------------------------------------------------- modelo

export interface ColunaDoModeloDePlanilha {
  cabecalho: string;
  largura: number;
  exemplo: string;
  obrigatoria: boolean;
  ajuda: string;
}

export interface ModeloDePlanilha {
  aba: string;
  titulo: string;
  colunas: ColunaDoModeloDePlanilha[];
  /** Frases gerais, antes da tabela de colunas. */
  observacoes: string[];
}

/**
 * Modelo de importação: uma aba de dados e uma de instruções (US015).
 *
 * A aba de dados vem **primeiro** de propósito. O modelo é aberto para ser
 * preenchido, e o Excel abre na primeira aba: se as instruções viessem antes, a
 * pessoa preencheria a aba errada — e a leitura, que usa a primeira aba como
 * queda, encontraria as instruções no lugar dos dados.
 *
 * A linha de exemplo é critério de aceitação. Ela também é o motivo de o
 * cabeçalho ficar congelado: quem tem 60 linhas para digitar precisa continuar
 * vendo de que coluna é cada valor.
 */
export async function gerarPlanilhaDeModelo(modelo: ModeloDePlanilha): Promise<Buffer> {
  const livro = new ExcelJS.Workbook();
  livro.creator = `${EMPRESA} · ${NOME_SISTEMA}`;
  livro.created = new Date();

  const dados = livro.addWorksheet(modelo.aba);
  dados.columns = modelo.colunas.map((coluna) => ({ width: coluna.largura }));
  estilizarCabecalho(dados.addRow(modelo.colunas.map((coluna) => coluna.cabecalho)));

  const exemplo = dados.addRow(modelo.colunas.map((coluna) => coluna.exemplo));
  // O exemplo precisa ser reconhecível como exemplo: quem apagar a linha errada
  // importa "Carlos Pereira" para dentro do cadastro real.
  exemplo.font = { italic: true, color: { argb: 'FF8A8A8A' } };

  const aviso = dados.addRow(['↑ linha de exemplo — apague antes de importar']);
  aviso.font = { italic: true, bold: true, color: { argb: 'FFB4232C' } };
  dados.mergeCells(3, 1, 3, Math.max(2, modelo.colunas.length));

  dados.views = [{ state: 'frozen', ySplit: 1 }];

  const instrucoes = livro.addWorksheet('Instruções');
  instrucoes.columns = [{ width: 26 }, { width: 12 }, { width: 72 }];

  const titulo = instrucoes.addRow([modelo.titulo]);
  titulo.font = { bold: true, size: 14, color: { argb: ROXO_CABECALHO } };
  instrucoes.mergeCells('A1:C1');
  instrucoes.addRow([]);

  for (const observacao of modelo.observacoes) {
    const linha = instrucoes.addRow([observacao]);
    instrucoes.mergeCells(linha.number, 1, linha.number, 3);
    linha.alignment = { wrapText: true, vertical: 'top' };
  }

  instrucoes.addRow([]);
  estilizarCabecalho(instrucoes.addRow(['Coluna', 'Obrigatória', 'O que preencher']));

  for (const coluna of modelo.colunas) {
    const linha = instrucoes.addRow([
      coluna.cabecalho,
      coluna.obrigatoria ? 'Sim' : 'Não',
      coluna.ajuda,
    ]);
    linha.getCell(1).font = { bold: true };
    linha.getCell(3).alignment = { wrapText: true, vertical: 'top' };
  }

  const conteudo = await livro.xlsx.writeBuffer();
  return Buffer.from(conteudo as ArrayBuffer);
}
