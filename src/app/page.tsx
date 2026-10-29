import { redirect } from 'next/navigation';
import { obterUsuarioDaSessao } from '@/lib/sessao';

/**
 * Porta de entrada: encaminha cada perfil para a sua área (doc 09 · F01).
 *
 * A ordem das verificações não é arbitrária — troca de senha e aviso de
 * privacidade precedem qualquer funcionalidade (RF003, RF042).
 */
export default async function PaginaInicial() {
  const usuario = await obterUsuarioDaSessao();

  if (!usuario) redirect('/login');
  if (usuario.deveTrocarSenha) redirect('/trocar-senha');
  if (!usuario.aceitouPrivacidade) redirect('/privacidade/aceite');

  redirect(usuario.perfil === 'ADMIN' ? '/admin' : '/app');
}
