import type { ClientePrisma } from '@/lib/prisma';

/**
 * Parâmetros do sistema (RF040).
 *
 * Ficam em tabela, não em variável de ambiente, porque o administrador precisa
 * conseguir mudar o horário do consolidado ou a janela de edição sem depender
 * de um deploy.
 */

export const CHAVES = {
  janelaEdicaoHoras: 'janela_edicao_horas',
  horarioConsolidado: 'horario_consolidado',
  horarioAlertaPendencia: 'horario_alerta_pendencia',
  toleranciaOdometroKm: 'tolerancia_odometro_km',
  destinatariosResumo: 'destinatarios_resumo',
  versaoAvisoPrivacidade: 'versao_aviso_privacidade',
  retencaoLocalizacaoMeses: 'retencao_localizacao_meses',
} as const;

/**
 * Lê um parâmetro, caindo no padrão quando a chave não existe.
 *
 * O padrão evita que uma instalação sem seed completo derrube a aplicação —
 * um parâmetro ausente não é motivo para negar um login.
 */
export async function obterValor<T>(cliente: ClientePrisma, chave: string, padrao: T): Promise<T> {
  const registro = await cliente.configuracao.findUnique({ where: { chave } });
  if (!registro) return padrao;
  return registro.valor as T;
}

/** Todos os parâmetros, para a tela de configurações (US042). */
export async function listarConfiguracoes(cliente: ClientePrisma) {
  return cliente.configuracao.findMany({
    select: { chave: true, valor: true, descricao: true, atualizadoEm: true },
    orderBy: { chave: 'asc' },
  });
}

export type ConfiguracaoDaTela = Awaited<ReturnType<typeof listarConfiguracoes>>[number];

/**
 * Grava um parâmetro.
 *
 * `upsert` e não `update`: uma instalação cujo seed não rodou por completo não
 * tem a linha, e o administrador não deveria descobrir isso por um erro de
 * "registro não encontrado" ao salvar.
 */
export async function gravarConfiguracao(
  cliente: ClientePrisma,
  chave: string,
  valor: unknown,
  descricao: string,
  atualizadoPor: string,
): Promise<void> {
  await cliente.configuracao.upsert({
    where: { chave },
    update: { valor: valor as never, atualizadoPor },
    create: { chave, valor: valor as never, descricao, atualizadoPor },
  });
}
