import { env, emProducao } from '@/lib/env';

/**
 * Log estruturado em JSON (RNF018).
 *
 * Regra inegociável (doc 17): nunca registrar senha, hash, token, cookie, CPF
 * completo ou coordenadas exatas. `mascararDados` remove esses campos mesmo que
 * alguém os passe por engano — a proteção não pode depender de disciplina.
 */

type Nivel = 'debug' | 'info' | 'warn' | 'error';

const ordem: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const CAMPOS_PROIBIDOS = new Set([
  'senha',
  'senhaatual',
  'novasenha',
  'confirmacao',
  'senhahash',
  'senha_hash',
  'senhatemporaria',
  'token',
  'tokenhash',
  'token_hash',
  'cookie',
  'authorization',
  'sessao_secret',
  'cpf',
  'latitude',
  'longitude',
]);

type Contexto = Record<string, unknown>;

function mascararDados(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 6) return '[profundo demais]';
  if (valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map((item) => mascararDados(item, profundidade + 1));

  if (typeof valor === 'object') {
    const resultado: Record<string, unknown> = {};
    for (const [chave, conteudo] of Object.entries(valor as Record<string, unknown>)) {
      resultado[chave] = CAMPOS_PROIBIDOS.has(chave.toLowerCase())
        ? '[protegido]'
        : mascararDados(conteudo, profundidade + 1);
    }
    return resultado;
  }

  return valor;
}

function escrever(nivel: Nivel, mensagem: string, contexto?: Contexto): void {
  if (ordem[nivel] < ordem[env.LOG_NIVEL]) return;

  // Os campos próprios da linha vêm **depois** do contexto, e não antes.
  // Invertido, um contexto com a chave `horario` — o nome natural para "horário
  // configurado" — sobrescreveria o carimbo de tempo do log, e a linha sairia
  // datada de "23:00". Aconteceu no agendador da Sprint 6.
  const linha = {
    ...(contexto ? (mascararDados(contexto) as Contexto) : {}),
    nivel,
    mensagem,
    horario: new Date().toISOString(),
  };

  const saida = emProducao ? JSON.stringify(linha) : formatarParaLeitura(linha);

  if (nivel === 'error') console.error(saida);
  else if (nivel === 'warn') console.warn(saida);
  else console.log(saida);
}

function formatarParaLeitura(linha: Record<string, unknown>): string {
  const { nivel, mensagem, horario, ...resto } = linha;
  const extras = Object.keys(resto).length > 0 ? ` ${JSON.stringify(resto)}` : '';
  return `[${String(horario)}] ${String(nivel).toUpperCase()} ${String(mensagem)}${extras}`;
}

export const logger = {
  debug: (mensagem: string, contexto?: Contexto) => escrever('debug', mensagem, contexto),
  info: (mensagem: string, contexto?: Contexto) => escrever('info', mensagem, contexto),
  warn: (mensagem: string, contexto?: Contexto) => escrever('warn', mensagem, contexto),
  error: (mensagem: string, contexto?: Contexto) => escrever('error', mensagem, contexto),
};

/** Exportado apenas para teste do mascaramento. */
export const _mascararDados = mascararDados;
