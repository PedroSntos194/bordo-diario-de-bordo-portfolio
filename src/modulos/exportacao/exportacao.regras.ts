import {
  comoDataParaPlanilha,
  comoRelogioLocalParaPlanilha,
  formatarDataHora,
  formatarDataOperacional,
} from '@/utilitarios/data';
import { formatarPlaca } from '@/utilitarios/placa';

/**
 * Regras da exportação em Excel (US032 · RF032 · RN030).
 *
 * Função pura, sem banco e sem ExcelJS: o que está aqui é **o que a planilha
 * diz** — quais colunas, em que ordem, com que rótulo e de que tipo. Como a
 * planilha é montada em bytes fica em `planilha.ts`.
 *
 * A separação tem uso prático imediato: o cliente vai pedir mudança de coluna
 * ("faltou o telefone do motorista"), e essa conversa acontece toda dentro
 * deste arquivo, que é testável sem abrir um `.xlsx`.
 */

export const TIPOS_DE_EXPORTACAO = ['JORNADAS', 'CORRIDAS', 'RESUMO_DIA'] as const;
export type TipoDeExportacao = (typeof TIPOS_DE_EXPORTACAO)[number];

/** RN009: reaplica o escopo atual também quando a tarefa é gerada sem sessão. */
export function comEscopoDoSolicitante<T extends { motoristaId?: string }>(
  filtros: T,
  solicitante: { id: string; perfil: string },
): T {
  return {
    ...filtros,
    motoristaId: solicitante.perfil === 'ADMIN' ? filtros.motoristaId : solicitante.id,
  };
}

export const EMPRESA = 'Transportes Exemplo';
export const NOME_SISTEMA = 'Bordo';

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Teto de linhas para a geração **síncrona** (doc 16).
 *
 * Acima disso a planilha não é recusada nem gerada na requisição: é admitida
 * como tarefa e processada pelo agendador. Segurar a requisição por minutos
 * estouraria a memória do processo que também atende os motoristas em campo, e
 * recusar — que foi o comportamento até aqui — devolve o problema para quem
 * legitimamente precisa do ano inteiro.
 */
export const LIMITE_LINHAS_SINCRONO = 5000;

/**
 * Teto absoluto, mesmo em segundo plano.
 *
 * Segundo plano não é "sem limite": passar disso não é um pedido, é um engano
 * de filtro. Duzentas mil linhas já são uma planilha que o Excel abre com
 * dificuldade — e é o mesmo teto que o expurgo usa por execução, pela mesma
 * razão de não deixar uma rotina varrer a base inteira de uma vez.
 */
export const LIMITE_LINHAS_EM_SEGUNDO_PLANO = 200_000;

/**
 * Tamanho da página de leitura na geração em segundo plano.
 *
 * O ponto do processamento em segundo plano não é ter mais tempo: é **não
 * carregar tudo de uma vez**. Mil registros por consulta mantêm a memória
 * plana e a transação curta, o que importa num banco gerenciado que também
 * atende a operação enquanto a planilha é montada.
 */
export const TAMANHO_DA_PAGINA = 1000;

export type ModoDeGeracao = 'sincrono' | 'segundo-plano' | 'recusado';

/**
 * Como este recorte deve ser gerado, dado o tamanho que ele tem.
 *
 * Função pura e separada do caso de uso porque é **a** decisão da US031, e a
 * que se quer poder mudar sem reabrir o serviço: os três desfechos ficam
 * visíveis num lugar só, com os limites ao lado.
 */
export function decidirModoDeGeracao(totalDeLinhas: number): ModoDeGeracao {
  if (totalDeLinhas > LIMITE_LINHAS_EM_SEGUNDO_PLANO) return 'recusado';
  if (totalDeLinhas > LIMITE_LINHAS_SINCRONO) return 'segundo-plano';
  return 'sincrono';
}

// ------------------------------------------------------- tarefa em segundo plano

export const STATUS_DA_TAREFA = ['PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'FALHA'] as const;
export type StatusDaTarefa = (typeof STATUS_DA_TAREFA)[number];

export const ROTULO_DO_STATUS_DA_TAREFA: Record<StatusDaTarefa, string> = {
  PENDENTE: 'Na fila',
  PROCESSANDO: 'Gerando',
  CONCLUIDA: 'Pronta',
  FALHA: 'Falhou',
};

/** Estados em que ainda faz sentido a tela continuar perguntando. */
export function tarefaEmAndamento(status: StatusDaTarefa): boolean {
  return status === 'PENDENTE' || status === 'PROCESSANDO';
}

/**
 * Tentativas de uma tarefa antes de desistir.
 *
 * Três, como o consolidado. A causa provável de falha é a mesma — banco ou
 * disco momentaneamente indisponível —, e a diferença é que aqui existe alguém
 * esperando: insistir para sempre deixaria a tela dizendo "gerando" por horas
 * sobre algo que não vai sair.
 */
export const MAXIMO_DE_TENTATIVAS = 3;

export function podeTentarDeNovo(tentativas: number): boolean {
  return tentativas < MAXIMO_DE_TENTATIVAS;
}

/**
 * Quantas tarefas um usuário pode ter esperando ao mesmo tempo.
 *
 * O limite por hora (RNF004) conta pedidos, não pendências — dez cliques em
 * sequência caberiam nele e ocupariam o agendador por meia hora. Este teto é o
 * que impede uma pessoa de tomar a fila de todo mundo.
 */
export const MAXIMO_DE_TAREFAS_NA_FILA = 3;

/**
 * Aviso de que a planilha ficou pronta (notificação interna).
 *
 * Diz o tamanho junto com o nome: quem pediu o ano inteiro precisa saber se
 * recebeu o ano inteiro, e é o número que distingue a planilha certa daquela
 * gerada com o filtro que ficou pela metade.
 */
export function mensagemDeExportacaoPronta(parametros: {
  tipo: TipoDeExportacao;
  linhas: number;
  nome: string;
}): string {
  return (
    `A exportação de ${rotuloDoTipo(parametros.tipo).toLowerCase()} que você pediu está pronta: ` +
    `${parametros.linhas.toLocaleString('pt-BR')} registros em ${parametros.nome}. ` +
    'O arquivo está disponível na tela de arquivos gerados.'
  );
}

/** Aviso de que a planilha não saiu, com o motivo (critério da US031). */
export function mensagemDeExportacaoFalhada(parametros: {
  tipo: TipoDeExportacao;
  motivo: string;
}): string {
  return (
    `A exportação de ${rotuloDoTipo(parametros.tipo).toLowerCase()} que você pediu não pôde ser ` +
    `gerada. Motivo: ${parametros.motivo}`
  );
}

const ROTULO_DO_TIPO: Record<TipoDeExportacao, string> = {
  JORNADAS: 'Jornadas',
  CORRIDAS: 'Corridas',
  RESUMO_DIA: 'Resumo do dia',
};

const NOME_CURTO: Record<TipoDeExportacao, string> = {
  JORNADAS: 'jornadas',
  CORRIDAS: 'corridas',
  RESUMO_DIA: 'resumo-do-dia',
};

export function rotuloDoTipo(tipo: TipoDeExportacao): string {
  return ROTULO_DO_TIPO[tipo];
}

/**
 * Nome do arquivo: `bordo_<relatorio>_<AAAA-MM-DD>.xlsx`.
 *
 * A data é a **da geração**, não a do período: dois recortes diferentes do
 * mesmo dia geram nomes iguais, e é isso que se quer — o que distingue os dois
 * são os parâmetros gravados no registro do arquivo (RN030), não o nome, que o
 * administrador ainda precisa conseguir ler.
 */
export function nomeDoArquivo(tipo: TipoDeExportacao, geradoEm: string): string {
  return `bordo_${NOME_CURTO[tipo]}_${geradoEm}.xlsx`;
}

// ------------------------------------------------------------------ colunas

export type FormatoDeCelula = 'texto' | 'inteiro' | 'decimal' | 'data' | 'hora' | 'dataHora';

export interface Coluna<T> {
  cabecalho: string;
  largura: number;
  formato: FormatoDeCelula;
  valor: (registro: T) => string | number | Date | null;
}

/**
 * Decimal do Prisma chega como objeto ou string, dependendo do caminho.
 * Vira `number` aqui para a célula sair **numérica** — o critério de aceitação
 * é explícito quanto a isso, e uma coluna de km em texto não soma no Excel.
 */
function comoNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const numero = typeof valor === 'number' ? valor : Number(String(valor));
  return Number.isFinite(numero) ? numero : null;
}

/** Modelo mínimo que a exportação de jornadas consome. */
export interface LinhaDeJornada {
  data: Date | string;
  status: string;
  motorista: { nome: string };
  veiculo: { placa: string };
  iniciadaEm: Date;
  encerradaEm: Date | null;
  odometroInicial: number;
  odometroFinal: number | null;
  kmTotal: unknown;
  totalCorridas: number | null;
  totalPassageiros: number | null;
  duracaoMinutos: number | null;
  observacoes: string | null;
}

const STATUS_LEGIVEL: Record<string, string> = {
  ABERTA: 'Aberta',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
  EM_ANDAMENTO: 'Em andamento',
};

function legivel(status: string): string {
  return STATUS_LEGIVEL[status] ?? status;
}

export const COLUNAS_DE_JORNADA: Coluna<LinhaDeJornada>[] = [
  { cabecalho: 'Data', largura: 12, formato: 'data', valor: (j) => comoDataParaPlanilha(j.data) },
  { cabecalho: 'Motorista', largura: 28, formato: 'texto', valor: (j) => j.motorista.nome },
  {
    cabecalho: 'Veículo',
    largura: 12,
    formato: 'texto',
    valor: (j) => formatarPlaca(j.veiculo.placa),
  },
  { cabecalho: 'Status', largura: 12, formato: 'texto', valor: (j) => legivel(j.status) },
  {
    cabecalho: 'Início',
    largura: 10,
    formato: 'hora',
    valor: (j) => comoRelogioLocalParaPlanilha(j.iniciadaEm),
  },
  {
    cabecalho: 'Encerramento',
    largura: 14,
    formato: 'hora',
    valor: (j) => (j.encerradaEm ? comoRelogioLocalParaPlanilha(j.encerradaEm) : null),
  },
  {
    cabecalho: 'Odômetro inicial',
    largura: 16,
    formato: 'inteiro',
    valor: (j) => j.odometroInicial,
  },
  {
    cabecalho: 'Odômetro final',
    largura: 15,
    formato: 'inteiro',
    valor: (j) => j.odometroFinal,
  },
  { cabecalho: 'Km total', largura: 11, formato: 'decimal', valor: (j) => comoNumero(j.kmTotal) },
  { cabecalho: 'Corridas', largura: 10, formato: 'inteiro', valor: (j) => j.totalCorridas },
  { cabecalho: 'Passageiros', largura: 12, formato: 'inteiro', valor: (j) => j.totalPassageiros },
  {
    cabecalho: 'Duração (min)',
    largura: 14,
    formato: 'inteiro',
    valor: (j) => j.duracaoMinutos,
  },
  { cabecalho: 'Observações', largura: 40, formato: 'texto', valor: (j) => j.observacoes },
];

/** Modelo mínimo que a exportação de corridas consome. */
export interface LinhaDeCorrida {
  status: string;
  iniciadaEm: Date;
  encerradaEm: Date | null;
  odometroInicial: number | null;
  odometroFinal: number | null;
  kmPercorrido: unknown;
  duracaoMinutos: number | null;
  quantidadePassageiros: number | null;
  observacoes: string | null;
  motivoCancelamento: string | null;
  origemDescricao: string | null;
  destinoDescricao: string | null;
  rota: { codigo: string; nome: string } | null;
  jornada: {
    data: Date | string;
    motorista: { nome: string };
    veiculo: { placa: string };
  };
}

/**
 * Rota cadastrada e corrida avulsa ocupam a mesma coluna.
 *
 * Duas colunas — uma sempre vazia conforme o caso — obrigariam quem lê a
 * planilha a olhar as duas para saber para onde a van foi.
 */
export function descreverTrajeto(corrida: LinhaDeCorrida): string {
  if (corrida.rota) return `${corrida.rota.codigo} · ${corrida.rota.nome}`;
  const origem = corrida.origemDescricao?.trim() || '—';
  const destino = corrida.destinoDescricao?.trim() || '—';
  return `${origem} → ${destino}`;
}

export const COLUNAS_DE_CORRIDA: Coluna<LinhaDeCorrida>[] = [
  {
    cabecalho: 'Data',
    largura: 12,
    formato: 'data',
    valor: (c) => comoDataParaPlanilha(c.jornada.data),
  },
  { cabecalho: 'Motorista', largura: 28, formato: 'texto', valor: (c) => c.jornada.motorista.nome },
  {
    cabecalho: 'Veículo',
    largura: 12,
    formato: 'texto',
    valor: (c) => formatarPlaca(c.jornada.veiculo.placa),
  },
  { cabecalho: 'Trajeto', largura: 42, formato: 'texto', valor: descreverTrajeto },
  { cabecalho: 'Status', largura: 14, formato: 'texto', valor: (c) => legivel(c.status) },
  {
    cabecalho: 'Início',
    largura: 10,
    formato: 'hora',
    valor: (c) => comoRelogioLocalParaPlanilha(c.iniciadaEm),
  },
  {
    cabecalho: 'Encerramento',
    largura: 14,
    formato: 'hora',
    valor: (c) => (c.encerradaEm ? comoRelogioLocalParaPlanilha(c.encerradaEm) : null),
  },
  {
    cabecalho: 'Odômetro inicial',
    largura: 16,
    formato: 'inteiro',
    valor: (c) => c.odometroInicial,
  },
  { cabecalho: 'Odômetro final', largura: 15, formato: 'inteiro', valor: (c) => c.odometroFinal },
  { cabecalho: 'Km', largura: 10, formato: 'decimal', valor: (c) => comoNumero(c.kmPercorrido) },
  { cabecalho: 'Duração (min)', largura: 14, formato: 'inteiro', valor: (c) => c.duracaoMinutos },
  {
    cabecalho: 'Passageiros',
    largura: 12,
    formato: 'inteiro',
    valor: (c) => c.quantidadePassageiros,
  },
  {
    cabecalho: 'Observações',
    largura: 36,
    formato: 'texto',
    valor: (c) => c.observacoes ?? c.motivoCancelamento,
  },
];

// ------------------------------------------------- aba de identificação

export interface ParDeIdentificacao {
  rotulo: string;
  valor: string;
}

export interface ContextoDaIdentificacao {
  tipo: TipoDeExportacao;
  filtros: Record<string, unknown>;
  totalDeLinhas: number;
  geradoEm: Date;
  geradoPor: string;
  /** Rótulos legíveis já resolvidos pelo serviço (nome do motorista, placa). */
  rotulosDeFiltro?: Record<string, string>;
}

const ROTULO_DO_FILTRO: Record<string, string> = {
  dataInicio: 'Data inicial',
  dataFim: 'Data final',
  data: 'Data',
  motoristaId: 'Motorista',
  veiculoId: 'Veículo',
  rotaId: 'Rota',
  status: 'Status',
};

/** Filtros que existem só para paginar a tela e não descrevem o recorte. */
const FILTROS_TECNICOS = new Set(['pagina', 'tamanho', 'ordenar', 'direcao']);

/**
 * Conteúdo da primeira aba (critério de aceitação da US032).
 *
 * Ela é o que torna a planilha reproduzível meses depois: sem registrar o
 * recorte, dois arquivos com o mesmo nome e números diferentes viram uma
 * discussão sem resposta.
 */
export function montarIdentificacao(contexto: ContextoDaIdentificacao): ParDeIdentificacao[] {
  const pares: ParDeIdentificacao[] = [
    { rotulo: 'Empresa', valor: EMPRESA },
    { rotulo: 'Relatório', valor: rotuloDoTipo(contexto.tipo) },
    { rotulo: 'Período', valor: descreverPeriodo(contexto.filtros) },
    { rotulo: 'Registros', valor: String(contexto.totalDeLinhas) },
    { rotulo: 'Gerado em', valor: formatarDataHora(contexto.geradoEm) },
    { rotulo: 'Gerado por', valor: contexto.geradoPor },
  ];

  const aplicados = Object.entries(contexto.filtros).filter(
    ([chave, valor]) =>
      !FILTROS_TECNICOS.has(chave) &&
      !['dataInicio', 'dataFim', 'data'].includes(chave) &&
      valor !== undefined &&
      valor !== null &&
      valor !== '',
  );

  if (aplicados.length === 0) {
    pares.push({ rotulo: 'Filtros', valor: 'Nenhum filtro adicional aplicado' });
    return pares;
  }

  for (const [chave, valor] of aplicados) {
    pares.push({
      rotulo: ROTULO_DO_FILTRO[chave] ?? chave,
      valor: contexto.rotulosDeFiltro?.[chave] ?? legivel(String(valor)),
    });
  }

  return pares;
}

export function descreverPeriodo(filtros: Record<string, unknown>): string {
  const data = filtros.data as string | undefined;
  if (data) return formatarDataOperacional(data);

  const inicio = filtros.dataInicio as string | undefined;
  const fim = filtros.dataFim as string | undefined;

  if (inicio && fim) return `${formatarDataOperacional(inicio)} a ${formatarDataOperacional(fim)}`;
  if (inicio) return `A partir de ${formatarDataOperacional(inicio)}`;
  if (fim) return `Até ${formatarDataOperacional(fim)}`;
  return 'Todo o período';
}
