import type { AcaoAuditoria, Prisma } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Trilha de auditoria (RF037 · RN026, RN027).
 *
 * Este é o **ponto único de escrita** da auditoria. Ele é chamado por
 * `acao-segura.ts`, não pelos casos de uso — assim o registro é estrutural, e
 * não depende de alguém lembrar de chamá-lo em cada nova funcionalidade.
 *
 * O requisito veio detalhado no levantamento: "saber quem alterou determinado
 * dado, quando alterou e qual era o valor anterior".
 */

/** Campos que nunca entram na auditoria, mesmo que apareçam no delta (doc 17). */
const CAMPOS_SENSIVEIS = new Set([
  'senhaHash',
  'senha_hash',
  'senha',
  'novaSenha',
  'senhaAtual',
  'tokenHash',
  'token_hash',
  'chaveArmazenamento',
]);

/** Campos técnicos cuja alteração não interessa à trilha. */
const CAMPOS_IGNORADOS = new Set(['atualizadoEm', 'criadoEm', 'atualizadoPor']);

export type ValorRegistravel = Record<string, unknown>;

export interface DeltaDeAlteracao {
  anterior: ValorRegistravel;
  novo: ValorRegistravel;
}

/**
 * Compara dois estados e devolve **apenas os campos que mudaram**.
 *
 * Guardar o registro inteiro a cada alteração multiplicaria o volume sem ganho:
 * a pergunta do cliente é "qual era o valor anterior" do que mudou (RN026).
 */
export function calcularDelta(
  anterior: ValorRegistravel | null,
  novo: ValorRegistravel | null,
): DeltaDeAlteracao | null {
  if (anterior === null && novo === null) return null;

  const chaves = new Set([...Object.keys(anterior ?? {}), ...Object.keys(novo ?? {})]);

  const deltaAnterior: ValorRegistravel = {};
  const deltaNovo: ValorRegistravel = {};
  let houveMudanca = false;

  for (const chave of chaves) {
    if (CAMPOS_SENSIVEIS.has(chave) || CAMPOS_IGNORADOS.has(chave)) continue;

    const valorAnterior = anterior?.[chave];
    const valorNovo = novo?.[chave];

    if (saoEquivalentes(valorAnterior, valorNovo)) continue;

    deltaAnterior[chave] = normalizarParaJson(valorAnterior);
    deltaNovo[chave] = normalizarParaJson(valorNovo);
    houveMudanca = true;
  }

  return houveMudanca ? { anterior: deltaAnterior, novo: deltaNovo } : null;
}

function saoEquivalentes(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(normalizarParaJson(a)) === JSON.stringify(normalizarParaJson(b));
  }
  return false;
}

/** Date, BigInt e Decimal do Prisma não são serializáveis diretamente em JSON. */
function normalizarParaJson(valor: unknown): unknown {
  if (valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'bigint') return valor.toString();
  if (valor !== null && typeof valor === 'object' && 'toFixed' in valor) {
    return String(valor);
  }
  if (Array.isArray(valor)) return valor.map(normalizarParaJson);
  if (valor !== null && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [
        chave,
        normalizarParaJson(item),
      ]),
    );
  }
  return valor;
}

export interface RegistroDeAuditoria {
  usuarioId: string | null;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | null;
  valorAnterior?: ValorRegistravel | null;
  valorNovo?: ValorRegistravel | null;
  justificativa?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Grava o registro de auditoria.
 *
 * Recebe o cliente da transação: a auditoria participa da **mesma transação**
 * da operação auditada. Se a operação for desfeita, o registro também é — não
 * há trilha de algo que não aconteceu.
 */
export async function registrarAuditoria(
  cliente: ClientePrisma,
  registro: RegistroDeAuditoria,
): Promise<void> {
  const delta = calcularDelta(registro.valorAnterior ?? null, registro.valorNovo ?? null);

  await cliente.logAuditoria.create({
    data: {
      usuarioId: registro.usuarioId,
      acao: registro.acao,
      entidade: registro.entidade,
      entidadeId: registro.entidadeId ?? null,
      valorAnterior: (delta?.anterior ?? undefined) as Prisma.InputJsonValue | undefined,
      valorNovo: (delta?.novo ?? undefined) as Prisma.InputJsonValue | undefined,
      justificativa: registro.justificativa ?? null,
      ip: registro.ip ?? null,
      userAgent: registro.userAgent?.slice(0, 300) ?? null,
    },
  });
}

/**
 * Registra fora de transação — para eventos que não têm operação associada
 * (login, logout, tentativa negada).
 *
 * Falha aqui **não** derruba a requisição, mas é logada como erro crítico:
 * auditoria falhando é problema de conformidade, não de conveniência (doc 18).
 */
export async function registrarAuditoriaIsolada(
  cliente: ClientePrisma,
  registro: RegistroDeAuditoria,
): Promise<void> {
  try {
    await registrarAuditoria(cliente, registro);
  } catch (erro) {
    logger.error('Falha ao gravar auditoria', {
      acao: registro.acao,
      entidade: registro.entidade,
      entidadeId: registro.entidadeId,
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });
  }
}
