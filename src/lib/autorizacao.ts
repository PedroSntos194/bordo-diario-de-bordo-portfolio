import { ErroDeAutenticacao, ErroDePermissao, ErroNaoEncontrado } from '@/lib/erros';
import { obterUsuarioDaSessao, type UsuarioAutenticado } from '@/lib/sessao';

/**
 * Autorização — segunda das três camadas descritas no doc 13.
 *
 * 1. `middleware.ts` bloqueia áreas inteiras por perfil, antes de renderizar
 * 2. **estas funções**, chamadas por todo caso de uso, antes de qualquer efeito
 * 3. o filtro de propriedade dentro dos repositórios
 *
 * Uma camada sozinha não basta: o middleware não enxerga o dono do registro, e
 * o repositório não sabe qual ação está sendo executada.
 */

export type Perfil = 'ADMIN' | 'MOTORISTA';

/** Exige sessão válida. Lança 401 quando não há. */
export async function exigirSessao(): Promise<UsuarioAutenticado> {
  const usuario = await obterUsuarioDaSessao();
  if (!usuario) throw new ErroDeAutenticacao();
  return usuario;
}

/** Exige um dos perfis informados. Lança 403 quando o perfil não basta. */
export async function exigirPerfil(...perfis: Perfil[]): Promise<UsuarioAutenticado> {
  const usuario = await exigirSessao();
  if (!perfis.includes(usuario.perfil)) throw new ErroDePermissao();
  return usuario;
}

export async function exigirAdministrador(): Promise<UsuarioAutenticado> {
  return exigirPerfil('ADMIN');
}

export function ehAdministrador(usuario: UsuarioAutenticado): boolean {
  return usuario.perfil === 'ADMIN';
}

/**
 * RN008 e RN009 — o administrador enxerga tudo; o motorista, apenas o que é
 * dele.
 *
 * Responde **404**, e não 403, quando o registro é de outro motorista: um 403
 * confirmaria que o registro existe, permitindo mapear a operação alheia por
 * tentativa.
 */
export function exigirEscopoDoRegistro(
  usuario: UsuarioAutenticado,
  donoDoRegistroId: string | null | undefined,
): void {
  if (ehAdministrador(usuario)) return;
  if (donoDoRegistroId && donoDoRegistroId === usuario.id) return;
  throw new ErroNaoEncontrado();
}

/**
 * Devolve o filtro de motorista que o repositório deve aplicar.
 *
 * O motorista recebe sempre o próprio identificador, **ignorando** qualquer
 * `motoristaId` vindo do cliente — parâmetro de requisição nunca decide escopo
 * (doc 17).
 */
export function filtroDeMotorista(
  usuario: UsuarioAutenticado,
  motoristaIdSolicitado?: string | null,
): string | undefined {
  if (!ehAdministrador(usuario)) return usuario.id;
  return motoristaIdSolicitado ?? undefined;
}
