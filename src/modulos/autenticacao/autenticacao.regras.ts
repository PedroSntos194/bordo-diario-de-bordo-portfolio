import {
  aplicarFalhaDeLogin,
  contaEstaBloqueada,
  limparTentativas,
  minutosRestantesDeBloqueio,
  podeAutenticar,
  senhaTemporariaExpirou,
  type EstadoDeTentativas,
  type StatusDeUsuario,
} from '@/modulos/usuario/usuario.regras';
import { VERSAO_AVISO_PRIVACIDADE } from '@/modulos/privacidade/aviso-privacidade';

/**
 * Decisão de login — função pura (US001 · RN003, RN005, RN006).
 *
 * Toda a árvore de decisão do login vive aqui, separada do acesso ao banco.
 * É o trecho de maior risco do sistema e o que mais precisa de teste de
 * fronteira: quem entra, quem é barrado, e com qual mensagem.
 */

export interface UsuarioParaLogin {
  status: StatusDeUsuario;
  tentativasLogin: number;
  bloqueadoAte: Date | null;
  senhaTemporariaExpiraEm: Date | null;
}

export type DecisaoDeLogin =
  | { tipo: 'SUCESSO'; novoEstado: EstadoDeTentativas }
  | { tipo: 'USUARIO_INEXISTENTE' }
  | { tipo: 'CREDENCIAIS_INVALIDAS'; novoEstado: EstadoDeTentativas; bloqueouAgora: boolean }
  | { tipo: 'CONTA_BLOQUEADA'; minutosRestantes: number }
  | { tipo: 'CONTA_INATIVA' }
  | { tipo: 'SENHA_TEMPORARIA_EXPIRADA' };

export interface TentativaDeLogin {
  usuario: UsuarioParaLogin | null;
  /** Resultado da verificação do hash, feita fora daqui. */
  senhaCorreta: boolean;
  agora: Date;
}

/**
 * A **ordem** das verificações é a parte importante desta função:
 *
 * 1. usuário inexistente → mensagem genérica, sem revelar que o CPF não existe;
 * 2. conta bloqueada por tentativas → antes de conferir a senha, senão a força
 *    bruta continuaria rodando durante o bloqueio;
 * 3. senha incorreta → incrementa o contador;
 * 4. conta inativa → **só depois** de a senha estar correta. Informar "conta
 *    inativa" antes disso confirmaria a existência do CPF a quem não sabe a
 *    senha. Assim, só o dono legítimo recebe a orientação de procurar o
 *    administrador (isto refina o fluxo F01/E3 do doc 09);
 * 5. senha temporária vencida;
 * 6. sucesso.
 */
export function avaliarTentativaDeLogin(tentativa: TentativaDeLogin): DecisaoDeLogin {
  const { usuario, senhaCorreta, agora } = tentativa;

  if (usuario === null) {
    return { tipo: 'USUARIO_INEXISTENTE' };
  }

  const estado: EstadoDeTentativas = {
    tentativasLogin: usuario.tentativasLogin,
    bloqueadoAte: usuario.bloqueadoAte,
  };

  if (contaEstaBloqueada(estado, agora)) {
    return {
      tipo: 'CONTA_BLOQUEADA',
      minutosRestantes: minutosRestantesDeBloqueio(estado, agora),
    };
  }

  if (!senhaCorreta) {
    const novoEstado = aplicarFalhaDeLogin(estado, agora);
    return {
      tipo: 'CREDENCIAIS_INVALIDAS',
      novoEstado,
      bloqueouAgora: contaEstaBloqueada(novoEstado, agora) && !contaEstaBloqueada(estado, agora),
    };
  }

  if (!podeAutenticar(usuario.status)) {
    return { tipo: 'CONTA_INATIVA' };
  }

  if (senhaTemporariaExpirou(usuario.senhaTemporariaExpiraEm, agora)) {
    return { tipo: 'SENHA_TEMPORARIA_EXPIRADA' };
  }

  return { tipo: 'SUCESSO', novoEstado: limparTentativas() };
}

/**
 * Destino após a autenticação (doc 09 · F01).
 *
 * Troca de senha e aviso de privacidade precedem qualquer funcionalidade
 * (RF003, RF042) — e nesta ordem: não faz sentido pedir o aceite de privacidade
 * a quem ainda está usando uma senha que o administrador conhece.
 */
export function destinoAposLogin(situacao: {
  perfil: 'ADMIN' | 'MOTORISTA';
  deveTrocarSenha: boolean;
  aceitouPrivacidade: boolean;
}): string {
  if (situacao.deveTrocarSenha) return '/trocar-senha';
  if (!situacao.aceitouPrivacidade) return '/privacidade/aceite';
  return situacao.perfil === 'ADMIN' ? '/admin' : '/app';
}

/**
 * Só vale o aceite da versão vigente do aviso (RF042).
 *
 * Aceite de versão anterior não conta: quando o texto muda, a versão sobe e
 * todo mundo passa de novo pela tela de aceite no próximo acesso. Contar
 * qualquer aceite, como era antes, fazia a troca de versão não obrigar ninguém.
 */
export function aceitouAvisoVigente(aceites: { versaoTexto: string }[]): boolean {
  return aceites.some((aceite) => aceite.versaoTexto === VERSAO_AVISO_PRIVACIDADE);
}

export type PendenciaDeUso = 'TROCAR_SENHA' | 'ACEITAR_PRIVACIDADE';

/**
 * O que falta resolver antes de usar o sistema (RF003, RF042), na mesma ordem
 * de `destinoAposLogin`. Nulo quando não há pendência.
 *
 * Os layouts de cada área já redirecionam por isto; o `definirAcao` também
 * confere, porque as rotas de API e as Server Actions são alcançáveis sem
 * passar por layout nenhum.
 */
export function pendenciaDeUso(situacao: {
  deveTrocarSenha: boolean;
  aceitouPrivacidade: boolean;
}): PendenciaDeUso | null {
  if (situacao.deveTrocarSenha) return 'TROCAR_SENHA';
  if (!situacao.aceitouPrivacidade) return 'ACEITAR_PRIVACIDADE';
  return null;
}

/**
 * Valida o destino de retorno vindo da URL (`?retorno=`).
 *
 * Só caminhos internos são aceitos — sem isso, um link
 * `/login?retorno=https://site-falso` levaria o usuário para fora do sistema
 * logo após autenticar (open redirect, doc 17).
 */
export function retornoEhSeguro(retorno: string | null | undefined): retorno is string {
  if (!retorno) return false;
  if (!retorno.startsWith('/')) return false;
  if (retorno.startsWith('//')) return false;
  if (retorno.includes('\\')) return false;
  return true;
}
