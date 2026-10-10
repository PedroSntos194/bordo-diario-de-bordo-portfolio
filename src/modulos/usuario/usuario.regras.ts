import { CodigoErro, ErroDeConflito, ErroDeNegocio } from '@/lib/erros';
import { cpfEhValido, normalizarCpf } from '@/utilitarios/cpf';

/**
 * Regras de negócio de usuário e senha (doc 06 · RN002 a RN011).
 *
 * Funções puras: sem banco, sem HTTP, sem `new Date()` interno — o instante
 * atual entra sempre por parâmetro, para que o comportamento seja determinístico
 * nos testes (inclusive nas fronteiras de prazo).
 */

export const POLITICA_SENHA = {
  tamanhoMinimo: 8,
  /** Tempo de vida da senha temporária (RN005). */
  horasValidadeSenhaTemporaria: 72,
} as const;

export const POLITICA_BLOQUEIO = {
  /** Falhas consecutivas antes do bloqueio (RN003). */
  tentativasMaximas: 5,
  minutosDeBloqueio: 15,
} as const;

// --------------------------------------------------------------------- CPF

/** RN002 — CPF precisa ser válido pelos dígitos verificadores. */
export function validarCpf(valor: string): string {
  const digitos = normalizarCpf(valor);

  if (!cpfEhValido(digitos)) {
    throw new ErroDeNegocio(
      CodigoErro.CPF_INVALIDO,
      'CPF inválido. Confira os números digitados.',
      {
        cpf: 'CPF inválido.',
      },
    );
  }

  return digitos;
}

// ------------------------------------------------------------------- senha

export interface ContextoDeSenha {
  cpf: string;
  matricula?: string | null;
  /** Verificação feita fora daqui, porque exige comparar hash. */
  igualASenhaAnterior?: boolean;
}

/**
 * RN004 — mínimo de 8 caracteres, com ao menos uma letra e um número; não pode
 * ser igual ao CPF, à matrícula nem à senha anterior.
 *
 * Devolve a lista de problemas em vez de lançar no primeiro: o usuário corrige
 * tudo de uma vez, em vez de descobrir um requisito por tentativa.
 */
export function problemasDaSenha(senha: string, contexto: ContextoDeSenha): string[] {
  const problemas: string[] = [];

  if (senha.length < POLITICA_SENHA.tamanhoMinimo) {
    problemas.push(`A senha precisa ter no mínimo ${POLITICA_SENHA.tamanhoMinimo} caracteres.`);
  }
  if (!/[a-zA-Z]/.test(senha)) {
    problemas.push('A senha precisa conter ao menos uma letra.');
  }
  if (!/\d/.test(senha)) {
    problemas.push('A senha precisa conter ao menos um número.');
  }

  const digitosCpf = normalizarCpf(contexto.cpf);
  if (digitosCpf.length > 0 && normalizarCpf(senha) === digitosCpf) {
    problemas.push('A senha não pode ser igual ao seu CPF.');
  }
  if (contexto.matricula && senha.trim() === contexto.matricula.trim()) {
    problemas.push('A senha não pode ser igual à sua matrícula.');
  }
  if (contexto.igualASenhaAnterior) {
    problemas.push('A nova senha não pode ser igual à anterior.');
  }

  return problemas;
}

export function validarSenha(senha: string, contexto: ContextoDeSenha): void {
  const problemas = problemasDaSenha(senha, contexto);
  if (problemas.length === 0) return;

  const codigo = problemas.some((problema) => problema.includes('anterior'))
    ? CodigoErro.SENHA_REPETIDA
    : CodigoErro.SENHA_FRACA;

  throw new ErroDeNegocio(codigo, problemas[0] ?? 'Senha inválida.', {
    novaSenha: problemas.join(' '),
  });
}

/** RN005 — validade da senha temporária a partir da emissão. */
export function expiracaoDaSenhaTemporaria(emitidaEm: Date): Date {
  return new Date(
    emitidaEm.getTime() + POLITICA_SENHA.horasValidadeSenhaTemporaria * 60 * 60 * 1000,
  );
}

export function senhaTemporariaExpirou(expiraEm: Date | null, agora: Date): boolean {
  if (expiraEm === null) return false;
  return agora.getTime() > expiraEm.getTime();
}

// ---------------------------------------------------------------- bloqueio

export interface EstadoDeTentativas {
  tentativasLogin: number;
  bloqueadoAte: Date | null;
}

export function contaEstaBloqueada(estado: EstadoDeTentativas, agora: Date): boolean {
  return estado.bloqueadoAte !== null && estado.bloqueadoAte.getTime() > agora.getTime();
}

export function minutosRestantesDeBloqueio(estado: EstadoDeTentativas, agora: Date): number {
  if (!contaEstaBloqueada(estado, agora)) return 0;
  const restanteMs = (estado.bloqueadoAte as Date).getTime() - agora.getTime();
  return Math.max(1, Math.ceil(restanteMs / 60_000));
}

/**
 * RN003 — calcula o novo estado após uma falha de autenticação.
 *
 * O bloqueio nasce exatamente na 5ª falha; da 6ª em diante o contador continua
 * subindo, mas a janela não é reiniciada — reiniciá-la permitiria estender o
 * bloqueio indefinidamente com tentativas automatizadas.
 */
export function aplicarFalhaDeLogin(estado: EstadoDeTentativas, agora: Date): EstadoDeTentativas {
  const tentativas = estado.tentativasLogin + 1;

  if (tentativas >= POLITICA_BLOQUEIO.tentativasMaximas && !contaEstaBloqueada(estado, agora)) {
    return {
      tentativasLogin: tentativas,
      bloqueadoAte: new Date(agora.getTime() + POLITICA_BLOQUEIO.minutosDeBloqueio * 60_000),
    };
  }

  return { tentativasLogin: tentativas, bloqueadoAte: estado.bloqueadoAte };
}

/** Login bem-sucedido zera o contador (RN003). */
export function limparTentativas(): EstadoDeTentativas {
  return { tentativasLogin: 0, bloqueadoAte: null };
}

// ------------------------------------------------------- ações administrativas

export type StatusDeUsuario = 'ATIVO' | 'INATIVO' | 'BLOQUEADO' | 'EXCLUIDO';
export type PerfilDeUsuario = 'ADMIN' | 'MOTORISTA';

/** RN006 — apenas usuário ATIVO autentica. */
export function podeAutenticar(status: StatusDeUsuario): boolean {
  return status === 'ATIVO';
}

export interface AlvoDeAcaoAdministrativa {
  idAlvo: string;
  perfilAlvo: PerfilDeUsuario;
  idExecutor: string;
  /** Quantidade de administradores ATIVOS, incluindo o alvo. */
  administradoresAtivos: number;
}

/**
 * RN010 e RN011 — protege o último administrador e proíbe a autoação.
 *
 * Vale para excluir, desativar, bloquear e rebaixar de perfil: são caminhos
 * diferentes para o mesmo resultado (ficar sem quem administre, ou alguém se
 * trancar para fora do sistema).
 */
export function validarAcaoAdministrativa(alvo: AlvoDeAcaoAdministrativa): void {
  if (alvo.idAlvo === alvo.idExecutor) {
    throw new ErroDeConflito(
      CodigoErro.ACAO_SOBRE_PROPRIA_CONTA,
      'Você não pode executar esta ação na sua própria conta.',
    );
  }

  if (alvo.perfilAlvo === 'ADMIN' && alvo.administradoresAtivos <= 1) {
    throw new ErroDeConflito(
      CodigoErro.ULTIMO_ADMINISTRADOR,
      'Não é possível remover o último administrador do sistema.',
    );
  }
}
