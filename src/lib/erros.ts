/**
 * Taxonomia de erros do sistema (doc 18).
 *
 * Princípio: erro previsível não é exceção de infraestrutura. Odômetro
 * incoerente é resultado esperado de uma validação e tem tratamento próprio —
 * só o que é genuinamente inesperado vira `ErroInterno`.
 *
 * Nenhuma mensagem daqui pode expor stack trace, SQL, nome de tabela ou versão
 * de biblioteca: o texto de `mensagem` vai direto para a tela do usuário.
 */

/** Códigos estáveis, consumidos pelo frontend para decidir comportamento. */
export const CodigoErro = {
  // autenticação e conta
  CREDENCIAIS_INVALIDAS: 'CREDENCIAIS_INVALIDAS',
  CONTA_BLOQUEADA: 'CONTA_BLOQUEADA',
  CONTA_INATIVA: 'CONTA_INATIVA',
  SENHA_TEMPORARIA_EXPIRADA: 'SENHA_TEMPORARIA_EXPIRADA',
  SENHA_FRACA: 'SENHA_FRACA',
  SENHA_REPETIDA: 'SENHA_REPETIDA',
  SESSAO_EXPIRADA: 'SESSAO_EXPIRADA',
  NAO_AUTENTICADO: 'NAO_AUTENTICADO',
  SEM_PERMISSAO: 'SEM_PERMISSAO',

  // usuários
  CPF_DUPLICADO: 'CPF_DUPLICADO',
  CPF_INVALIDO: 'CPF_INVALIDO',
  ULTIMO_ADMINISTRADOR: 'ULTIMO_ADMINISTRADOR',
  ACAO_SOBRE_PROPRIA_CONTA: 'ACAO_SOBRE_PROPRIA_CONTA',

  // cadastros
  PLACA_DUPLICADA: 'PLACA_DUPLICADA',
  VEICULO_EM_USO: 'VEICULO_EM_USO',
  VEICULO_INATIVO: 'VEICULO_INATIVO',
  ROTA_INATIVA: 'ROTA_INATIVA',
  CODIGO_DUPLICADO: 'CODIGO_DUPLICADO',

  // operação
  JORNADA_NAO_ABERTA: 'JORNADA_NAO_ABERTA',
  JORNADA_JA_ENCERRADA: 'JORNADA_JA_ENCERRADA',
  /** O oposto de `JORNADA_NAO_ABERTA`: existe a jornada, mas o dia não fechou. */
  JORNADA_NAO_ENCERRADA: 'JORNADA_NAO_ENCERRADA',
  JORNADA_JA_ABERTA: 'JORNADA_JA_ABERTA',
  CORRIDA_JA_EM_ANDAMENTO: 'CORRIDA_JA_EM_ANDAMENTO',
  CORRIDA_EM_ANDAMENTO: 'CORRIDA_EM_ANDAMENTO',
  CORRIDA_JA_ENCERRADA: 'CORRIDA_JA_ENCERRADA',
  ODOMETRO_MENOR_QUE_ULTIMO: 'ODOMETRO_MENOR_QUE_ULTIMO',
  ODOMETRO_MENOR_QUE_INICIAL: 'ODOMETRO_MENOR_QUE_INICIAL',
  ODOMETRO_INCOERENTE: 'ODOMETRO_INCOERENTE',
  DIVERGENCIA_ODOMETRO_NAO_CONFIRMADA: 'DIVERGENCIA_ODOMETRO_NAO_CONFIRMADA',
  EXCESSO_PASSAGEIROS_NAO_CONFIRMADO: 'EXCESSO_PASSAGEIROS_NAO_CONFIRMADO',
  HORARIO_INVALIDO: 'HORARIO_INVALIDO',
  FORA_DA_JANELA_DE_EDICAO: 'FORA_DA_JANELA_DE_EDICAO',
  JUSTIFICATIVA_OBRIGATORIA: 'JUSTIFICATIVA_OBRIGATORIA',

  // relatórios e arquivos
  SEM_RESULTADOS_PARA_EXPORTAR: 'SEM_RESULTADOS_PARA_EXPORTAR',
  PERIODO_MUITO_LONGO: 'PERIODO_MUITO_LONGO',
  CABECALHO_INVALIDO: 'CABECALHO_INVALIDO',
  ARQUIVO_MUITO_GRANDE: 'ARQUIVO_MUITO_GRANDE',
  TIPO_ARQUIVO_NAO_PERMITIDO: 'TIPO_ARQUIVO_NAO_PERMITIDO',
  ARQUIVO_EXPIRADO: 'ARQUIVO_EXPIRADO',

  // genéricos
  DADOS_INVALIDOS: 'DADOS_INVALIDOS',
  NAO_ENCONTRADO: 'NAO_ENCONTRADO',
  CONFLITO: 'CONFLITO',
  LIMITE_EXCEDIDO: 'LIMITE_EXCEDIDO',
  SERVICO_INDISPONIVEL: 'SERVICO_INDISPONIVEL',
  ERRO_INTERNO: 'ERRO_INTERNO',
} as const;

export type CodigoErro = (typeof CodigoErro)[keyof typeof CodigoErro];

/** Erros de campo, no formato `{ nomeDoCampo: mensagem }`. */
export type ErrosDeCampo = Record<string, string>;

export abstract class ErroDaAplicacao extends Error {
  abstract readonly status: number;
  readonly codigo: CodigoErro;
  readonly campos?: ErrosDeCampo;

  protected constructor(codigo: CodigoErro, mensagem: string, campos?: ErrosDeCampo) {
    super(mensagem);
    this.name = new.target.name;
    this.codigo = codigo;
    this.campos = campos;
  }
}

/** 400 — a entrada não passou pelo esquema de validação. */
export class ErroDeValidacao extends ErroDaAplicacao {
  readonly status = 400;

  constructor(campos: ErrosDeCampo, mensagem = 'Verifique os campos destacados.') {
    super(CodigoErro.DADOS_INVALIDOS, mensagem, campos);
  }
}

/** 401 — sem sessão válida. */
export class ErroDeAutenticacao extends ErroDaAplicacao {
  readonly status = 401;

  constructor(
    codigo: CodigoErro = CodigoErro.NAO_AUTENTICADO,
    mensagem = 'Faça login para continuar.',
  ) {
    super(codigo, mensagem);
  }
}

/** 403 — autenticado, mas sem direito à ação. */
export class ErroDePermissao extends ErroDaAplicacao {
  readonly status = 403;

  constructor(
    codigo: CodigoErro = CodigoErro.SEM_PERMISSAO,
    mensagem = 'Você não tem acesso a esta área.',
  ) {
    super(codigo, mensagem);
  }
}

/**
 * 404 — recurso inexistente **ou fora do escopo do usuário**.
 *
 * A escolha por 404 em vez de 403 para dado de terceiro é deliberada (RN009):
 * responder 403 confirmaria que o registro existe.
 */
export class ErroNaoEncontrado extends ErroDaAplicacao {
  readonly status = 404;

  constructor(mensagem = 'Registro não encontrado.') {
    super(CodigoErro.NAO_ENCONTRADO, mensagem);
  }
}

/** 409 — estado atual incompatível com a ação. */
export class ErroDeConflito extends ErroDaAplicacao {
  readonly status = 409;

  constructor(codigo: CodigoErro, mensagem: string, campos?: ErrosDeCampo) {
    super(codigo, mensagem, campos);
  }
}

/** 422 — regra de negócio violada (doc 06). */
export class ErroDeNegocio extends ErroDaAplicacao {
  readonly status = 422;

  constructor(codigo: CodigoErro, mensagem: string, campos?: ErrosDeCampo) {
    super(codigo, mensagem, campos);
  }
}

/** 429 — limite de requisições excedido (RNF004). */
export class ErroDeLimite extends ErroDaAplicacao {
  readonly status = 429;

  constructor(
    readonly segundosParaLiberar: number,
    mensagem = 'Muitas solicitações. Aguarde um instante e tente novamente.',
  ) {
    super(CodigoErro.LIMITE_EXCEDIDO, mensagem);
  }
}

/** 502 — falha em serviço externo. Nunca deve bloquear o registro (RNF015). */
export class ErroDeIntegracao extends ErroDaAplicacao {
  readonly status = 502;

  constructor(
    readonly servico: string,
    mensagem = 'Serviço temporariamente indisponível. Seu registro foi salvo.',
  ) {
    super(CodigoErro.SERVICO_INDISPONIVEL, mensagem);
  }
}

/** 500 — qualquer exceção não prevista. */
export class ErroInterno extends ErroDaAplicacao {
  readonly status = 500;

  constructor(
    readonly referencia: string,
    readonly causaOriginal?: unknown,
  ) {
    super(
      CodigoErro.ERRO_INTERNO,
      'Não conseguimos concluir agora. Tente novamente em alguns instantes.',
    );
  }
}

export function ehErroDaAplicacao(valor: unknown): valor is ErroDaAplicacao {
  return valor instanceof ErroDaAplicacao;
}

/** Identificador curto exibido ao usuário na tela de erro e presente no log. */
export function gerarReferenciaDeErro(): string {
  const aleatorio = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `err_${Date.now().toString(36).toUpperCase()}${aleatorio}`;
}

/** Formato único de resposta de erro da API (doc 16). */
export interface RespostaDeErro {
  erro: {
    codigo: CodigoErro;
    mensagem: string;
    campos?: ErrosDeCampo;
    referencia?: string;
  };
}

export function paraRespostaDeErro(erro: ErroDaAplicacao): RespostaDeErro {
  return {
    erro: {
      codigo: erro.codigo,
      mensagem: erro.message,
      ...(erro.campos ? { campos: erro.campos } : {}),
      ...(erro instanceof ErroInterno ? { referencia: erro.referencia } : {}),
    },
  };
}
