import { CodigoErro, ErroDeNegocio } from '@/lib/erros';
import type { Coluna } from '@/modulos/exportacao/exportacao.regras';
import { PERFIS, esquemaCriarUsuario } from '@/modulos/usuario/usuario.schema';
import { esquemaCriarVeiculo } from '@/modulos/veiculo/veiculo.schema';
import { TURNOS, esquemaCriarRota } from '@/modulos/rota/rota.schema';

/**
 * Regras da importação por planilha (US015 · RF035 · RN031, RN032).
 *
 * Tudo aqui é puro: definição dos modelos, leitura do CSV, conferência do
 * cabeçalho e validação linha a linha. Nada toca banco, arquivo ou ExcelJS —
 * o que permite testar o caso difícil (planilha meio certa, meio errada) sem
 * montar um `.xlsx`.
 *
 * As duas regras que dão forma ao módulo:
 *
 * - **RN031, tudo ou nada por estrutura.** Cabeçalho diferente do modelo
 *   rejeita o arquivo inteiro, sem gravar nada. A pessoa mexeu na planilha
 *   errada, e importar "o que deu" produziria cadastro embaralhado.
 * - **RN032, linha inválida não impede a válida.** Com a estrutura certa, o
 *   que estiver bom entra e o que estiver ruim volta num relatório com número
 *   de linha e motivo — para corrigir e reenviar só o que faltou.
 */

export const TIPOS_DE_IMPORTACAO = ['USUARIO', 'VEICULO', 'ROTA'] as const;
export type TipoDeImportacao = (typeof TIPOS_DE_IMPORTACAO)[number];

/** 5 MB, como o doc 16 especifica para `POST /api/importacoes`. */
export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;

export const EXTENSOES_ACEITAS = ['.xlsx', '.csv'] as const;

/**
 * Teto de linhas por arquivo.
 *
 * A carga inicial prevista é de ~60 usuários e ~30 rotas. O limite existe para
 * o engano — a planilha inteira da contabilidade arrastada para cá — e não para
 * o uso normal: recusar com instrução custa menos do que uma transação de meia
 * hora segurando o banco que atende os motoristas em campo.
 */
export const LIMITE_DE_LINHAS = 2000;

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Como o valor bruto da célula é preparado antes de chegar ao esquema Zod. */
type FormatoDeEntrada = 'texto' | 'numero' | 'enum' | 'data';

export interface ColunaDoModelo {
  /** Texto exato do cabeçalho — é por ele que o arquivo é reconhecido. */
  cabecalho: string;
  /** Campo correspondente no esquema Zod da entidade. */
  chave: string;
  obrigatoria: boolean;
  formato: FormatoDeEntrada;
  largura: number;
  /** Vai para a aba de instruções do modelo. */
  ajuda: string;
  /** Preenche a linha de exemplo do modelo. */
  exemplo: string;
}

export interface ModeloDeImportacao {
  tipo: TipoDeImportacao;
  rotulo: string;
  /** Nome da aba de dados. É a primeira aba do modelo, e a que a leitura usa. */
  aba: string;
  colunas: ColunaDoModelo[];
}

const COLUNAS_DE_USUARIO: ColunaDoModelo[] = [
  {
    cabecalho: 'Nome',
    chave: 'nome',
    obrigatoria: true,
    formato: 'texto',
    largura: 28,
    ajuda: 'Nome e sobrenome. Cadastro com uma palavra só é recusado.',
    exemplo: 'Carlos Pereira',
  },
  {
    cabecalho: 'CPF',
    chave: 'cpf',
    obrigatoria: true,
    formato: 'texto',
    largura: 18,
    ajuda: 'Com ou sem máscara. O dígito verificador é conferido (RN002).',
    exemplo: '529.982.247-25',
  },
  {
    cabecalho: 'Telefone',
    chave: 'telefone',
    obrigatoria: true,
    formato: 'texto',
    largura: 18,
    ajuda: 'DDD + número. É por ele que o WhatsApp chega.',
    exemplo: '(11) 99999-8888',
  },
  {
    cabecalho: 'Perfil',
    chave: 'perfil',
    obrigatoria: true,
    formato: 'enum',
    largura: 14,
    ajuda: `Um de: ${PERFIS.join(', ')}.`,
    exemplo: 'MOTORISTA',
  },
  {
    cabecalho: 'E-mail',
    chave: 'email',
    obrigatoria: false,
    formato: 'texto',
    largura: 26,
    ajuda: 'Opcional.',
    exemplo: 'carlos@exemplo.com.br',
  },
  {
    cabecalho: 'Matrícula',
    chave: 'matricula',
    obrigatoria: false,
    formato: 'texto',
    largura: 14,
    ajuda: 'Opcional. Precisa ser única entre os usuários.',
    exemplo: 'M-014',
  },
  {
    cabecalho: 'CNH número',
    chave: 'cnhNumero',
    obrigatoria: false,
    formato: 'texto',
    largura: 16,
    ajuda: 'Opcional. Só faz sentido para motorista.',
    exemplo: '01234567890',
  },
  {
    cabecalho: 'CNH categoria',
    chave: 'cnhCategoria',
    obrigatoria: false,
    formato: 'texto',
    largura: 14,
    ajuda: 'Opcional. Ex.: D.',
    exemplo: 'D',
  },
  {
    cabecalho: 'CNH validade',
    chave: 'cnhValidade',
    obrigatoria: false,
    formato: 'data',
    largura: 16,
    ajuda: 'Opcional. AAAA-MM-DD ou DD/MM/AAAA.',
    exemplo: '2029-05-30',
  },
];

const COLUNAS_DE_VEICULO: ColunaDoModelo[] = [
  {
    cabecalho: 'Placa',
    chave: 'placa',
    obrigatoria: true,
    formato: 'texto',
    largura: 14,
    ajuda: 'Formato ABC-1234 ou ABC1D23.',
    exemplo: 'ABC-1234',
  },
  {
    cabecalho: 'Modelo',
    chave: 'modelo',
    obrigatoria: true,
    formato: 'texto',
    largura: 24,
    ajuda: 'Ex.: Sprinter 415.',
    exemplo: 'Sprinter 415',
  },
  {
    cabecalho: 'Marca',
    chave: 'marca',
    obrigatoria: false,
    formato: 'texto',
    largura: 16,
    ajuda: 'Opcional.',
    exemplo: 'Mercedes-Benz',
  },
  {
    cabecalho: 'Ano',
    chave: 'ano',
    obrigatoria: false,
    formato: 'numero',
    largura: 10,
    ajuda: 'Opcional. De 1980 ao ano que vem.',
    exemplo: '2021',
  },
  {
    cabecalho: 'Capacidade',
    chave: 'capacidadePassageiros',
    obrigatoria: true,
    formato: 'numero',
    largura: 14,
    ajuda: 'Número de passageiros sentados.',
    exemplo: '15',
  },
  {
    cabecalho: 'Odômetro atual',
    chave: 'odometroAtual',
    obrigatoria: true,
    formato: 'numero',
    largura: 16,
    ajuda: 'Km do painel na data da carga. Depois disso quem move é a jornada (RN020).',
    exemplo: '160400',
  },
  {
    cabecalho: 'Observações',
    chave: 'observacoes',
    obrigatoria: false,
    formato: 'texto',
    largura: 30,
    ajuda: 'Opcional.',
    exemplo: 'Revisão em dia',
  },
];

const COLUNAS_DE_ROTA: ColunaDoModelo[] = [
  {
    cabecalho: 'Código',
    chave: 'codigo',
    obrigatoria: true,
    formato: 'texto',
    largura: 12,
    ajuda: 'Único. Vira maiúsculo automaticamente.',
    exemplo: 'R-014',
  },
  {
    cabecalho: 'Nome',
    chave: 'nome',
    obrigatoria: true,
    formato: 'texto',
    largura: 28,
    ajuda: 'Como a rota é chamada no dia a dia.',
    exemplo: 'Centro → Fábrica',
  },
  {
    cabecalho: 'Origem',
    chave: 'origem',
    obrigatoria: true,
    formato: 'texto',
    largura: 24,
    ajuda: 'Ponto de partida.',
    exemplo: 'Terminal Central',
  },
  {
    cabecalho: 'Destino',
    chave: 'destino',
    obrigatoria: true,
    formato: 'texto',
    largura: 24,
    ajuda: 'Ponto de chegada.',
    exemplo: 'Portaria 2 · Fábrica',
  },
  {
    cabecalho: 'Turno',
    chave: 'turno',
    obrigatoria: true,
    formato: 'enum',
    largura: 14,
    ajuda: `Um de: ${TURNOS.join(', ')}.`,
    exemplo: 'MANHA',
  },
  {
    cabecalho: 'Distância estimada (km)',
    chave: 'distanciaEstimadaKm',
    obrigatoria: false,
    formato: 'numero',
    largura: 22,
    ajuda: 'Opcional. Use ponto ou vírgula decimal.',
    exemplo: '32,5',
  },
];

export const MODELOS: Record<TipoDeImportacao, ModeloDeImportacao> = {
  USUARIO: {
    tipo: 'USUARIO',
    rotulo: 'Usuários',
    aba: 'Usuários',
    colunas: COLUNAS_DE_USUARIO,
  },
  VEICULO: { tipo: 'VEICULO', rotulo: 'Veículos', aba: 'Veículos', colunas: COLUNAS_DE_VEICULO },
  ROTA: { tipo: 'ROTA', rotulo: 'Rotas', aba: 'Rotas', colunas: COLUNAS_DE_ROTA },
};

export function modeloDe(tipo: TipoDeImportacao): ModeloDeImportacao {
  return MODELOS[tipo];
}

/** Nome do arquivo de modelo oferecido para download. */
export function nomeDoModelo(tipo: TipoDeImportacao): string {
  return `bordo_modelo_${tipo.toLowerCase()}.xlsx`;
}

// -------------------------------------------------------------- arquivo

function extensaoDe(nome: string): string {
  const ponto = nome.lastIndexOf('.');
  return ponto === -1 ? '' : nome.slice(ponto).toLowerCase();
}

export function ehCsv(nome: string): boolean {
  return extensaoDe(nome) === '.csv';
}

/**
 * Verifica o arquivo **antes** de abri-lo.
 *
 * Extensão e tamanho são conferidos aqui, no servidor, e não só no `accept` do
 * campo de arquivo: `accept` é sugestão ao seletor do sistema operacional, não
 * validação — arrastar um `.pdf` renomeado passa por ele sem reclamar.
 */
export function validarArquivo(arquivo: { nome: string; tamanhoBytes: number }): void {
  const extensao = extensaoDe(arquivo.nome);

  if (!EXTENSOES_ACEITAS.includes(extensao as (typeof EXTENSOES_ACEITAS)[number])) {
    throw new ErroDeNegocio(
      CodigoErro.TIPO_ARQUIVO_NAO_PERMITIDO,
      `Só aceitamos ${EXTENSOES_ACEITAS.join(' e ')}. Baixe o modelo e preencha nele.`,
      { arquivo: 'Formato não aceito.' },
    );
  }

  if (arquivo.tamanhoBytes > TAMANHO_MAXIMO_BYTES) {
    throw new ErroDeNegocio(
      CodigoErro.ARQUIVO_MUITO_GRANDE,
      `O arquivo tem ${(arquivo.tamanhoBytes / 1024 / 1024).toFixed(1)} MB e o limite é ` +
        `${TAMANHO_MAXIMO_BYTES / 1024 / 1024} MB. Divida a carga em partes.`,
      { arquivo: 'Arquivo acima do limite.' },
    );
  }

  if (arquivo.tamanhoBytes === 0) {
    throw new ErroDeNegocio(CodigoErro.DADOS_INVALIDOS, 'O arquivo está vazio.', {
      arquivo: 'Arquivo vazio.',
    });
  }
}

// ------------------------------------------------------------------ CSV

/**
 * Leitor de CSV.
 *
 * Escrito à mão, e não trazido de uma dependência, por dois motivos: o formato
 * que interessa é o que o Excel brasileiro exporta, e ele já obriga a tratar o
 * separador `;` — quase nenhum leitor genérico acerta isso de saída. O que
 * precisa funcionar é aspas, aspas escapadas e quebra de linha dentro do campo;
 * o resto é ruído.
 */
export function lerCsv(texto: string): string[][] {
  // BOM do Excel. Sem removê-lo, o primeiro cabeçalho nunca casa e o arquivo
  // inteiro é rejeitado por um caractere invisível.
  const conteudo = texto.replace(/^\uFEFF/, '');

  // `;` é o separador do Excel em português; a vírgula continua valendo para
  // quem exportou de outro lugar. Decide quem aparece mais na primeira linha.
  const primeiraLinha = conteudo.split(/\r?\n/, 1)[0] ?? '';
  const separador =
    (primeiraLinha.match(/;/g)?.length ?? 0) >= (primeiraLinha.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';

  const linhas: string[][] = [];
  let celulas: string[] = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < conteudo.length; i += 1) {
    const caractere = conteudo[i];

    if (dentroDeAspas) {
      if (caractere === '"') {
        if (conteudo[i + 1] === '"') {
          atual += '"';
          i += 1;
        } else {
          dentroDeAspas = false;
        }
      } else {
        atual += caractere;
      }
      continue;
    }

    if (caractere === '"') {
      dentroDeAspas = true;
    } else if (caractere === separador) {
      celulas.push(atual);
      atual = '';
    } else if (caractere === '\n') {
      celulas.push(atual);
      linhas.push(celulas);
      celulas = [];
      atual = '';
    } else if (caractere !== '\r') {
      atual += caractere;
    }
  }

  if (atual !== '' || celulas.length > 0) {
    celulas.push(atual);
    linhas.push(celulas);
  }

  // Linha totalmente vazia no fim do arquivo é resíduo do editor, não registro.
  return linhas.filter((linha) => linha.some((celula) => celula.trim() !== ''));
}

// ----------------------------------------------------- cabeçalho e linhas

function normalizarCabecalho(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Confere o cabeçalho contra o modelo (RN031).
 *
 * A comparação ignora acento, caixa e espaço extra — quem digitou "cpf" em vez
 * de "CPF" não errou o arquivo, errou a formatação, e rejeitar por isso seria
 * pedantismo. O que **não** é tolerado é coluna faltando, sobrando ou fora de
 * ordem: aí o arquivo é outro, e importar "o que deu" embaralharia o cadastro.
 */
export function validarCabecalho(modelo: ModeloDeImportacao, lido: string[]): void {
  const esperado = modelo.colunas.map((coluna) => coluna.cabecalho);
  const normalizadoEsperado = esperado.map(normalizarCabecalho);

  // Colunas vazias à direita são resíduo comum de planilha editada.
  const limpo = [...lido];
  while (limpo.length > 0 && (limpo[limpo.length - 1] ?? '').trim() === '') limpo.pop();
  const normalizadoLido = limpo.map(normalizarCabecalho);

  const igual =
    normalizadoLido.length === normalizadoEsperado.length &&
    normalizadoEsperado.every((cabecalho, indice) => normalizadoLido[indice] === cabecalho);

  if (igual) return;

  const faltando = esperado.filter(
    (cabecalho) => !normalizadoLido.includes(normalizarCabecalho(cabecalho)),
  );
  const sobrando = limpo.filter(
    (cabecalho) => !normalizadoEsperado.includes(normalizarCabecalho(cabecalho)),
  );

  const detalhes: string[] = [];
  if (faltando.length > 0) detalhes.push(`faltando: ${faltando.join(', ')}`);
  if (sobrando.length > 0) detalhes.push(`não reconhecida: ${sobrando.join(', ')}`);
  if (detalhes.length === 0) detalhes.push('as colunas estão fora da ordem do modelo');

  throw new ErroDeNegocio(
    CodigoErro.CABECALHO_INVALIDO,
    `A planilha não está no modelo de ${modelo.rotulo.toLowerCase()} — ${detalhes.join(' · ')}. ` +
      'Nenhuma linha foi importada. Baixe o modelo e preencha nele.',
    { arquivo: 'Cabeçalho fora do modelo.' },
  );
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Prepara o valor da célula para o esquema Zod.
 *
 * Enum aceita "Manhã" e devolve `MANHA`; data aceita `DD/MM/AAAA` e devolve
 * `AAAA-MM-DD`; número aceita vírgula decimal. Nada disso é indulgência: é o
 * formato que sai do Excel brasileiro de verdade, e recusá-lo transformaria a
 * importação inteira num relatório de erros.
 */
export function prepararValor(coluna: ColunaDoModelo, bruto: string): string {
  const valor = bruto.trim();
  if (valor === '') return '';

  if (coluna.formato === 'enum') {
    return semAcento(valor).toUpperCase().replace(/\s+/g, '_');
  }

  if (coluna.formato === 'numero') {
    // "32,5" → "32.5". O ponto de milhar sai antes para não virar decimal.
    return valor.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  }

  if (coluna.formato === 'data') {
    const brasileira = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
    if (brasileira) return `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`;
    // O ExcelJS devolve célula de data como ISO completo.
    const iso = /^(\d{4}-\d{2}-\d{2})/.exec(valor);
    if (iso) return iso[1] ?? valor;
  }

  return valor;
}

export interface LinhaComErro {
  /** Número da linha **na planilha**, com o cabeçalho sendo a linha 1. */
  linha: number;
  coluna: string;
  valor: string;
  motivo: string;
  /**
   * Chave e descrição da linha recusada — o CPF e o nome, a placa e o modelo.
   *
   * Existem para o relatório poder identificar a linha pelo que ela **é**, e
   * não pelo campo que deu errado. Sem isso, uma linha recusada por telefone
   * apareceria com o telefone embaixo do cabeçalho "CPF".
   */
  identificacao: string;
  descricao: string;
}

export interface LinhaValida<T> {
  linha: number;
  dados: T;
  /** Valores como o arquivo trouxe — usados no relatório de resultado. */
  bruto: Record<string, string>;
}

export interface AnaliseDoArquivo<T> {
  validas: LinhaValida<T>[];
  invalidas: LinhaComErro[];
  linhasTotal: number;
}

const ESQUEMA_POR_TIPO = {
  USUARIO: esquemaCriarUsuario,
  VEICULO: esquemaCriarVeiculo,
  ROTA: esquemaCriarRota,
} as const;

/** A chave que identifica a linha no cadastro, para detectar repetição. */
const CHAVE_UNICA: Record<TipoDeImportacao, string> = {
  USUARIO: 'cpf',
  VEICULO: 'placa',
  ROTA: 'codigo',
};

/** O campo que descreve a linha para uma pessoa que a esteja procurando. */
const CHAVE_DESCRITIVA: Record<TipoDeImportacao, string> = {
  USUARIO: 'nome',
  VEICULO: 'modelo',
  ROTA: 'nome',
};

function rotuloDaColuna(modelo: ModeloDeImportacao, chave: string): string {
  return modelo.colunas.find((coluna) => coluna.chave === chave)?.cabecalho ?? chave;
}

/**
 * Valida o corpo da planilha linha a linha (RN032).
 *
 * Usa **o mesmo esquema Zod do formulário** de cadastro (regra 4 do projeto).
 * Uma segunda validação escrita à mão para a importação divergiria da tela na
 * primeira mudança de regra, e o cadastro entraria pela porta dos fundos com
 * dado que a tela recusa.
 *
 * A repetição dentro do próprio arquivo é conferida aqui, e não deixada para a
 * constraint do banco: a constraint derrubaria a transação inteira, levando
 * junto as linhas boas — exatamente o oposto da RN032. E o erro precisa dizer
 * **qual** linha já usava aquele valor, senão a pessoa procura o duplicado a
 * olho em 60 linhas.
 */
export function analisarLinhas(
  modelo: ModeloDeImportacao,
  linhas: string[][],
): AnaliseDoArquivo<Record<string, unknown>> {
  const esquema = ESQUEMA_POR_TIPO[modelo.tipo];
  const chaveUnica = CHAVE_UNICA[modelo.tipo];
  const chaveDescritiva = CHAVE_DESCRITIVA[modelo.tipo];

  const validas: LinhaValida<Record<string, unknown>>[] = [];
  const invalidas: LinhaComErro[] = [];
  const vistos = new Map<string, number>();

  linhas.forEach((celulas, indice) => {
    // +2: o cabeçalho é a linha 1 e o corpo começa na 2. É esse número que a
    // pessoa vê na barra lateral do Excel ao ir corrigir.
    const numeroDaLinha = indice + 2;

    const bruto: Record<string, string> = {};
    const entrada: Record<string, string> = {};

    modelo.colunas.forEach((coluna, posicao) => {
      const celula = celulas[posicao] ?? '';
      bruto[coluna.chave] = celula.trim();
      entrada[coluna.chave] = prepararValor(coluna, celula);
    });

    const analise = esquema.safeParse(entrada);

    if (!analise.success) {
      // Um erro por linha: a pessoa corrige o primeiro problema e reenvia. Uma
      // lista com os cinco campos errados da mesma linha não a faz corrigir
      // mais rápido, só faz o relatório crescer.
      const problema = analise.error.issues[0];
      const chave = String(problema?.path[0] ?? '');

      invalidas.push({
        linha: numeroDaLinha,
        coluna: rotuloDaColuna(modelo, chave),
        valor: bruto[chave] ?? '',
        motivo: problema?.message ?? 'Linha inválida.',
        identificacao: bruto[chaveUnica] ?? '',
        descricao: bruto[chaveDescritiva] ?? '',
      });
      return;
    }

    const valorDaChave = String(
      (analise.data as Record<string, unknown>)[chaveUnica] ?? '',
    ).toUpperCase();
    const anterior = vistos.get(valorDaChave);

    if (anterior !== undefined) {
      invalidas.push({
        linha: numeroDaLinha,
        coluna: rotuloDaColuna(modelo, chaveUnica),
        valor: bruto[chaveUnica] ?? '',
        motivo: `Repetido: a linha ${anterior} já usa este valor.`,
        identificacao: bruto[chaveUnica] ?? '',
        descricao: bruto[chaveDescritiva] ?? '',
      });
      return;
    }

    vistos.set(valorDaChave, numeroDaLinha);
    validas.push({ linha: numeroDaLinha, dados: analise.data as Record<string, unknown>, bruto });
  });

  return { validas, invalidas, linhasTotal: linhas.length };
}

/**
 * Recusa o arquivo grande demais em número de linhas.
 *
 * Separado de `validarArquivo` porque só dá para saber depois de abrir: um CSV
 * de 200 KB pode ter 40 mil linhas.
 */
export function validarQuantidadeDeLinhas(quantidade: number): void {
  if (quantidade === 0) {
    throw new ErroDeNegocio(
      CodigoErro.DADOS_INVALIDOS,
      'A planilha tem o cabeçalho certo, mas nenhuma linha preenchida.',
      { arquivo: 'Nenhuma linha para importar.' },
    );
  }

  if (quantidade > LIMITE_DE_LINHAS) {
    throw new ErroDeNegocio(
      CodigoErro.PERIODO_MUITO_LONGO,
      `A planilha tem ${quantidade.toLocaleString('pt-BR')} linhas, acima do limite de ` +
        `${LIMITE_DE_LINHAS.toLocaleString('pt-BR')} por arquivo. Divida a carga em partes.`,
      { arquivo: 'Linhas demais.' },
    );
  }
}

/** Nome do relatório devolvido depois da importação. */
export function nomeDoRelatorio(tipo: TipoDeImportacao, geradoEm: string): string {
  return `bordo_importacao_${tipo.toLowerCase()}_${geradoEm}.xlsx`;
}

// --------------------------------------------------- relatório de resultado

/**
 * Por quantos dias o relatório da importação fica disponível.
 *
 * Curto de propósito: no caso de usuários ele carrega as **senhas
 * temporárias**, que é o único jeito prático de entregar sessenta acessos de
 * uma vez sem redefinir senha sessenta vezes. Uma planilha com senhas não pode
 * ficar guardada para sempre no histórico de arquivos — e a senha, de todo
 * modo, é trocada no primeiro login (RF002).
 */
export const DIAS_DE_RETENCAO_DO_RELATORIO = 7;

export type SituacaoDaLinha = 'IMPORTADA' | 'RECUSADA';

export interface LinhaDoRelatorio {
  linha: number;
  situacao: SituacaoDaLinha;
  identificacao: string;
  descricao: string;
  /** Motivo da recusa; vazio na linha importada. */
  detalhe: string;
  /** Só na importação de usuários, e só na linha que entrou. */
  senhaTemporaria: string | null;
}

const ROTULO_DA_SITUACAO: Record<SituacaoDaLinha, string> = {
  IMPORTADA: 'Importada',
  RECUSADA: 'Recusada',
};

/** Que colunas identificam a linha no relatório, por tipo de importação. */
const IDENTIFICACAO_DO_RELATORIO: Record<
  TipoDeImportacao,
  { identificacao: string; descricao: string }
> = {
  USUARIO: { identificacao: 'CPF', descricao: 'Nome' },
  VEICULO: { identificacao: 'Placa', descricao: 'Modelo' },
  ROTA: { identificacao: 'Código', descricao: 'Nome' },
};

/**
 * Colunas do relatório devolvido depois da importação.
 *
 * O relatório traz as linhas **recusadas e importadas**, não só as recusadas: é
 * ele que responde "o que exatamente entrou?" seis meses depois, e é o critério
 * de aceitação de "baixar o relatório de erros para correção e reenvio" servido
 * pelo mesmo arquivo.
 */
export function colunasDoRelatorio(tipo: TipoDeImportacao): Coluna<LinhaDoRelatorio>[] {
  const rotulos = IDENTIFICACAO_DO_RELATORIO[tipo];

  const colunas: Coluna<LinhaDoRelatorio>[] = [
    {
      cabecalho: 'Linha',
      largura: 8,
      formato: 'inteiro',
      valor: (registro) => registro.linha,
    },
    {
      cabecalho: 'Situação',
      largura: 12,
      formato: 'texto',
      valor: (registro) => ROTULO_DA_SITUACAO[registro.situacao],
    },
    {
      cabecalho: rotulos.identificacao,
      largura: 20,
      formato: 'texto',
      valor: (registro) => registro.identificacao || null,
    },
    {
      cabecalho: rotulos.descricao,
      largura: 28,
      formato: 'texto',
      valor: (registro) => registro.descricao || null,
    },
    {
      cabecalho: 'Motivo da recusa',
      largura: 52,
      formato: 'texto',
      valor: (registro) => registro.detalhe || null,
    },
  ];

  if (tipo === 'USUARIO') {
    colunas.push({
      cabecalho: 'Senha temporária',
      largura: 20,
      formato: 'texto',
      valor: (registro) => registro.senhaTemporaria,
    });
  }

  return colunas;
}

/**
 * A linha é o exemplo que veio no modelo?
 *
 * Quem baixa o modelo, preenche embaixo e esquece de apagar o exemplo criaria
 * o "Carlos Pereira" de mentira dentro do cadastro real. O modelo avisa em
 * vermelho; isto é a rede de segurança, e ela **conta** a linha ignorada em vez
 * de sumir com ela — descarte silencioso em importação é o mesmo defeito do
 * filtro descartado da Sprint 6.
 */
export function ehLinhaDeExemplo(modelo: ModeloDeImportacao, celulas: string[]): boolean {
  const marcador = (celulas[0] ?? '').trim();
  if (marcador.startsWith('↑ linha de exemplo')) return true;

  return modelo.colunas.every(
    (coluna, posicao) => (celulas[posicao] ?? '').trim() === coluna.exemplo,
  );
}
