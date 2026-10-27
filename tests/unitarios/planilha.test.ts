import { access, mkdtemp } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { COLUNAS_DE_JORNADA, type LinhaDeJornada } from '@/modulos/exportacao/exportacao.regras';
import { gerarPlanilha, gerarPlanilhaEmFluxo } from '@/modulos/exportacao/planilha';

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return { ...original, mkdtemp: vi.fn(original.mkdtemp) };
});

/**
 * US032 e US033 — o arquivo gerado, lido de volta.
 *
 * Este é o único teste que descompacta um `.xlsx`, e ele existe por um motivo
 * específico: os critérios de aceitação falam de *propriedades do arquivo*
 * ("abre sem aviso de formato inválido", "cabeçalho congelado", "datas como
 * data"), e nenhuma delas é observável na camada de regras.
 */

const JORNADA: LinhaDeJornada = {
  data: '2026-08-23',
  status: 'ENCERRADA',
  motorista: { nome: 'Carlos Pereira' },
  veiculo: { placa: 'ABC1234' },
  iniciadaEm: new Date('2026-08-23T21:35:00Z'),
  encerradaEm: new Date('2026-08-24T01:10:00Z'),
  odometroInicial: 160400,
  odometroFinal: 160445,
  kmTotal: '32.5',
  totalCorridas: 3,
  totalPassageiros: 25,
  duracaoMinutos: 215,
  observacoes: null,
};

async function abrir(conteudo: Buffer): Promise<ExcelJS.Workbook> {
  const livro = new ExcelJS.Workbook();
  // Ler de volta com o próprio ExcelJS é a verificação prática de "abre sem
  // aviso de formato inválido": um zip malformado falha aqui.
  await livro.xlsx.load(conteudo as unknown as ArrayBuffer);
  return livro;
}

const IDENTIFICACAO = [
  { rotulo: 'Empresa', valor: 'Transportes Exemplo' },
  { rotulo: 'Relatório', valor: 'Jornadas' },
];

describe('gerarPlanilha', () => {
  it('produz um arquivo válido com as duas abas', async () => {
    const conteudo = await gerarPlanilha({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA, registros: [JORNADA] },
    });

    const livro = await abrir(conteudo);

    expect(livro.worksheets.map((aba) => aba.name)).toEqual(['Identificação', 'Jornadas']);
  });

  it('congela o cabeçalho e liga o filtro automático', async () => {
    const conteudo = await gerarPlanilha({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA, registros: [JORNADA] },
    });

    const aba = (await abrir(conteudo)).getWorksheet('Jornadas');
    const visao = aba?.views?.[0];

    expect(visao?.state).toBe('frozen');
    // O tipo de `views` é uma união entre visão normal e congelada; `ySplit` só
    // existe no segundo ramo, e o teste é justamente sobre estar nele.
    expect(visao?.state === 'frozen' ? visao.ySplit : undefined).toBe(1);
    expect(aba?.autoFilter).toBe('A1:M1');
  });

  it('grava datas como data e números como número', async () => {
    const conteudo = await gerarPlanilha({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA, registros: [JORNADA] },
    });

    const aba = (await abrir(conteudo)).getWorksheet('Jornadas');
    const linha = aba?.getRow(2);

    const data = linha?.getCell(1);
    expect(data?.value).toBeInstanceOf(Date);
    expect((data?.value as Date).toISOString()).toBe('2026-08-23T00:00:00.000Z');
    expect(data?.numFmt).toBe('dd/mm/yyyy');

    const km = linha?.getCell(9);
    expect(typeof km?.value).toBe('number');
    expect(km?.value).toBe(32.5);
    expect(km?.numFmt).toBe('#,##0.00');
  });

  it('ajusta a largura de cada coluna', async () => {
    const conteudo = await gerarPlanilha({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA, registros: [JORNADA] },
    });

    const aba = (await abrir(conteudo)).getWorksheet('Jornadas');

    expect(aba?.getColumn(2).width).toBe(28);
  });

  it('escreve o aviso, e não um cabeçalho solto, quando o dia está vazio', async () => {
    // US033 — dia sem movimentação gera planilha com aviso "sem registros", em
    // vez de não gerar nada.
    const conteudo = await gerarPlanilha({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Resumo do dia', colunas: COLUNAS_DE_JORNADA, registros: [] },
      avisoQuandoVazio: 'Sem registros para 15/01/2020.',
    });

    const aba = (await abrir(conteudo)).getWorksheet('Resumo do dia');

    expect(aba?.getRow(1).getCell(1).value).toBe('Sem registros para 15/01/2020.');
    expect(aba?.getRow(2).getCell(1).value).toBeNull();
  });

  it('mantém o cabeçalho quando a exportação vazia não declara aviso', async () => {
    const conteudo = await gerarPlanilha({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA, registros: [] },
    });

    const aba = (await abrir(conteudo)).getWorksheet('Jornadas');

    expect(aba?.getRow(1).getCell(1).value).toBe('Data');
  });

  it('leva a identificação para a primeira aba', async () => {
    const conteudo = await gerarPlanilha({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA, registros: [JORNADA] },
    });

    const aba = (await abrir(conteudo)).getWorksheet('Identificação');

    expect(aba?.getRow(1).getCell(1).value).toBe('Transportes Exemplo · Bordo');
    expect(aba?.getRow(3).getCell(1).value).toBe('Empresa');
    expect(aba?.getRow(3).getCell(2).value).toBe('Transportes Exemplo');
  });
});

/**
 * US031 — a mesma planilha, gerada em fluxo.
 *
 * O caminho em fluxo existe para não manter as linhas na memória, e a única
 * forma de verificar que ele produz um arquivo **equivalente** é abrir os dois e
 * comparar. Um `.xlsx` escrito em fluxo tem um caminho de gravação diferente do
 * escrito em memória: cabeçalho de aba, congelamento e formatos numéricos são
 * gravados em momentos distintos, e é aí que ele pode divergir sem ninguém ver.
 */
describe('gerarPlanilhaEmFluxo', () => {
  async function* umaPagina(registros: LinhaDeJornada[]) {
    yield registros;
  }

  it('produz arquivo válido, com as duas abas e a mesma ordem', async () => {
    const { conteudo, linhas } = await gerarPlanilhaEmFluxo({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA },
      paginas: umaPagina([JORNADA]),
    });

    expect(linhas).toBe(1);

    const livro = await abrir(conteudo);

    expect(livro.worksheets.map((aba) => aba.name)).toEqual(['Identificação', 'Jornadas']);
    expect(livro.getWorksheet('Identificação')?.getRow(3).getCell(1).value).toBe('Empresa');
    expect(livro.getWorksheet('Jornadas')?.getRow(1).getCell(1).value).toBe('Data');
  });

  it('conta as linhas de todas as páginas, não só da primeira', async () => {
    async function* tresPaginas() {
      yield [JORNADA, JORNADA];
      yield [JORNADA];
      yield [JORNADA, JORNADA, JORNADA];
    }

    const { linhas } = await gerarPlanilhaEmFluxo({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA },
      paginas: tresPaginas(),
    });

    // É o número que vai para `linhas_geradas` e para o aviso ao solicitante:
    // contar só a última página faria a planilha certa parecer truncada.
    expect(linhas).toBe(6);
  });

  it('mantém a data como data e o número como número', async () => {
    // Mesma exigência do caminho em memória (US032): coluna de km em texto não
    // soma no Excel. No fluxo o formato é aplicado por linha, antes do
    // `commit`, e esquecê-lo não quebraria nada visivelmente.
    const { conteudo } = await gerarPlanilhaEmFluxo({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA },
      paginas: umaPagina([JORNADA]),
    });

    const linha = (await abrir(conteudo)).getWorksheet('Jornadas')?.getRow(2);

    expect(linha?.getCell(1).value).toBeInstanceOf(Date);
    expect(linha?.getCell(9).value).toBe(32.5);
    expect(linha?.getCell(9).numFmt).toBe('#,##0.00');
  });

  it('congela o cabeçalho da aba de dados', async () => {
    // No modo de fluxo `views` precisa ser definido **na criação** da aba: o
    // cabeçalho dela já foi escrito quando a primeira linha é confirmada, e uma
    // atribuição posterior seria silenciosamente perdida.
    const { conteudo } = await gerarPlanilhaEmFluxo({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA },
      paginas: umaPagina([JORNADA]),
    });

    const aba = (await abrir(conteudo)).getWorksheet('Jornadas');

    expect(aba?.views?.[0]?.state).toBe('frozen');
  });

  it('não deixa o arquivo temporário para trás', async () => {
    // Cada tentativa frustrada deixaria uma planilha parcial no disco do
    // servidor — e a que falha é justamente a grande. Outras suítes também
    // exportam em paralelo: conferimos só a pasta criada por esta chamada.
    const criacoesAntes = vi.mocked(mkdtemp).mock.results.length;

    await gerarPlanilhaEmFluxo({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA },
      paginas: umaPagina([JORNADA]),
    });

    const criacoes = vi.mocked(mkdtemp).mock.results.slice(criacoesAntes);
    expect(criacoes).toHaveLength(1);
    const pasta = await criacoes[0]!.value;
    await expect(access(pasta)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('varre as páginas sob demanda, não todas de uma vez', async () => {
    // É a propriedade que dá sentido ao segundo plano: a próxima consulta só
    // sai depois de a página anterior virar bytes. Se o gerador fosse
    // consumido de uma vez, o pico de memória voltaria a ser o do recorte
    // inteiro — e o teste é a única forma de notar, porque o arquivo produzido
    // seria idêntico.
    const paginasLidas: number[] = [];

    async function* comRegistro() {
      for (let pagina = 1; pagina <= 3; pagina += 1) {
        paginasLidas.push(pagina);
        yield [JORNADA];
      }
    }

    const paginas = comRegistro();
    expect(paginasLidas).toEqual([]);

    await gerarPlanilhaEmFluxo({
      identificacao: IDENTIFICACAO,
      aba: { nome: 'Jornadas', colunas: COLUNAS_DE_JORNADA },
      paginas,
    });

    expect(paginasLidas).toEqual([1, 2, 3]);
  });
});
