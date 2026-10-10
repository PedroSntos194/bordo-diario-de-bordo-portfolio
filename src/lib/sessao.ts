import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { usarCookieSeguro } from '@/lib/env';
import { aceitouAvisoVigente } from '@/modulos/autenticacao/autenticacao.regras';

/**
 * Sessão persistida em banco, com token opaco em cookie (doc 13 · AD-2).
 *
 * A escolha por sessão em banco, e não por JWT autocontido, é deliberada: ao
 * bloquear ou desativar um usuário (RN006) o acesso precisa cair **na hora**.
 * Um JWT válido continuaria sendo aceito até expirar; uma linha removida da
 * tabela `sessao`, não.
 *
 * Isto substitui o Auth.js previsto no doc 14 — a estratégia de sessão em banco
 * não é suportada pelo provedor de credenciais do Auth.js, e o requisito de
 * revogação imediata pesa mais do que a conveniência da biblioteca.
 */

export const NOME_COOKIE_SESSAO = 'bordo_sessao';

/** RN007 — duração distinta por perfil. */
export const DURACAO_SESSAO_HORAS = {
  ADMIN: 8,
  MOTORISTA: 12,
} as const;

/** RN007 — inatividade máxima do administrador, em minutos. */
export const INATIVIDADE_ADMIN_MINUTOS = 60;

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  cpf: string;
  perfil: 'ADMIN' | 'MOTORISTA';
  deveTrocarSenha: boolean;
  aceitouPrivacidade: boolean;
}

export interface DadosDaRequisicao {
  ip?: string | null;
  userAgent?: string | null;
}

function calcularHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Cria a sessão e devolve o token em texto puro — o único momento em que ele
 * existe fora do cookie. No banco fica apenas o SHA-256.
 */
export async function criarSessao(
  usuarioId: string,
  perfil: 'ADMIN' | 'MOTORISTA',
  dados: DadosDaRequisicao = {},
): Promise<{ token: string; expiraEm: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_HORAS[perfil] * 60 * 60 * 1000);

  await prisma.sessao.create({
    data: {
      usuarioId,
      tokenHash: calcularHash(token),
      expiraEm,
      ip: dados.ip ?? null,
      userAgent: dados.userAgent?.slice(0, 300) ?? null,
    },
  });

  return { token, expiraEm };
}

export async function gravarCookieDeSessao(token: string, expiraEm: Date): Promise<void> {
  const armazem = await cookies();

  armazem.set(NOME_COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: usarCookieSeguro,
    sameSite: 'lax',
    path: '/',
    expires: expiraEm,
  });
}

export async function limparCookieDeSessao(): Promise<void> {
  const armazem = await cookies();
  armazem.delete(NOME_COOKIE_SESSAO);
}

/**
 * Recupera o usuário da sessão atual, ou `null`.
 *
 * A consulta já filtra por status ATIVO: um usuário bloqueado com cookie válido
 * deixa de ser reconhecido imediatamente, sem depender da limpeza de sessões.
 */
export async function obterUsuarioDaSessao(): Promise<UsuarioAutenticado | null> {
  const armazem = await cookies();
  const token = armazem.get(NOME_COOKIE_SESSAO)?.value;
  if (!token) return null;

  const sessao = await prisma.sessao.findUnique({
    where: { tokenHash: calcularHash(token) },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          cpf: true,
          perfil: true,
          status: true,
          deveTrocarSenha: true,
          aceites: { select: { versaoTexto: true } },
        },
      },
    },
  });

  if (!sessao) return null;

  if (sessao.expiraEm.getTime() <= Date.now()) {
    await prisma.sessao.delete({ where: { id: sessao.id } }).catch(() => undefined);
    return null;
  }

  if (sessao.usuario.status !== 'ATIVO') return null;

  return {
    id: sessao.usuario.id,
    nome: sessao.usuario.nome,
    cpf: sessao.usuario.cpf,
    perfil: sessao.usuario.perfil,
    deveTrocarSenha: sessao.usuario.deveTrocarSenha,
    aceitouPrivacidade: aceitouAvisoVigente(sessao.usuario.aceites),
  };
}

/** Encerra a sessão atual (logout). */
export async function encerrarSessaoAtual(): Promise<void> {
  const armazem = await cookies();
  const token = armazem.get(NOME_COOKIE_SESSAO)?.value;

  if (token) {
    await prisma.sessao.deleteMany({ where: { tokenHash: calcularHash(token) } });
  }

  await limparCookieDeSessao();
}

/**
 * Encerra **todas** as sessões de um usuário.
 * Chamado ao bloquear, desativar, excluir ou redefinir senha (RN006).
 */
export async function encerrarSessoesDoUsuario(usuarioId: string): Promise<number> {
  const resultado = await prisma.sessao.deleteMany({ where: { usuarioId } });
  return resultado.count;
}

/**
 * Encerra todas as sessões do usuário **exceto a atual**.
 *
 * Usado na troca de senha: quem trocou a senha continua trabalhando, mas
 * qualquer outro dispositivo que estivesse autenticado com a senha antiga perde
 * o acesso na hora — que é justamente o motivo de alguém trocar a senha.
 */
export async function encerrarOutrasSessoes(usuarioId: string): Promise<number> {
  const armazem = await cookies();
  const token = armazem.get(NOME_COOKIE_SESSAO)?.value;

  const resultado = await prisma.sessao.deleteMany({
    where: {
      usuarioId,
      ...(token ? { tokenHash: { not: calcularHash(token) } } : {}),
    },
  });

  return resultado.count;
}

/** Rotina de limpeza (doc 13 · tarefa diária). */
export async function removerSessoesExpiradas(agora: Date = new Date()): Promise<number> {
  const resultado = await prisma.sessao.deleteMany({ where: { expiraEm: { lt: agora } } });
  return resultado.count;
}
