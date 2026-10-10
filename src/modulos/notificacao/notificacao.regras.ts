import { formatarDataOperacional, formatarDuracao, formatarHora } from '@/utilitarios/data';
import { formatarKm, formatarOdometro } from '@/utilitarios/numero';
import { formatarPlaca } from '@/utilitarios/placa';
import { normalizarTelefone } from '@/utilitarios/telefone';

/**
 * Regras da notificação do resumo do dia (US036 · RF025 · RN017, RN028).
 *
 * Funções puras: montam o **texto** e o **link**, sem saber por qual canal
 * aquilo vai sair. É o que permite a decisão do V-05 — link `wa.me` agora, Cloud
 * API depois — não tocar em nenhum caso de uso: os dois canais consomem
 * exatamente a mesma mensagem produzida aqui.
 */

/** Uma corrida como ela aparece no resumo enviado. */
export interface CorridaDoResumo {
  status: string;
  iniciadaEm: Date;
  encerradaEm: Date | null;
  kmPercorrido: unknown;
  quantidadePassageiros: number | null;
  rota: { codigo: string; nome: string } | null;
  origemDescricao: string | null;
  destinoDescricao: string | null;
}

export interface JornadaDoResumoEnviado {
  data: Date | string;
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
  corridas: CorridaDoResumo[];
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const convertido = typeof valor === 'number' ? valor : Number(String(valor));
  return Number.isFinite(convertido) ? convertido : null;
}

function trajeto(corrida: CorridaDoResumo): string {
  if (corrida.rota) return corrida.rota.nome;
  const origem = corrida.origemDescricao?.trim() || '—';
  const destino = corrida.destinoDescricao?.trim() || '—';
  return `${origem} → ${destino}`;
}

/**
 * Texto do resumo do dia.
 *
 * Formatação em WhatsApp puro (`*negrito*`), sem emoji decorativo e sem
 * saudação: quem recebe é o administrador, várias vezes por dia, e o que ele
 * precisa é bater o olho e ver os números. O link fecha a mensagem porque é a
 * última coisa em que se toca.
 *
 * Conteúdo definido pelo critério de aceitação da US036: data, motorista,
 * veículo, corridas, km total, horários e link.
 */
export function montarMensagemDoResumo(
  jornada: JornadaDoResumoEnviado,
  linkDaJornada: string,
): string {
  const encerradas = jornada.corridas.filter((corrida) => corrida.status === 'ENCERRADA');

  const linhas: string[] = [
    '*Bordo · Resumo do dia*',
    '',
    `*Data:* ${formatarDataOperacional(jornada.data)}`,
    `*Motorista:* ${jornada.motorista.nome}`,
    `*Veículo:* ${formatarPlaca(jornada.veiculo.placa)}`,
    `*Jornada:* ${formatarHora(jornada.iniciadaEm)} às ${
      jornada.encerradaEm ? formatarHora(jornada.encerradaEm) : '—'
    }${jornada.duracaoMinutos ? ` (${formatarDuracao(jornada.duracaoMinutos)})` : ''}`,
    '',
    `*Corridas:* ${jornada.totalCorridas ?? encerradas.length}`,
    `*Km rodado:* ${formatarKm(numero(jornada.kmTotal))}`,
    `*Passageiros:* ${jornada.totalPassageiros ?? 0}`,
    `*Odômetro:* ${formatarOdometro(jornada.odometroInicial)} → ${formatarOdometro(
      jornada.odometroFinal,
    )}`,
  ];

  if (encerradas.length > 0) {
    linhas.push('', '*Corridas do dia*');
    for (const corrida of encerradas) {
      const km = formatarKm(numero(corrida.kmPercorrido));
      linhas.push(`• ${formatarHora(corrida.iniciadaEm)} · ${trajeto(corrida)} · ${km}`);
    }
  }

  if (jornada.observacoes?.trim()) {
    linhas.push('', `*Observações:* ${jornada.observacoes.trim()}`);
  }

  linhas.push('', linkDaJornada);

  return linhas.join('\n');
}

/**
 * Link `wa.me` com destinatário e mensagem prontos (V-05, abordagem a).
 *
 * O número vai **sem** `+` e sem pontuação, que é como o `wa.me` exige. A
 * mensagem é codificada por `encodeURIComponent`, e não por `URLSearchParams`:
 * este último converte espaço em `+`, e o WhatsApp mostraria os `+` literais
 * dentro do texto.
 */
export function montarLinkWaMe(telefoneE164: string, mensagem: string): string {
  const numeroLimpo = telefoneE164.replace(/\D/g, '');
  return `https://wa.me/${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
}

/** Endereço da jornada dentro do sistema, para o administrador abrir o detalhe. */
export function montarLinkDaJornada(appUrl: string, jornadaId: string): string {
  return `${appUrl.replace(/\/+$/, '')}/admin/jornadas/${jornadaId}`;
}

/**
 * Escolhe para quem o resumo vai.
 *
 * Ordem: os telefones configurados em `destinatarios_resumo` (RF040) e, se não
 * houver nenhum, os administradores ativos cadastrados. O segundo caminho evita
 * que o sistema saia de fábrica sem conseguir notificar ninguém — e o cliente
 * ainda não respondeu quem deve receber (V-15).
 *
 * Números inválidos são descartados em vez de derrubarem o envio: um cadastro
 * ruim entre cinco não pode impedir os outros quatro de receberem.
 */
export function escolherDestinatarios(
  configurados: string[],
  administradores: { id: string; nome: string; telefone: string }[],
): { usuarioId: string | null; nome: string; telefone: string }[] {
  const daConfiguracao = configurados
    .map((bruto) => ({
      usuarioId: null,
      nome: 'Administração',
      telefone: normalizarTelefone(bruto),
    }))
    .filter((item): item is { usuarioId: null; nome: string; telefone: string } =>
      Boolean(item.telefone),
    );

  if (daConfiguracao.length > 0) return daConfiguracao;

  return administradores
    .map((admin) => ({
      usuarioId: admin.id,
      nome: admin.nome,
      telefone: normalizarTelefone(admin.telefone),
    }))
    .filter((item): item is { usuarioId: string; nome: string; telefone: string } =>
      Boolean(item.telefone),
    );
}
