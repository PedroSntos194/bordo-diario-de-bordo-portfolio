import ExcelJS from 'exceljs';
import { EMPRESA, NOME_SISTEMA } from '@/modulos/exportacao/exportacao.regras';
import {
  ROTULO_DA_CATEGORIA,
  datasDoCiclo,
  tipoDoDia,
  type CategoriaDaMedicao,
  type ContratoDaVan,
  type LinhaDoMotorista,
  type MedicaoDaVan,
} from '@/modulos/fechamento/fechamento.regras';
import type { Fechamento } from '@/modulos/fechamento/fechamento.servico';
import { ROTULO_DA_FORMA } from '@/modulos/pedagio/pedagio.regras';
import {
  comoDataParaPlanilha,
  formatarDataHora,
  formatarDataOperacional,
  formatarHora,
} from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

/**
 * As duas planilhas do fechamento, no **formato que o cliente já usa**
 * (`Relatorio HE` e `BM`, enviados em 07/10/2026).
 *
 * Diferente de `exportacao/planilha.ts`, que monta tabelas corridas a partir de
 * colunas declaradas, aqui o desenho é livre — blocos por van, subtotais por
 * motorista, quadro-resumo no pé —, por isso o ExcelJS aparece também neste
 * arquivo. Os números já chegam calculados por `fechamento.regras.ts`; as
 * fórmulas existem para a planilha continuar viva quando alguém ajustar uma
 * célula à mão, e trazem o resultado gravado para abrir certa mesmo sem
 * recálculo.
 */

export interface CabecalhoDoArquivo {
  geradoEm: Date;
  geradoPor: string;
}

const CINZA = 'FFD9D9D9';
const CINZA_CLARO = 'FFF2F2F2';
const LARANJA_CLARO = 'FFFCE4D6';
const VERMELHO = 'FFC00000';

const DINHEIRO = '"R$" #,##0.00';
const HORA = 'hh:mm';
const DURACAO = '[h]:mm';
const DATA_CURTA = 'dd/mm ddd';
const DATA = 'dd/mm/yyyy';

const BORDA_FINA: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function novoLivro(): ExcelJS.Workbook {
  const livro = new ExcelJS.Workbook();
  livro.creator = `${EMPRESA} · ${NOME_SISTEMA}`;
  livro.created = new Date();
  // O ExcelJS não grava o resultado quando ele é zero: sem recálculo ao abrir,
  // um total zerado apareceria em branco.
  livro.calcProperties.fullCalcOnLoad = true;
  return livro;
}

async function emBytes(livro: ExcelJS.Workbook): Promise<Buffer> {
  const conteudo = await livro.xlsx.writeBuffer();
  return Buffer.from(conteudo as ArrayBuffer);
}

/** `06:30` → fração do dia, que é como o Excel guarda hora. */
function horaDoDia(horario: string | null): number | null {
  if (!horario) return null;
  const [hora, minuto] = horario.split(':').map(Number);
  return ((hora ?? 0) * 60 + (minuto ?? 0)) / 1440;
}

const minutosNoDia = (minutos: number): number => minutos / 1440;

function formula(expressao: string, resultado: number): ExcelJS.CellFormulaValue {
  return { formula: expressao, result: resultado };
}

function estiloCabecalho(celula: ExcelJS.Cell): void {
  celula.font = { bold: true, size: 10 };
  celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA } };
  celula.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  celula.border = BORDA_FINA;
}

function emBloco(aba: ExcelJS.Worksheet, linha: number, de: number, ate: number): void {
  for (let coluna = de; coluna <= ate; coluna++) aba.getCell(linha, coluna).border = BORDA_FINA;
}

function titulo(aba: ExcelJS.Worksheet, linha: number, texto: string, colunas: number): void {
  aba.mergeCells(linha, 1, linha, colunas);
  const celula = aba.getCell(linha, 1);
  celula.value = texto;
  celula.font = { bold: true, size: 18 };
  celula.alignment = { horizontal: 'center', vertical: 'middle' };
  aba.getRow(linha).height = 30;
}

function abaDeIdentificacao(
  livro: ExcelJS.Workbook,
  relatorio: string,
  fechamento: Fechamento,
  cabecalho: CabecalhoDoArquivo,
  extras: [string, string][],
): void {
  const aba = livro.addWorksheet('Identificação');
  aba.columns = [{ width: 30 }, { width: 70 }];
  const titulo = aba.addRow([`${EMPRESA} · ${NOME_SISTEMA}`]);
  titulo.font = { bold: true, size: 14 };
  aba.addRow([]);

  const regras = fechamento.regras;
  const pares: [string, string][] = [
    ['Relatório', relatorio],
    ['Período', fechamento.rotulo],
    ['Gerado em', formatarDataHora(cabecalho.geradoEm)],
    ['Gerado por', cabecalho.geradoPor],
    [
      'Feriados no período',
      fechamento.feriados.length === 0
        ? 'Nenhum cadastrado'
        : fechamento.feriados
            .map((feriado) => `${formatarDataOperacional(feriado.data)} ${feriado.nome}`)
            .join('; '),
    ],
    ['Diária de hora extra', reais(regras.horaExtra.valorDiaria)],
    [
      'Hora extra quando',
      regras.horaExtra.exigeAmbas
        ? 'Entrou antes do limite E saiu depois do horário'
        : 'Entrou antes do limite OU saiu depois do horário',
    ],
    ['Entrada até', regras.horaExtra.limiteEntrada],
    [
      'Saída de referência',
      `Seg a qui ${regras.horaExtra.saidaSegQui} · sex a dom ${regras.horaExtra.saidaSexDom} · ` +
        `feriado ${regras.horaExtra.saidaFeriado}`,
    ],
    [
      'Turno da noite',
      `${regras.horaExtra.noturnoInicio} às ${regras.horaExtra.noturnoFim} do dia seguinte`,
    ],
    ...extras,
  ];
  for (const [rotulo, valor] of pares) {
    const linha = aba.addRow([rotulo, valor]);
    linha.getCell(1).font = { bold: true };
    linha.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  }
}

function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function contratoPorPlaca(fechamento: Fechamento): Map<string, ContratoDaVan> {
  return new Map(fechamento.vans.map((van) => [van.contrato.placa, van.contrato]));
}

function porMotorista(linhas: readonly LinhaDoMotorista[]): [string, LinhaDoMotorista[]][] {
  const grupos = new Map<string, LinhaDoMotorista[]>();
  for (const linha of linhas) {
    const grupo = grupos.get(linha.motoristaId) ?? [];
    grupo.push(linha);
    grupos.set(linha.motoristaId, grupo);
  }
  return [...grupos.values()]
    .map((grupo): [string, LinhaDoMotorista[]] => [
      grupo[0]!.motorista,
      [...grupo].sort((a, b) => a.data.localeCompare(b.data)),
    ])
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}

// ================================================================ motoristas

const COLUNAS_HE = [
  { cabecalho: 'DATA', largura: 12 },
  { cabecalho: 'PLACA', largura: 11 },
  { cabecalho: 'MOTORISTA', largura: 26 },
  { cabecalho: 'TIPO VEÍCULO', largura: 13 },
  { cabecalho: 'ORIGEM', largura: 14 },
  { cabecalho: 'CANTEIRO', largura: 14 },
  { cabecalho: 'TURNO', largura: 10 },
  { cabecalho: 'H. REF. INICIAL', largura: 10 },
  { cabecalho: 'H. INICIAL', largura: 10 },
  { cabecalho: 'HE INICIAL', largura: 10 },
  { cabecalho: 'H. REF. FINAL', largura: 10 },
  { cabecalho: 'H. FINAL', largura: 10 },
  { cabecalho: 'HE FINAL', largura: 10 },
  { cabecalho: 'TOTAL HE', largura: 10 },
  // As duas colunas de valor do `Relatorio HE`. Lá, VLR HE era o preço da hora
  // e VLR TOTAL, horas × preço; com a regra de 07/10, VLR HE é a diária e VLR
  // TOTAL é a diária quando o dia teve hora extra.
  { cabecalho: 'VLR HE', largura: 12 },
  { cabecalho: 'VLR TOTAL', largura: 13 },
  { cabecalho: 'CONFERIR', largura: 44 },
] as const;

/** Como o `Relatorio HE` escreve o tipo: só ônibus ou van — o turno vai em TURNO. */
function tipoDoVeiculo(categoria: CategoriaDaMedicao | null | undefined): string {
  if (!categoria) return '';
  return categoria === 'ONIBUS' ? 'ÔNIBUS' : 'VAN';
}

function abaDeHoraExtra(livro: ExcelJS.Workbook, fechamento: Fechamento): void {
  const aba = livro.addWorksheet('Hora extra', {
    views: [{ state: 'frozen', ySplit: 3 }],
    // Como o `Relatorio HE`: A4 deitado, uma página de largura.
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '1:3',
    },
  });
  aba.columns = COLUNAS_HE.map((coluna) => ({ width: coluna.largura }));
  const total = COLUNAS_HE.length;

  titulo(aba, 1, 'RELATÓRIO DE HORAS EXTRAS', total);
  aba.getCell(2, 1).value = `PERÍODO: ${fechamento.rotulo}`;
  aba.getCell(2, 1).font = { bold: true };
  aba.mergeCells(2, 1, 2, 7);

  COLUNAS_HE.forEach((coluna, indice) => {
    const celula = aba.getCell(3, indice + 1);
    celula.value = coluna.cabecalho;
    estiloCabecalho(celula);
  });

  const contratos = contratoPorPlaca(fechamento);
  const subtotais: string[] = [];
  let somaDiarias = 0;
  let linha = 4;

  for (const [motorista, dias] of porMotorista(fechamento.linhas)) {
    const primeira = linha;
    for (const dia of dias) {
      const he = dia.horaExtra;
      const contrato = contratos.get(dia.placa.split(' / ')[0]!);
      const valores = [
        comoDataParaPlanilha(dia.data),
        dia.placa.split(' / ').map(formatarPlaca).join(' / '),
        motorista,
        tipoDoVeiculo(contrato?.categoria),
        contrato?.linhaOrigem ?? '',
        contrato?.linhaDestino ?? '',
        dia.noturno ? 'NOTURNO' : 'DIURNO',
        horaDoDia(he.referenciaEntrada),
        horaDoDia(he.entrada),
        minutosNoDia(he.minutosAntes),
        horaDoDia(he.referenciaSaida),
        he.saida ? horaDoDia(he.saida) : 'aberto',
        minutosNoDia(he.minutosDepois),
        minutosNoDia(he.minutosAntes + he.minutosDepois),
        fechamento.regras.horaExtra.valorDiaria,
        he.valor,
        he.conferir.join('; '),
      ];
      const registro = aba.getRow(linha);
      registro.values = valores;
      registro.getCell(1).numFmt = DATA_CURTA;
      for (const coluna of [8, 9, 11, 12]) registro.getCell(coluna).numFmt = HORA;
      for (const coluna of [10, 13, 14]) registro.getCell(coluna).numFmt = DURACAO;
      registro.getCell(15).numFmt = DINHEIRO;
      registro.getCell(16).numFmt = DINHEIRO;
      if (he.conferir.length > 0) registro.getCell(17).font = { color: { argb: VERMELHO } };
      emBloco(aba, linha, 1, total);
      linha += 1;
    }

    const valorDoMotorista =
      dias.reduce((soma, dia) => soma + Math.round(dia.horaExtra.valor * 100), 0) / 100;
    const minutosDoMotorista = dias.reduce(
      (soma, dia) => soma + dia.horaExtra.minutosAntes + dia.horaExtra.minutosDepois,
      0,
    );
    somaDiarias += Math.round(valorDoMotorista * 100);

    const sub = aba.getRow(linha);
    sub.getCell(1).value = `SUB TOTAL · ${motorista}`;
    aba.mergeCells(linha, 1, linha, 13);
    sub.getCell(14).value = formula(
      `SUM(N${primeira}:N${linha - 1})`,
      minutosNoDia(minutosDoMotorista),
    );
    sub.getCell(14).numFmt = DURACAO;
    sub.getCell(16).value = formula(`SUM(P${primeira}:P${linha - 1})`, valorDoMotorista);
    sub.getCell(16).numFmt = DINHEIRO;
    sub.font = { bold: true };
    for (let coluna = 1; coluna <= total; coluna++) {
      sub.getCell(coluna).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: CINZA_CLARO },
      };
    }
    emBloco(aba, linha, 1, total);
    subtotais.push(`P${linha}`);
    linha += 2;
  }

  if (subtotais.length === 0) {
    aba.getCell(4, 1).value = 'Nenhum dia de trabalho no período.';
    aba.getCell(4, 1).font = { italic: true };
    return;
  }

  // Filtro no cabeçalho, como no `Relatorio HE`: filtrar por motorista ou placa.
  aba.autoFilter = { from: { row: 3, column: 1 }, to: { row: linha - 2, column: total } };

  const geral = aba.getRow(linha);
  geral.getCell(1).value = 'TOTAL GERAL';
  aba.mergeCells(linha, 1, linha, 15);
  geral.getCell(16).value = formula(subtotais.join('+'), somaDiarias / 100);
  geral.getCell(16).numFmt = DINHEIRO;
  geral.font = { bold: true, size: 12 };
  emBloco(aba, linha, 1, 16);
}

function abaDeKm(livro: ExcelJS.Workbook, fechamento: Fechamento): void {
  const aba = livro.addWorksheet('Km excedente', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  aba.columns = [
    { width: 12 },
    { width: 18 },
    { width: 26 },
    { width: 12 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
  ];
  titulo(aba, 1, 'KM EXCEDENTE DOS MOTORISTAS', 7);
  const { limiteDia, valorPorKm } = fechamento.regras.km;
  aba.getCell(2, 1).value =
    `PERÍODO: ${fechamento.rotulo} · ${reais(valorPorKm)} por km acima de ${limiteDia} km no dia ` +
    '(diferença dos odômetros do dia)';
  aba.mergeCells(2, 1, 2, 7);

  ['DATA', 'PLACA', 'MOTORISTA', 'KM DO DIA', 'LIMITE', 'KM EXCEDENTE', 'VALOR'].forEach(
    (texto, indice) => {
      const celula = aba.getCell(4, indice + 1);
      celula.value = texto;
      estiloCabecalho(celula);
    },
  );

  let linha = 5;
  const subtotais: string[] = [];
  let somaCentavos = 0;

  for (const [motorista, dias] of porMotorista(fechamento.linhas)) {
    const excedidos = dias.filter((dia) => dia.kmExcedente > 0);
    if (excedidos.length === 0) continue;
    const primeira = linha;
    for (const dia of excedidos) {
      const registro = aba.getRow(linha);
      registro.values = [
        comoDataParaPlanilha(dia.data),
        dia.placa.split(' / ').map(formatarPlaca).join(' / '),
        motorista,
        dia.km,
        limiteDia,
        dia.kmExcedente,
        dia.valorKm,
      ];
      registro.getCell(1).numFmt = DATA_CURTA;
      registro.getCell(7).numFmt = DINHEIRO;
      emBloco(aba, linha, 1, 7);
      linha += 1;
    }
    const valor = excedidos.reduce((soma, dia) => soma + Math.round(dia.valorKm * 100), 0);
    somaCentavos += valor;
    const sub = aba.getRow(linha);
    sub.getCell(1).value = `SUB TOTAL · ${motorista}`;
    aba.mergeCells(linha, 1, linha, 5);
    sub.getCell(6).value = formula(
      `SUM(F${primeira}:F${linha - 1})`,
      excedidos.reduce((soma, dia) => soma + dia.kmExcedente, 0),
    );
    sub.getCell(7).value = formula(`SUM(G${primeira}:G${linha - 1})`, valor / 100);
    sub.getCell(7).numFmt = DINHEIRO;
    sub.font = { bold: true };
    emBloco(aba, linha, 1, 7);
    subtotais.push(`G${linha}`);
    linha += 2;
  }

  if (subtotais.length === 0) {
    aba.getCell(5, 1).value = `Nenhum dia passou de ${limiteDia} km no período.`;
    aba.getCell(5, 1).font = { italic: true };
    return;
  }

  const geral = aba.getRow(linha);
  geral.getCell(1).value = 'TOTAL GERAL';
  aba.mergeCells(linha, 1, linha, 6);
  geral.getCell(7).value = formula(subtotais.join('+'), somaCentavos / 100);
  geral.getCell(7).numFmt = DINHEIRO;
  geral.font = { bold: true, size: 12 };
  emBloco(aba, linha, 1, 7);
}

function abaDeResumoDosMotoristas(livro: ExcelJS.Workbook, fechamento: Fechamento): void {
  const aba = livro.addWorksheet('Resumo', {
    pageSetup: { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  aba.columns = [
    { width: 30 },
    { width: 12 },
    { width: 12 },
    { width: 15 },
    { width: 13 },
    { width: 15 },
    { width: 16 },
    { width: 13 },
  ];
  titulo(aba, 1, 'PAGAMENTO DOS MOTORISTAS', 8);
  aba.getCell(2, 1).value = `PERÍODO: ${fechamento.rotulo}`;
  aba.getCell(2, 1).font = { bold: true };
  aba.mergeCells(2, 1, 2, 8);

  [
    'MOTORISTA',
    'DIAS',
    'DIÁRIAS HE',
    'VALOR HE',
    'KM EXCEDENTE',
    'VALOR KM',
    'TOTAL A PAGAR',
    'DIAS A CONFERIR',
  ].forEach((texto, indice) => {
    const celula = aba.getCell(4, indice + 1);
    celula.value = texto;
    estiloCabecalho(celula);
  });

  let linha = 5;
  for (const motorista of fechamento.motoristas) {
    const registro = aba.getRow(linha);
    registro.values = [
      motorista.motorista,
      motorista.dias,
      motorista.diarias,
      motorista.valorHoraExtra,
      motorista.kmExcedente,
      motorista.valorKm,
      formula(`D${linha}+F${linha}`, motorista.total),
      motorista.diasParaConferir,
    ];
    for (const coluna of [4, 6, 7]) registro.getCell(coluna).numFmt = DINHEIRO;
    if (motorista.diasParaConferir > 0) registro.getCell(8).font = { color: { argb: VERMELHO } };
    emBloco(aba, linha, 1, 8);
    linha += 1;
  }

  if (fechamento.motoristas.length === 0) {
    aba.getCell(5, 1).value = 'Nenhum dia de trabalho no período.';
    aba.getCell(5, 1).font = { italic: true };
    return;
  }

  const soma = (campo: (m: Fechamento['motoristas'][number]) => number) =>
    fechamento.motoristas.reduce((total, m) => total + campo(m), 0);
  const centavos = (campo: (m: Fechamento['motoristas'][number]) => number) =>
    soma((m) => Math.round(campo(m) * 100)) / 100;

  const ultima = linha - 1;
  const total = aba.getRow(linha);
  total.values = [
    'TOTAL',
    formula(
      `SUM(B5:B${ultima})`,
      soma((m) => m.dias),
    ),
    formula(
      `SUM(C5:C${ultima})`,
      soma((m) => m.diarias),
    ),
    formula(
      `SUM(D5:D${ultima})`,
      centavos((m) => m.valorHoraExtra),
    ),
    formula(
      `SUM(E5:E${ultima})`,
      soma((m) => m.kmExcedente),
    ),
    formula(
      `SUM(F5:F${ultima})`,
      centavos((m) => m.valorKm),
    ),
    formula(
      `SUM(G5:G${ultima})`,
      centavos((m) => m.total),
    ),
    formula(
      `SUM(H5:H${ultima})`,
      soma((m) => m.diasParaConferir),
    ),
  ];
  for (const coluna of [4, 6, 7]) total.getCell(coluna).numFmt = DINHEIRO;
  total.font = { bold: true };
  emBloco(aba, linha, 1, 8);

  if (fechamento.avisos.diasParaConferir > 0) {
    const aviso = aba.getCell(linha + 2, 1);
    aviso.value =
      `${fechamento.avisos.diasParaConferir} dia(s) marcados para conferir na aba "Hora extra" ` +
      '(coluna CONFERIR) antes de pagar.';
    aviso.font = { italic: true, color: { argb: VERMELHO } };
    aba.mergeCells(linha + 2, 1, linha + 2, 8);
  }
}

/** Pagamento dos motoristas: resumo, hora extra no formato do cliente e km excedente. */
export async function planilhaDosMotoristas(
  fechamento: Fechamento,
  cabecalho: CabecalhoDoArquivo,
): Promise<Buffer> {
  const livro = novoLivro();
  abaDeResumoDosMotoristas(livro, fechamento);
  abaDeHoraExtra(livro, fechamento);
  abaDeKm(livro, fechamento);
  abaDeIdentificacao(livro, 'Pagamento dos motoristas', fechamento, cabecalho, [
    [
      'Km excedente',
      `${reais(fechamento.regras.km.valorPorKm)} por km acima de ` +
        `${fechamento.regras.km.limiteDia} km no dia`,
    ],
  ]);
  return emBytes(livro);
}

// ================================================================ medição

const ORDEM_DAS_CATEGORIAS: (CategoriaDaMedicao | 'SEM_CATEGORIA')[] = [
  'ONIBUS',
  'VAN_DIURNA',
  'VAN_NOTURNA',
  'SEM_CATEGORIA',
];

const NOME_NO_QUADRO: Record<CategoriaDaMedicao | 'SEM_CATEGORIA', string> = {
  ONIBUS: 'ÔNIBUS',
  VAN_DIURNA: 'VAN DIURNA',
  VAN_NOTURNA: 'VAN NOTURNA',
  SEM_CATEGORIA: 'SEM CATEGORIA',
};

const PREFIXO_NO_QUADRO: Record<CategoriaDaMedicao | 'SEM_CATEGORIA', string> = {
  ONIBUS: 'ÔNIBUS',
  VAN_DIURNA: 'VAN',
  VAN_NOTURNA: 'VAN NOTURNO',
  SEM_CATEGORIA: 'SEM CATEGORIA',
};

interface CelulasDaVan {
  categoria: CategoriaDaMedicao | 'SEM_CATEGORIA';
  medicao: MedicaoDaVan;
  /** Endereços das células de quantidade e de valor de cada linha. */
  normal: { quantidade: string; valor: string };
  km: { quantidade: string; valor: string };
  extra: { quantidade: string; valor: string };
  total: string;
}

/** O mesmo valor em todas as vans da categoria vira unitário; se variar, fica vazio. */
function unitarioComum(valores: (number | null)[]): number | null {
  const distintos = new Set(valores.filter((valor): valor is number => valor !== null));
  return distintos.size === 1 ? [...distintos][0]! : null;
}

function abaDoBoletim(livro: ExcelJS.Workbook, fechamento: Fechamento): void {
  const datas = datasDoCiclo(fechamento.ciclo);
  const feriados = new Set(fechamento.feriados.map((feriado) => feriado.data));
  const PRIMEIRO_DIA = 6;
  const colTotal = PRIMEIRO_DIA + datas.length;
  const colUnitario = colTotal + 1;
  const colDia = colTotal + 2;
  const colMedicao = colTotal + 3;
  const colPendencias = colTotal + 4;

  const aba = livro.addWorksheet('Boletim', {
    views: [{ state: 'frozen', xSplit: 5, ySplit: 2 }],
    // Como o BM: A3 deitado, uma página de largura, cabeçalho em toda página.
    pageSetup: {
      // A3 — o formato existe no Excel, só falta na tipagem do ExcelJS.
      paperSize: 8 as ExcelJS.PaperSize,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '1:2',
    },
  });
  aba.columns = [
    { width: 6 },
    { width: 14 },
    { width: 17 },
    { width: 17 },
    { width: 19 },
    ...datas.map(() => ({ width: 7 })),
    { width: 10 },
    { width: 15 },
    { width: 15 },
    { width: 17 },
    { width: 50 },
  ];

  const letra = (coluna: number): string => aba.getColumn(coluna).letter;
  const cTotal = letra(colTotal);
  const cDia = letra(colDia);
  const cMedicao = letra(colMedicao);

  // Cabeçalho no desenho do BM: razão social ao centro, contrato e período à
  // direita, acima dos totais. Com 31 dias as colunas caem onde caíam no BM.
  const { razaoSocial, contrato: numeroDoContrato } = fechamento.regras.boletim;
  const fimDoTitulo = colTotal - 10;
  aba.mergeCells(1, 1, 2, 3);
  const rotuloBm = aba.getCell(1, 1);
  rotuloBm.value = 'BOLETIM DE MEDIÇÃO';
  rotuloBm.font = { bold: true, size: 12 };
  rotuloBm.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  aba.mergeCells(1, 4, 2, fimDoTitulo);
  const razao = aba.getCell(1, 4);
  razao.value = razaoSocial || EMPRESA.toUpperCase();
  razao.font = { bold: true, size: 20 };
  razao.alignment = { horizontal: 'center', vertical: 'middle' };

  aba.mergeCells(1, fimDoTitulo + 1, 1, colTotal - 1);
  aba.mergeCells(2, fimDoTitulo + 1, 2, colTotal - 1);
  aba.getCell(1, fimDoTitulo + 1).value = 'CONTRATO:';
  aba.getCell(2, fimDoTitulo + 1).value = numeroDoContrato || '—';

  aba.mergeCells(1, colTotal, 1, colUnitario);
  aba.getCell(1, colTotal).value = 'PERÍODO';
  aba.getCell(2, colTotal).value = comoDataParaPlanilha(fechamento.ciclo.inicio);
  aba.getCell(2, colUnitario).value = comoDataParaPlanilha(fechamento.ciclo.fim);
  for (const coluna of [colTotal, colUnitario]) aba.getCell(2, coluna).numFmt = DATA;

  for (const [linhaDoTopo, de, ate] of [
    [1, fimDoTitulo + 1, colUnitario],
    [2, fimDoTitulo + 1, colUnitario],
  ] as const) {
    for (let coluna = de; coluna <= ate; coluna++) {
      const celula = aba.getCell(linhaDoTopo, coluna);
      celula.font = { bold: true, size: linhaDoTopo === 1 ? 10 : 12 };
      celula.alignment = { horizontal: 'center', vertical: 'middle' };
      celula.border = BORDA_FINA;
    }
  }
  aba.getRow(1).height = 22;
  aba.getRow(2).height = 22;

  const vans = [...fechamento.vans].sort((a, b) => {
    const ordem = (van: MedicaoDaVan) =>
      ORDEM_DAS_CATEGORIAS.indexOf(van.contrato.categoria ?? 'SEM_CATEGORIA');
    return ordem(a) - ordem(b) || a.contrato.placa.localeCompare(b.contrato.placa);
  });

  const celulas: CelulasDaVan[] = [];
  let linha = 4;

  vans.forEach((van, indice) => {
    const contrato = van.contrato;
    const numero = indice + 1;
    const placa = formatarPlaca(contrato.placa);
    const cliente = contrato.cliente ?? '';

    // Cabeçalho do bloco, com sábado, domingo e feriado destacados.
    const cabecalho = aba.getRow(linha);
    cabecalho.values = [
      'Nº',
      'PLACA',
      'LINHA',
      'EMPRESA',
      'DESCRIÇÃO DAS LINHAS',
      ...datas.map((data) => comoDataParaPlanilha(data)),
      'TOTAL',
      'VALOR UNITÁRIO',
      'VALOR DIA',
      'VALOR MEDIÇÃO',
    ];
    for (let coluna = 1; coluna <= colMedicao; coluna++) estiloCabecalho(cabecalho.getCell(coluna));
    datas.forEach((data, posicao) => {
      const celula = cabecalho.getCell(PRIMEIRO_DIA + posicao);
      celula.numFmt = DATA_CURTA;
      if (tipoDoDia(data, feriados) === 'EXTRA') {
        celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA_CLARO } };
      }
    });
    cabecalho.height = 30;
    if (van.pendencias.length > 0) {
      const aviso = cabecalho.getCell(colPendencias);
      aviso.value = `Conferir: ${van.pendencias.join('; ')}`;
      aviso.font = { italic: true, color: { argb: VERMELHO } };
      aviso.alignment = { wrapText: true, vertical: 'middle' };
    }

    const normais = new Set(van.diasNormais);
    const extras = new Set(van.diasExtras);
    const intervalo = (r: number) => `${letra(PRIMEIRO_DIA)}${r}:${letra(colTotal - 1)}${r}`;

    const rNormal = linha + 1;
    const rKm = linha + 2;
    const rExtra = linha + 3;
    const rTotal = linha + 4;

    const montar = (
      r: number,
      rotuloLinha: string,
      descricao: string,
      porDia: (data: string) => number | null,
      quantidade: number,
      unitario: number | null,
      valorDia: number | null,
      valor: number,
    ) => {
      const registro = aba.getRow(r);
      registro.values = [
        numero,
        placa,
        rotuloLinha,
        cliente,
        descricao,
        ...datas.map(porDia),
        formula(`SUM(${intervalo(r)})`, quantidade),
        unitario,
        valorDia,
        formula(`${cDia}${r}*${cTotal}${r}`, valor),
      ];
      registro.getCell(colUnitario).numFmt = DINHEIRO;
      registro.getCell(colDia).numFmt = DINHEIRO;
      registro.getCell(colMedicao).numFmt = DINHEIRO;
      for (let coluna = PRIMEIRO_DIA; coluna <= colTotal; coluna++) {
        registro.getCell(coluna).alignment = { horizontal: 'center' };
      }
      emBloco(aba, r, 1, colMedicao);
    };

    montar(
      rNormal,
      'ORIGEM',
      'NORMAL',
      (data) => (normais.has(data) ? 1 : null),
      van.diasNormais.length,
      contrato.valorMensal,
      van.valorDia,
      van.valorNormal,
    );
    montar(
      rKm,
      contrato.linhaOrigem ?? '',
      'KM EXCEDIDO',
      (data) => van.kmExcedidoPorDia[data] ?? null,
      van.kmExcedido,
      null,
      contrato.valorKmExcedido,
      van.valorKm,
    );
    montar(
      rExtra,
      'DESTINO',
      'EXTRA S/D/F',
      (data) => (extras.has(data) ? 1 : null),
      van.diasExtras.length,
      null,
      contrato.valorDiaExtra,
      van.valorExtra,
    );

    const rodape = aba.getRow(rTotal);
    rodape.getCell(1).value = van.motoristas.join(', ');
    aba.mergeCells(rTotal, 1, rTotal, 2);
    rodape.getCell(3).value = contrato.linhaDestino ?? '';
    rodape.getCell(4).value = cliente;
    rodape.getCell(5).value = contrato.categoria
      ? ROTULO_DA_CATEGORIA[contrato.categoria].toUpperCase()
      : 'SEM CATEGORIA';
    rodape.getCell(colTotal).value = 'TOTAL >>>';
    aba.mergeCells(rTotal, colTotal, rTotal, colDia);
    rodape.getCell(colMedicao).value = formula(
      `SUM(${cMedicao}${rNormal}:${cMedicao}${rExtra})`,
      van.total,
    );
    rodape.getCell(colMedicao).numFmt = DINHEIRO;
    rodape.font = { bold: true };
    emBloco(aba, rTotal, 1, colMedicao);

    celulas.push({
      categoria: contrato.categoria ?? 'SEM_CATEGORIA',
      medicao: van,
      normal: { quantidade: `${cTotal}${rNormal}`, valor: `${cMedicao}${rNormal}` },
      km: { quantidade: `${cTotal}${rKm}`, valor: `${cMedicao}${rKm}` },
      extra: { quantidade: `${cTotal}${rExtra}`, valor: `${cMedicao}${rExtra}` },
      total: `${cMedicao}${rTotal}`,
    });

    linha = rTotal + 2;
  });

  if (vans.length === 0) {
    aba.getCell(linha, 1).value =
      'Nenhuma van com contrato ou com dia trabalhado no período. Preencha o contrato em Veículos.';
    aba.getCell(linha, 1).font = { italic: true };
    linha += 2;
  }

  // ---------------------------------------------------- quadro-resumo
  const colDescricao = colTotal - 7;
  const colQuantidade = colUnitario;
  const colValorUnitario = colDia;
  const colValorTotal = colMedicao;

  const linhaDoQuadro = (
    r: number,
    descricao: string,
    quantidade: ExcelJS.CellValue,
    unitario: ExcelJS.CellValue,
    total: ExcelJS.CellValue,
    negrito = false,
  ) => {
    aba.mergeCells(r, colDescricao, r, colTotal);
    const registro = aba.getRow(r);
    registro.getCell(colDescricao).value = descricao;
    registro.getCell(colQuantidade).value = quantidade;
    registro.getCell(colValorUnitario).value = unitario;
    registro.getCell(colValorTotal).value = total;
    registro.getCell(colValorUnitario).numFmt = DINHEIRO;
    registro.getCell(colValorTotal).numFmt = DINHEIRO;
    if (negrito) {
      for (const coluna of [colDescricao, colQuantidade, colValorUnitario, colValorTotal]) {
        registro.getCell(coluna).font = { bold: true };
      }
    }
    emBloco(aba, r, colDescricao, colValorTotal);
  };

  const tituloDoQuadro = (r: number, texto: string) => {
    aba.mergeCells(r, colDescricao, r, colValorTotal);
    const celula = aba.getCell(r, colDescricao);
    celula.value = texto;
    estiloCabecalho(celula);
  };

  const somaDe = (enderecos: string[], resultado: number): ExcelJS.CellValue =>
    enderecos.length === 0 ? 0 : formula(enderecos.join('+'), resultado);

  const centavos = (valores: number[]) =>
    valores.reduce((soma, valor) => soma + Math.round(valor * 100), 0) / 100;

  linha += 1;
  const totaisDasCategorias: string[] = [];
  let centavosVeiculos = 0;

  for (const categoria of ORDEM_DAS_CATEGORIAS) {
    const daCategoria = celulas.filter((celula) => celula.categoria === categoria);
    if (daCategoria.length === 0) continue;
    const prefixo = PREFIXO_NO_QUADRO[categoria];
    const medicoes = daCategoria.map((celula) => celula.medicao);

    tituloDoQuadro(linha, `${NOME_NO_QUADRO[categoria]} · ${daCategoria.length} veículo(s)`);
    linha += 1;
    aba.mergeCells(linha, colDescricao, linha, colTotal);
    const cabecalho = aba.getRow(linha);
    cabecalho.getCell(colDescricao).value = 'DESCRIÇÃO';
    cabecalho.getCell(colQuantidade).value = 'QTDE';
    cabecalho.getCell(colValorUnitario).value = 'VALOR UNITÁRIO';
    cabecalho.getCell(colValorTotal).value = 'VALOR TOTAL';
    for (const coluna of [colDescricao, colQuantidade, colValorUnitario, colValorTotal]) {
      estiloCabecalho(cabecalho.getCell(coluna));
    }
    linha += 1;

    const primeira = linha;
    linhaDoQuadro(
      linha++,
      `${prefixo} (SEG A SEX)`,
      somaDe(
        daCategoria.map((celula) => celula.normal.quantidade),
        medicoes.reduce((soma, van) => soma + van.diasNormais.length, 0),
      ),
      unitarioComum(medicoes.map((van) => van.valorDia)),
      somaDe(
        daCategoria.map((celula) => celula.normal.valor),
        centavos(medicoes.map((van) => van.valorNormal)),
      ),
    );
    linhaDoQuadro(
      linha++,
      `${prefixo} KM EXCEDIDO`,
      somaDe(
        daCategoria.map((celula) => celula.km.quantidade),
        medicoes.reduce((soma, van) => soma + van.kmExcedido, 0),
      ),
      unitarioComum(medicoes.map((van) => van.contrato.valorKmExcedido)),
      somaDe(
        daCategoria.map((celula) => celula.km.valor),
        centavos(medicoes.map((van) => van.valorKm)),
      ),
    );
    linhaDoQuadro(
      linha++,
      `${prefixo} EXTRA SÁBADO/DOM/FERIADO`,
      somaDe(
        daCategoria.map((celula) => celula.extra.quantidade),
        medicoes.reduce((soma, van) => soma + van.diasExtras.length, 0),
      ),
      unitarioComum(medicoes.map((van) => van.contrato.valorDiaExtra)),
      somaDe(
        daCategoria.map((celula) => celula.extra.valor),
        centavos(medicoes.map((van) => van.valorExtra)),
      ),
    );
    const totalDaCategoria = centavos(medicoes.map((van) => van.total));
    centavosVeiculos += Math.round(totalDaCategoria * 100);
    linhaDoQuadro(
      linha,
      `TOTAL ${NOME_NO_QUADRO[categoria]}`,
      null,
      null,
      formula(`SUM(${cMedicao}${primeira}:${cMedicao}${linha - 1})`, totalDaCategoria),
      true,
    );
    totaisDasCategorias.push(`${cMedicao}${linha}`);
    linha += 2;
  }

  const totalVeiculos = centavosVeiculos / 100;
  linhaDoQuadro(
    linha,
    'TOTAL VEÍCULOS',
    null,
    null,
    somaDe(totaisDasCategorias, totalVeiculos),
    true,
  );
  const rVeiculos = linha;
  linha += 2;

  // Hora extra: pré-preenchida com as diárias do período, como valor e não
  // fórmula — é a célula que a administração ajusta se cobrar diferente.
  tituloDoQuadro(linha++, 'HORAS EXTRAS');
  linhaDoQuadro(linha, `HORAS EXTRAS ${fechamento.rotulo}`, null, null, fechamento.totalHoraExtra);
  const rHoraExtra = linha;
  linha += 2;

  tituloDoQuadro(linha++, 'PEDÁGIOS');
  linhaDoQuadro(
    linha,
    `PEDÁGIOS ${fechamento.rotulo}`,
    null,
    null,
    fechamento.medicao.totalPedagios,
  );
  const rPedagios = linha;
  linha += 2;

  linhaDoQuadro(
    linha,
    'TOTAL GERAL MEDIÇÃO',
    null,
    null,
    formula(
      `${cMedicao}${rVeiculos}+${cMedicao}${rHoraExtra}+${cMedicao}${rPedagios}`,
      fechamento.totalGeral,
    ),
    true,
  );
  aba.getRow(linha).getCell(colValorTotal).font = { bold: true, size: 12 };
}

function abaDePedagios(livro: ExcelJS.Workbook, fechamento: Fechamento): void {
  const aba = livro.addWorksheet('Pedágios', { views: [{ state: 'frozen', ySplit: 3 }] });
  aba.columns = [
    { width: 12 },
    { width: 11 },
    { width: 26 },
    { width: 8 },
    { width: 12 },
    { width: 10 },
    { width: 24 },
  ];
  titulo(aba, 1, 'PEDÁGIOS', 7);
  aba.getCell(2, 1).value = `PERÍODO: ${fechamento.rotulo}`;
  aba.mergeCells(2, 1, 2, 7);
  ['DATA', 'PLACA', 'MOTORISTA', 'HORA', 'VALOR', 'PAGAMENTO', 'PRAÇA'].forEach((texto, indice) => {
    const celula = aba.getCell(3, indice + 1);
    celula.value = texto;
    estiloCabecalho(celula);
  });

  if (fechamento.pedagios.length === 0) {
    aba.getCell(4, 1).value = 'Nenhum pedágio registrado no período.';
    aba.getCell(4, 1).font = { italic: true };
    return;
  }

  let linha = 4;
  for (const pedagio of fechamento.pedagios) {
    const registro = aba.getRow(linha);
    registro.values = [
      comoDataParaPlanilha(pedagio.data),
      formatarPlaca(pedagio.placa),
      pedagio.motorista,
      formatarHora(pedagio.pagoEm),
      pedagio.valor,
      ROTULO_DA_FORMA[pedagio.formaPagamento],
      pedagio.praca ?? '',
    ];
    registro.getCell(1).numFmt = DATA;
    registro.getCell(5).numFmt = DINHEIRO;
    emBloco(aba, linha, 1, 7);
    linha += 1;
  }
  const total = aba.getRow(linha);
  total.getCell(1).value = 'TOTAL';
  aba.mergeCells(linha, 1, linha, 4);
  total.getCell(5).value = formula(`SUM(E4:E${linha - 1})`, fechamento.medicao.totalPedagios);
  total.getCell(5).numFmt = DINHEIRO;
  total.font = { bold: true };
  emBloco(aba, linha, 1, 7);
}

function abaDePendencias(livro: ExcelJS.Workbook, fechamento: Fechamento): void {
  const aba = livro.addWorksheet('Pendências');
  aba.columns = [{ width: 14 }, { width: 90 }];
  titulo(aba, 1, 'CONFERIR ANTES DE ENVIAR', 2);

  const itens: [string, string][] = [];
  for (const van of fechamento.vans) {
    for (const pendencia of van.pendencias)
      itens.push([formatarPlaca(van.contrato.placa), pendencia]);
  }
  if (fechamento.avisos.diasParaConferir > 0) {
    itens.push([
      'Motoristas',
      `${fechamento.avisos.diasParaConferir} dia(s) com horário a conferir — ver a planilha de ` +
        'pagamento dos motoristas.',
    ]);
  }

  aba.getCell(3, 1).value = 'PLACA';
  aba.getCell(3, 2).value = 'O QUE CONFERIR';
  estiloCabecalho(aba.getCell(3, 1));
  estiloCabecalho(aba.getCell(3, 2));

  if (itens.length === 0) {
    aba.getCell(4, 1).value = 'Nenhuma pendência.';
    aba.getCell(4, 1).font = { italic: true };
    return;
  }
  itens.forEach(([placa, texto], indice) => {
    aba.getRow(4 + indice).values = [placa, texto];
    emBloco(aba, 4 + indice, 1, 2);
  });
}

/** Boletim de medição do cliente: blocos por van e quadro-resumo, como o BM atual. */
export async function planilhaDaMedicao(
  fechamento: Fechamento,
  cabecalho: CabecalhoDoArquivo,
): Promise<Buffer> {
  const livro = novoLivro();
  abaDoBoletim(livro, fechamento);
  abaDePedagios(livro, fechamento);
  abaDePendencias(livro, fechamento);
  abaDeIdentificacao(livro, 'Boletim de medição', fechamento, cabecalho, [
    ['Valor do dia normal', `Valor mensal da van ÷ ${fechamento.regras.divisor}`],
    [
      'Km excedido',
      `Acima do limite do contrato da van, ou ${fechamento.regras.km.limiteDia} km/dia se vazio`,
    ],
    ['Hora extra no total', 'Diárias do período, editáveis na célula antes de enviar'],
  ]);
  return emBytes(livro);
}
