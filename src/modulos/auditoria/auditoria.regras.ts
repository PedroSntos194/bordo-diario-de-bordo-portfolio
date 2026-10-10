/**
 * Regras de leitura da trilha de auditoria (US040, US041 · RF038, RF039 ·
 * RN026, RN027).
 *
 * A trilha é **somente leitura por construção**: não existe caso de uso que
 * atualize ou apague um registro dela, e o usuário da aplicação no banco não
 * recebe permissão de UPDATE nem DELETE sobre a tabela. Este módulo só consulta.
 */

export const ACOES = [
  'CRIAR',
  'ATUALIZAR',
  'EXCLUIR',
  'LOGIN',
  'LOGOUT',
  'LOGIN_FALHA',
  'EXPORTAR',
  'IMPORTAR',
  'ACESSO_NEGADO',
] as const;

export type AcaoDaTrilha = (typeof ACOES)[number];

export const ROTULO_DA_ACAO: Record<AcaoDaTrilha, string> = {
  CRIAR: 'Criou',
  ATUALIZAR: 'Alterou',
  EXCLUIR: 'Excluiu',
  LOGIN: 'Entrou',
  LOGOUT: 'Saiu',
  LOGIN_FALHA: 'Erro de senha',
  EXPORTAR: 'Exportou',
  IMPORTAR: 'Importou',
  ACESSO_NEGADO: 'Acesso negado',
};

/** Entidades que aparecem na trilha, com nome de negócio. */
export const ENTIDADES = [
  'jornada',
  'corrida',
  'corrida_evento',
  'ocorrencia',
  'usuario',
  'veiculo',
  'rota',
  'arquivo',
  'notificacao',
  'configuracao',
  'aceite_privacidade',
  'importacao',
  'alerta_pendencia',
  'retencao',
  'escala',
  'folga',
  'abastecimento',
  'exportacao',
] as const;

export type EntidadeDaTrilha = (typeof ENTIDADES)[number];

export const ROTULO_DA_ENTIDADE: Record<string, string> = {
  jornada: 'Jornada',
  corrida: 'Corrida',
  corrida_evento: 'Parada',
  ocorrencia: 'Ocorrência',
  usuario: 'Usuário',
  veiculo: 'Veículo',
  rota: 'Rota',
  arquivo: 'Arquivo',
  notificacao: 'Notificação',
  configuracao: 'Configuração',
  aceite_privacidade: 'Aceite de privacidade',
  importacao: 'Importação',
  alerta_pendencia: 'Alerta de pendências',
  retencao: 'Expurgo por retenção',
  escala: 'Escala',
  folga: 'Folga',
  abastecimento: 'Abastecimento',
  exportacao: 'Exportação',
};

export function rotularEntidade(entidade: string): string {
  return ROTULO_DA_ENTIDADE[entidade] ?? entidade;
}

/**
 * Período padrão da consulta, em dias (critério de aceitação da US040).
 *
 * Sete dias, e não "tudo": a trilha é a tabela que mais cresce no sistema, e
 * uma tela que abre varrendo o histórico inteiro fica lenta exatamente quando
 * alguém precisa dela com pressa, investigando um incidente.
 */
export const DIAS_PADRAO = 7;

export interface CampoAlterado {
  campo: string;
  anterior: unknown;
  novo: unknown;
}

/** Nomes técnicos que aparecem no delta, traduzidos para a linguagem do negócio. */
const ROTULO_DO_CAMPO: Record<string, string> = {
  odometroInicial: 'Odômetro inicial',
  odometroFinal: 'Odômetro final',
  kmPercorrido: 'Km percorrido',
  kmTotal: 'Km total',
  quantidadePassageiros: 'Passageiros',
  totalPassageiros: 'Passageiros',
  totalCorridas: 'Corridas',
  duracaoMinutos: 'Duração (min)',
  observacoes: 'Observações',
  status: 'Status',
  valor: 'Valor',
  nome: 'Nome',
  telefone: 'Telefone',
  placa: 'Placa',
  codigo: 'Código',
  data: 'Data',
  tipo: 'Tipo',
  perfil: 'Perfil',
  tanqueCheio: 'Tanque cheio',
  ativa: 'Ativa',
};

export function rotularCampo(campo: string): string {
  return ROTULO_DO_CAMPO[campo] ?? campo;
}

/**
 * Junta `valorAnterior` e `valorNovo` numa lista de campos alterados.
 *
 * A auditoria guarda **apenas o que mudou** (ver `calcularDelta`), então os dois
 * objetos têm as mesmas chaves — mas nem sempre: uma criação só tem `valorNovo`,
 * uma exclusão só tem `valorAnterior`. A união das chaves cobre os três casos
 * sem que a tela precise saber qual é qual.
 */
export function compararValores(anterior: unknown, novo: unknown): CampoAlterado[] {
  const objetoAnterior = (anterior ?? {}) as Record<string, unknown>;
  const objetoNovo = (novo ?? {}) as Record<string, unknown>;

  const chaves = [...new Set([...Object.keys(objetoAnterior), ...Object.keys(objetoNovo)])].sort();

  return chaves.map((campo) => ({
    campo,
    anterior: objetoAnterior[campo] ?? null,
    novo: objetoNovo[campo] ?? null,
  }));
}

/** `null` vira travessão; objeto e lista viram texto legível. */
export function formatarValorDaTrilha(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não';
  if (Array.isArray(valor)) return valor.length === 0 ? '(vazio)' : valor.join(', ');
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}
