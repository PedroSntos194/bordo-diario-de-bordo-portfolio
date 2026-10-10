import { formatarDataHora } from '@/utilitarios/data';

/**
 * Regras do suporte ao motorista durante o uso real.
 *
 * Nasceu do primeiro relato do piloto: um motorista achou que a viagem não
 * tinha sido registrada, e a informação chegou de boca em boca, dias depois e
 * sem detalhe. Duas peças resolvem isso, e as duas são puras aqui:
 *
 * - o texto do **"Algo deu errado?"**, que o motorista manda pelo WhatsApp já
 *   com tela, horário, conexão e localização — o que quem atende precisa
 *   perguntar primeiro;
 * - o **filtro e a chave dos erros** que o próprio aparelho relata, para avisar
 *   o administrador sem inundá-lo com o mesmo erro cem vezes.
 */

export type EstadoDaLocalizacao = 'permitida' | 'negada' | 'perguntar' | 'desconhecida';

const ROTULO_DA_LOCALIZACAO: Record<EstadoDaLocalizacao, string> = {
  permitida: 'permitida',
  negada: 'bloqueada no celular',
  perguntar: 'ainda não autorizada',
  desconhecida: 'não verificada',
};

/** Do caminho para o nome que o motorista vê na tela. A ordem importa: do mais específico ao geral. */
const TELAS: readonly [RegExp, string][] = [
  [/^\/app\/?$/, 'Meu dia'],
  [/^\/app\/jornada\/abrir/, 'Iniciar meu dia'],
  [/^\/app\/jornada\/encerrar/, 'Encerrar meu dia'],
  [/^\/app\/corrida\/iniciar/, 'Iniciar corrida'],
  [/^\/app\/corrida\/[^/]+\/encerrar/, 'Encerrar corrida'],
  [/^\/app\/corrida\/[^/]+\/corrigir/, 'Corrigir corrida'],
  [/^\/app\/corrida\/[^/]+/, 'Corrida'],
  [/^\/app\/abastecimento/, 'Abastecimento'],
  [/^\/app\/ocorrencia/, 'Ocorrência'],
  [/^\/app\/historico/, 'Histórico'],
  [/^\/app\/ajuda/, 'Ajuda'],
  [/^\/app\/resumo/, 'Resumo do dia'],
  [/^\/app\/pendencias-de-envio/, 'Registros esperando envio'],
  [/^\/app\/sem-conexao/, 'Modo sem conexão'],
  [/^\/perfil/, 'Meu perfil'],
  [/^\/admin/, 'Área do administrador'],
];

export function descreverTela(caminho: string): string {
  return TELAS.find(([padrao]) => padrao.test(caminho))?.[1] ?? caminho;
}

export interface ContextoDoSuporte {
  nome: string;
  caminho: string;
  instante: Date;
  online: boolean;
  /** Registros guardados no aparelho esperando envio; `null` quando não deu para ler. */
  pendentes: number | null;
  localizacao: EstadoDaLocalizacao;
  /** Identificador curto da versão publicada, quando houver. */
  versao: string | null;
}

/**
 * A mensagem que abre no WhatsApp do administrador.
 *
 * Termina em "O que aconteceu:" para o motorista completar com as palavras
 * dele — o resto ele não precisaria saber explicar.
 */
export function montarMensagemDeSuporte(contexto: ContextoDoSuporte): string {
  const linhas = [
    `Olá! Aqui é ${contexto.nome}. Algo deu errado no Bordo.`,
    '',
    `Tela: ${descreverTela(contexto.caminho)}`,
    `Horário: ${formatarDataHora(contexto.instante)}`,
    `Internet: ${contexto.online ? 'conectado' : 'sem sinal'}`,
  ];
  if (contexto.pendentes !== null) {
    linhas.push(`Registros esperando envio: ${contexto.pendentes}`);
  }
  linhas.push(`Localização: ${ROTULO_DA_LOCALIZACAO[contexto.localizacao]}`);
  if (contexto.versao) linhas.push(`Versão: ${contexto.versao}`);
  linhas.push('', 'O que aconteceu: ');
  return linhas.join('\n');
}

// ------------------------------------------------------------ erros relatados

/** Quantos erros uma mesma página relata no máximo, para um laço não virar enxurrada. */
export const LIMITE_DE_RELATOS_POR_PAGINA = 5;

/**
 * Falhas de rede, com o texto de cada navegador. Sinal fraco não é defeito do
 * sistema — o modo sem conexão existe para isso —, e avisar o administrador a
 * cada túnel enterraria os avisos que importam.
 */
const FALHAS_DE_REDE = [
  /^Failed to fetch$/i,
  /^Load failed$/i,
  /^NetworkError when attempting to fetch resource\.?$/i,
  /^Network ?error$/i,
  /^The network connection was lost\.?$/i,
];

const ESQUEMAS_DE_EXTENSAO = [
  'chrome-extension:',
  'moz-extension:',
  'safari-extension:',
  'safari-web-extension:',
];

/**
 * Erro que não é do Bordo e não deve chegar a ninguém.
 *
 * - "Script error." é o que o navegador entrega quando o erro veio de script
 *   de outra origem: não há nada a fazer com ele.
 * - O aviso de laço do `ResizeObserver` é inofensivo e frequente.
 * - Falha de rede é sinal fraco, não defeito.
 * - Extensões do navegador e scripts de outros sites não são o sistema.
 */
export function ehRuidoDeErro(erro: {
  mensagem: string;
  arquivo?: string | null;
  origemDoSite: string;
}): boolean {
  const mensagem = erro.mensagem.trim();
  if (mensagem === '' || mensagem === 'Script error.' || mensagem === 'Script error') return true;
  if (/ResizeObserver loop/i.test(mensagem)) return true;
  if (FALHAS_DE_REDE.some((padrao) => padrao.test(mensagem))) return true;

  const arquivo = erro.arquivo?.trim();
  if (!arquivo) return false;
  if (ESQUEMAS_DE_EXTENSAO.some((esquema) => arquivo.startsWith(esquema))) return true;

  try {
    return new URL(arquivo).origin !== erro.origemDoSite;
  } catch {
    return false;
  }
}

/**
 * A mesma mensagem com números e identificadores trocados por `#`.
 *
 * "Corrida 3f2a… não encontrada" e "Corrida 9b1c… não encontrada" são o mesmo
 * defeito; sem isto, cada um viraria um aviso.
 */
export function normalizarMensagemDeErro(mensagem: string): string {
  return mensagem
    .trim()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ');
}

/** FNV-1a de 32 bits em hexadecimal: curto, estável e sem dependência. */
function resumoCurto(texto: string): string {
  let hash = 0x811c9dc5;
  for (let indice = 0; indice < texto.length; indice++) {
    hash ^= texto.charCodeAt(indice);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Chave do aviso ao administrador: um por defeito, por dia.
 *
 * Vai em `notificacao.referencia_chave` (60 caracteres), que já tem índice com
 * o tipo. Se o mesmo erro aparecer em dez celulares, o administrador recebe um
 * aviso — o log da hospedagem guarda todas as ocorrências.
 */
export function chaveDoErro(dataIso: string, mensagem: string): string {
  return `erro-cliente:${dataIso}:${resumoCurto(normalizarMensagemDeErro(mensagem))}`;
}

export function encurtar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo - 1)}…`;
}
