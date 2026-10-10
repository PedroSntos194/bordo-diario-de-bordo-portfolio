import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import type { ZodType, ZodTypeDef } from 'zod';
import { ZodError } from 'zod';
import { prisma, type ClientePrisma } from '@/lib/prisma';
import { exigirPerfil, exigirSessao, type Perfil } from '@/lib/autorizacao';
import type { UsuarioAutenticado } from '@/lib/sessao';
import { logger } from '@/lib/logger';
import {
  CodigoErro,
  ErroDaAplicacao,
  ErroDeConflito,
  ErroDePermissao,
  ErroDeValidacao,
  ErroInterno,
  ehErroDaAplicacao,
  gerarReferenciaDeErro,
  type ErrosDeCampo,
  type RespostaDeErro,
} from '@/lib/erros';
import {
  registrarAuditoria,
  type RegistroDeAuditoria,
} from '@/modulos/auditoria/auditoria.servico';
import { aplicarMensagensEmPortugues } from '@/lib/validacao';
import { pendenciaDeUso, type PendenciaDeUso } from '@/modulos/autenticacao/autenticacao.regras';

// Toda validação do servidor passa por aqui, então este é o ponto certo para
// garantir que as mensagens do Zod saiam em português (RNF023).
aplicarMensagensEmPortugues();

const MENSAGEM_DA_PENDENCIA: Record<PendenciaDeUso, string> = {
  TROCAR_SENHA: 'Troque a senha temporária antes de continuar.',
  ACEITAR_PRIVACIDADE: 'Aceite o aviso de privacidade antes de continuar.',
};

/**
 * Wrapper único por onde passa **toda** mutação do sistema.
 *
 *   sessão → permissão → validação → transação → auditoria → resposta tipada
 *
 * É o que torna autorização (RF041) e auditoria (RF037) estruturais em vez de
 * dependentes de disciplina: uma funcionalidade nova nasce dentro do wrapper e
 * herda as duas, ou não compila por falta do contexto.
 *
 * Ordem de implementação (doc 23 · etapa 3): este arquivo existe antes do
 * primeiro caso de uso, justamente para não precisar reabrir todos depois.
 */

export interface ContextoDaAcao {
  usuario: UsuarioAutenticado;
  /** Cliente **dentro da transação**. Repositórios recebem este cliente. */
  tx: ClientePrisma;
  ip: string | null;
  userAgent: string | null;
  /**
   * Enfileira um registro de auditoria. Gravado na mesma transação, ao final:
   * se a operação for desfeita, a trilha também é.
   */
  auditar: (registro: Omit<RegistroDeAuditoria, 'usuarioId' | 'ip' | 'userAgent'>) => void;
}

export type Resultado<T> = { sucesso: true; dados: T } | ({ sucesso: false } & RespostaDeErro);

interface ConfiguracaoDaAcao<Entrada, Saida> {
  /** Nome curto usado em log e telemetria (ex.: `jornada.abrir`). */
  nome: string;
  /** Perfis autorizados. Omitir exige apenas sessão válida. */
  perfis?: Perfil[];
  /**
   * Esquema Zod da entrada. Omitir para ações sem parâmetros.
   *
   * O tipo de entrada do esquema é `unknown` de propósito: a ação sempre recebe
   * dados não confiáveis (corpo HTTP, argumento de Server Action), e esquemas
   * com `transform`, `coerce` ou `default` têm tipo de entrada diferente do de
   * saída. Amarrar os dois obrigaria cada esquema a declarar o formato bruto.
   */
  esquema?: ZodType<Entrada, ZodTypeDef, unknown>;
  /** Ação sem autenticação (login, health). Uso restrito e explícito. */
  publica?: boolean;
  /**
   * Ação executada pelo **próprio sistema**, fora de qualquer requisição: as
   * rotinas agendadas do `agendador` (consolidado diário, expurgo).
   *
   * Existe para que a regra 3 do projeto — *toda mutação passa por
   * `definirAcao`* — continue valendo quando não há usuário logado. A
   * alternativa seria a tarefa escrever no banco por fora do wrapper, sem
   * transação e sem auditoria, que é exatamente o que o wrapper impede.
   *
   * Não confundir com `publica`: aquela é alcançável pela rede sem sessão;
   * esta **não tem porta HTTP** — só o processo do agendador a invoca. A
   * auditoria resultante fica com `usuarioId` nulo, que é como a trilha
   * representa "sistema".
   */
  sistema?: boolean;
  /**
   * Ação permitida a quem ainda tem senha temporária ou aviso de privacidade
   * por aceitar (RF003, RF042). Só as que **resolvem** a pendência — trocar a
   * senha, aceitar o aviso — e sair. Todo o resto é recusado com 403 até lá,
   * inclusive leitura: antes do aceite, o sistema não mostra nem coleta nada.
   */
  permitePendencias?: boolean;
  /** Ações somente de leitura dispensam transação. */
  semTransacao?: boolean;
  /**
   * Tempo limite da transação, em milissegundos. Omitir usa o padrão do Prisma
   * (5 s), que é o certo para **toda** operação nascida de um toque na tela.
   *
   * Existe por causa da importação em lote (US015): sessenta usuários custam
   * sessenta hashes Argon2 — caros de propósito (RNF001) — mais sessenta
   * inserções contra um banco gerenciado em outra região. Isso não cabe em
   * cinco segundos, e a alternativa seria gravar fora da transação, deixando
   * uma carga pela metade quando algo falhasse no meio.
   *
   * Elevar o limite é decisão consciente por caso de uso, nunca padrão: uma
   * transação longa segura conexão e bloqueios do banco que também atende os
   * motoristas em campo.
   */
  tempoLimiteMs?: number;
  executar: (dados: Entrada, contexto: ContextoDaAcao) => Promise<Saida>;
}

async function dadosDaRequisicao(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const cabecalhos = await headers();
    const encaminhado = cabecalhos.get('x-forwarded-for');
    return {
      ip: encaminhado?.split(',')[0]?.trim() ?? cabecalhos.get('x-real-ip') ?? null,
      userAgent: cabecalhos.get('user-agent'),
    };
  } catch {
    // Fora do ciclo de requisição (tarefa agendada, seed).
    return { ip: null, userAgent: null };
  }
}

/**
 * Traduz violação de constraint do banco para erro de negócio.
 *
 * O banco é a última linha de defesa contra condição de corrida — verificar
 * antes e inserir depois não impede duas requisições simultâneas. Quando a
 * constraint dispara, o usuário precisa ver a mensagem do domínio, nunca a
 * mensagem do Prisma (doc 18).
 */
function traduzirErroDoBanco(erro: unknown): ErroDaAplicacao | null {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError)) return null;

  if (erro.code === 'P2002') {
    const alvo = Array.isArray(erro.meta?.target)
      ? (erro.meta.target as string[]).join(',')
      : String(erro.meta?.target ?? '');

    if (alvo.includes('cpf')) {
      return new ErroDeConflito(
        CodigoErro.CPF_DUPLICADO,
        'Já existe um usuário ativo com este CPF.',
        { cpf: 'CPF já cadastrado.' },
      );
    }
    if (alvo.includes('placa')) {
      return new ErroDeConflito(
        CodigoErro.PLACA_DUPLICADA,
        'Já existe um veículo com esta placa.',
        { placa: 'Placa já cadastrada.' },
      );
    }
    if (alvo.includes('codigo')) {
      return new ErroDeConflito(CodigoErro.CODIGO_DUPLICADO, 'Este código já está em uso.', {
        codigo: 'Código já cadastrado.',
      });
    }
    if (alvo.includes('motorista_id') || alvo.includes('data')) {
      return new ErroDeConflito(
        CodigoErro.JORNADA_JA_ABERTA,
        'Já existe uma jornada registrada para este motorista nesta data.',
      );
    }
    if (alvo.includes('jornada_id')) {
      return new ErroDeConflito(
        CodigoErro.CORRIDA_JA_EM_ANDAMENTO,
        'Você já tem uma corrida em andamento. Encerre-a para iniciar outra.',
      );
    }

    return new ErroDeConflito(CodigoErro.CONFLITO, 'Já existe um registro com estes dados.');
  }

  if (erro.code === 'P2025') {
    return new ErroDeConflito(CodigoErro.NAO_ENCONTRADO, 'Registro não encontrado.');
  }

  return null;
}

/**
 * O Next usa **exceções como sinal de controle**: `redirect()`, `notFound()` e a
 * detecção de renderização dinâmica quando algo lê `cookies()`.
 *
 * Como este wrapper captura tudo, esses sinais precisam ser reconhecidos e
 * relançados. Sem isso, um `redirect()` dentro de um caso de uso viraria
 * silenciosamente `{ sucesso: false }` — o usuário ficaria parado na tela sem
 * entender por quê — e a sondagem de rota estática do build registraria erros
 * falsos, como aconteceu na Sprint 4.
 */
function ehSinalDeControleDoNext(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;

  const digest = (erro as { digest?: unknown }).digest;
  if (typeof digest === 'string') {
    if (digest.startsWith('NEXT_REDIRECT')) return true;
    if (digest === 'NEXT_NOT_FOUND') return true;
    if (digest === 'DYNAMIC_SERVER_USAGE') return true;
  }

  // A detecção de rota dinâmica chega como classe própria em alguns caminhos.
  return (erro as { constructor?: { name?: string } }).constructor?.name === 'DynamicServerError';
}

function camposDoZod(erro: ZodError): ErrosDeCampo {
  const campos: ErrosDeCampo = {};
  for (const problema of erro.issues) {
    const caminho = problema.path.join('.') || 'geral';
    campos[caminho] ??= problema.message;
  }
  return campos;
}

/**
 * Define uma ação segura. O retorno é uma função pronta para ser exportada
 * como Server Action ou chamada por um Route Handler.
 */
export function definirAcao<Entrada, Saida>(configuracao: ConfiguracaoDaAcao<Entrada, Saida>) {
  return async function executarAcao(entrada?: unknown): Promise<Resultado<Saida>> {
    const inicio = Date.now();
    const { ip, userAgent } = await dadosDaRequisicao();

    try {
      // 1 · sessão e permissão -------------------------------------------------
      let usuario: UsuarioAutenticado;

      if (configuracao.sistema) {
        usuario = {
          id: '',
          nome: 'sistema',
          cpf: '',
          // A rotina agendada enxerga a frota inteira, como o administrador.
          perfil: 'ADMIN',
          deveTrocarSenha: false,
          aceitouPrivacidade: true,
        };
      } else if (configuracao.publica) {
        usuario = {
          id: '',
          nome: 'anônimo',
          cpf: '',
          perfil: 'MOTORISTA',
          deveTrocarSenha: false,
          aceitouPrivacidade: true,
        };
      } else if (configuracao.perfis && configuracao.perfis.length > 0) {
        usuario = await exigirPerfil(...configuracao.perfis);
      } else {
        usuario = await exigirSessao();
      }

      // As telas já redirecionam quem tem pendência; a API e as Server Actions
      // não passam por tela, e sem isto aceitavam jornada aberta com senha
      // temporária e localização gravada antes do aceite do aviso.
      const pendencia = configuracao.permitePendencias ? null : pendenciaDeUso(usuario);
      if (pendencia) {
        throw new ErroDePermissao(CodigoErro.SEM_PERMISSAO, MENSAGEM_DA_PENDENCIA[pendencia]);
      }

      // 2 · validação da entrada ----------------------------------------------
      let dados: Entrada;
      if (configuracao.esquema) {
        const analise = configuracao.esquema.safeParse(entrada);
        if (!analise.success) throw new ErroDeValidacao(camposDoZod(analise.error));
        dados = analise.data;
      } else {
        dados = undefined as Entrada;
      }

      // 3 · execução, transação e auditoria -----------------------------------
      const pendentesDeAuditoria: RegistroDeAuditoria[] = [];

      const enfileirarAuditoria = (
        registro: Omit<RegistroDeAuditoria, 'usuarioId' | 'ip' | 'userAgent'>,
      ): void => {
        pendentesDeAuditoria.push({
          ...registro,
          usuarioId: configuracao.publica || configuracao.sistema ? null : usuario.id,
          ip,
          userAgent,
        });
      };

      const rodar = async (cliente: ClientePrisma): Promise<Saida> => {
        const contexto: ContextoDaAcao = {
          usuario,
          tx: cliente,
          ip,
          userAgent,
          auditar: enfileirarAuditoria,
        };

        const saida = await configuracao.executar(dados, contexto);

        for (const registro of pendentesDeAuditoria) {
          await registrarAuditoria(cliente, registro);
        }

        return saida;
      };

      const resultado = configuracao.semTransacao
        ? await rodar(prisma)
        : await prisma.$transaction(
            (cliente) => rodar(cliente),
            configuracao.tempoLimiteMs
              ? {
                  timeout: configuracao.tempoLimiteMs,
                  // A espera por uma conexão livre acompanha o limite: de nada
                  // adianta permitir a transação longa e desistir na fila.
                  maxWait: Math.min(configuracao.tempoLimiteMs, 15_000),
                }
              : undefined,
          );

      logger.info('acao.concluida', {
        acao: configuracao.nome,
        usuarioId: configuracao.publica || configuracao.sistema ? null : usuario.id,
        duracaoMs: Date.now() - inicio,
      });

      return { sucesso: true, dados: resultado };
    } catch (erro) {
      // Relança antes de qualquer tratamento: não é falha, é controle de fluxo.
      if (ehSinalDeControleDoNext(erro)) throw erro;
      return tratarFalha(erro, configuracao.nome, ip, Date.now() - inicio);
    }
  };
}

function tratarFalha<Saida>(
  erro: unknown,
  nomeDaAcao: string,
  ip: string | null,
  duracaoMs: number,
): Resultado<Saida> {
  const traduzido = traduzirErroDoBanco(erro);
  const falha: ErroDaAplicacao =
    traduzido ?? (ehErroDaAplicacao(erro) ? erro : criarErroInterno(erro));

  const nivel = falha.status >= 500 ? 'error' : 'warn';
  logger[nivel]('acao.falhou', {
    acao: nomeDaAcao,
    codigo: falha.codigo,
    status: falha.status,
    duracaoMs,
    ip,
    ...(falha instanceof ErroInterno
      ? {
          referencia: falha.referencia,
          detalhe: falha.causaOriginal instanceof Error ? falha.causaOriginal.message : undefined,
          pilha: falha.causaOriginal instanceof Error ? falha.causaOriginal.stack : undefined,
        }
      : {}),
  });

  return {
    sucesso: false,
    erro: {
      codigo: falha.codigo,
      mensagem: falha.message,
      ...(falha.campos ? { campos: falha.campos } : {}),
      ...(falha instanceof ErroInterno ? { referencia: falha.referencia } : {}),
    },
  };
}

function criarErroInterno(causa: unknown): ErroInterno {
  return new ErroInterno(gerarReferenciaDeErro(), causa);
}

/** Converte o resultado em `Response` JSON, para uso em Route Handlers. */
export function comoResposta<T>(resultado: Resultado<T>, statusDeSucesso = 200): Response {
  if (resultado.sucesso) {
    return Response.json(resultado.dados, { status: statusDeSucesso });
  }

  return Response.json(
    { erro: resultado.erro },
    { status: statusPorCodigo(resultado.erro.codigo) },
  );
}

const STATUS_POR_CODIGO: Partial<Record<CodigoErro, number>> = {
  [CodigoErro.DADOS_INVALIDOS]: 400,
  [CodigoErro.CPF_INVALIDO]: 422,
  [CodigoErro.NAO_AUTENTICADO]: 401,
  [CodigoErro.SESSAO_EXPIRADA]: 401,
  [CodigoErro.CREDENCIAIS_INVALIDAS]: 401,
  [CodigoErro.SEM_PERMISSAO]: 403,
  [CodigoErro.CONTA_BLOQUEADA]: 403,
  [CodigoErro.CONTA_INATIVA]: 403,
  [CodigoErro.SENHA_TEMPORARIA_EXPIRADA]: 403,
  [CodigoErro.FORA_DA_JANELA_DE_EDICAO]: 403,
  [CodigoErro.NAO_ENCONTRADO]: 404,
  // 410 e não 404: o arquivo existiu e foi expurgado pela política de retenção.
  // A distinção importa para quem guardou o link (doc 16).
  [CodigoErro.ARQUIVO_EXPIRADO]: 410,
  [CodigoErro.ARQUIVO_MUITO_GRANDE]: 413,
  [CodigoErro.TIPO_ARQUIVO_NAO_PERMITIDO]: 415,
  [CodigoErro.LIMITE_EXCEDIDO]: 429,
  [CodigoErro.SERVICO_INDISPONIVEL]: 502,
  [CodigoErro.ERRO_INTERNO]: 500,
};

const CODIGOS_DE_CONFLITO = new Set<CodigoErro>([
  CodigoErro.CONFLITO,
  CodigoErro.CPF_DUPLICADO,
  CodigoErro.PLACA_DUPLICADA,
  CodigoErro.CODIGO_DUPLICADO,
  CodigoErro.ULTIMO_ADMINISTRADOR,
  CodigoErro.ACAO_SOBRE_PROPRIA_CONTA,
  CodigoErro.VEICULO_EM_USO,
  CodigoErro.JORNADA_NAO_ABERTA,
  CodigoErro.JORNADA_JA_ENCERRADA,
  CodigoErro.JORNADA_NAO_ENCERRADA,
  CodigoErro.JORNADA_JA_ABERTA,
  CodigoErro.CORRIDA_JA_EM_ANDAMENTO,
  CodigoErro.CORRIDA_EM_ANDAMENTO,
  CodigoErro.CORRIDA_JA_ENCERRADA,
]);

function statusPorCodigo(codigo: CodigoErro): number {
  if (STATUS_POR_CODIGO[codigo]) return STATUS_POR_CODIGO[codigo];
  if (CODIGOS_DE_CONFLITO.has(codigo)) return 409;
  // Demais códigos são violações de regra de negócio.
  return 422;
}
