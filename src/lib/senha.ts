import { hash, verify } from '@node-rs/argon2';
import { randomInt } from 'node:crypto';

/**
 * Hash de senha com Argon2id (RNF001).
 *
 * Parâmetros seguem a recomendação do OWASP para Argon2id (19 MiB, 2 iterações,
 * paralelismo 1). Revisar anualmente — ver checklist do doc 17.
 */
const OPCOES_ARGON2 = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Hash descartável usado para gastar o mesmo tempo quando o CPF não existe.
 *
 * Sem isto, o tempo de resposta denunciaria quais CPFs estão cadastrados —
 * enumeração de contas por medição (doc 17).
 */
let hashFalsoEmCache: string | null = null;

export async function gerarHashDeSenha(senha: string): Promise<string> {
  return hash(senha, OPCOES_ARGON2);
}

export async function senhaConfere(hashArmazenado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha);
  } catch {
    // Hash corrompido ou em formato desconhecido: trata como senha incorreta,
    // nunca como erro exposto ao usuário.
    return false;
  }
}

/** Executa uma verificação descartável para manter o tempo de resposta constante. */
export async function gastarTempoDeVerificacao(): Promise<void> {
  hashFalsoEmCache ??= await gerarHashDeSenha('senha-inexistente-para-tempo-constante');
  await senhaConfere(hashFalsoEmCache, 'valor-qualquer');
}

/**
 * Senha temporária legível por telefone (RF002).
 *
 * O alfabeto omite `0`, `O`, `1`, `I` e `l`: o administrador vai ditar essa
 * senha para o motorista, e esses caracteres se confundem na fala e na leitura.
 */
const ALFABETO_LEGIVEL = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function gerarSenhaTemporaria(tamanho = 10): string {
  let senha = '';
  for (let posicao = 0; posicao < tamanho; posicao += 1) {
    senha += ALFABETO_LEGIVEL[randomInt(ALFABETO_LEGIVEL.length)];
  }

  // Garante que atende à política (RN004): ao menos uma letra e um número.
  if (!/[A-Z]/.test(senha)) return gerarSenhaTemporaria(tamanho);
  if (!/\d/.test(senha)) return gerarSenhaTemporaria(tamanho);

  return senha;
}
