import { z } from 'zod';

/**
 * Validação das variáveis de ambiente na inicialização (doc 17 · RNF005).
 *
 * Falhar aqui é intencional: é melhor a aplicação não subir do que rodar em
 * produção com um segredo indefinido ou uma URL de banco ausente.
 *
 * Uso exclusivo no servidor. Nunca importar de Client Component.
 */
const esquemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * Ambiente de execução — **não** é o mesmo que `NODE_ENV`.
   *
   * `next build` roda sempre com `NODE_ENV=production`, inclusive na máquina do
   * desenvolvedor e na integração contínua. Usar `NODE_ENV` para decidir o que
   * é produção faria as verificações estritas (segredo real, HTTPS) barrarem
   * todo build local. Quem sabe que está em produção é o ambiente, e ele diz
   * isso aqui explicitamente.
   */
  APP_AMBIENTE: z.enum(['local', 'homologacao', 'producao']).default('local'),

  APP_URL: z.string().url('APP_URL precisa ser uma URL completa'),
  TZ: z.string().default('America/Sao_Paulo'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  SESSAO_SECRET: z.string().min(32, 'SESSAO_SECRET precisa ter no mínimo 32 caracteres'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_PATH: z.string().default('./storage'),

  /**
   * Destino dos arquivos gerados quando `STORAGE_DRIVER=s3`.
   *
   * O `S3_ENDPOINT` é explícito, e não deduzido da região, porque o alvo não é
   * necessariamente a AWS: Cloudflare R2, Backblaze B2 e MinIO falam o mesmo
   * protocolo e é isso que mantém a escolha reversível.
   *
   * O balde é **privado**. O download continua passando pela rota autenticada
   * que confere permissão sobre o conteúdo (RN030) — o armazenamento é porão,
   * nunca vitrine.
   */
  S3_BUCKET: z.string().optional(),
  S3_REGIAO: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_CHAVE_ID: z.string().optional(),
  S3_CHAVE_SECRETA: z.string().optional(),

  WHATSAPP_CANAL: z.enum(['link', 'cloud']).default('link'),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_TEMPLATE_RESUMO: z.string().optional(),

  MAPA_TILES_URL: z.string().url().default('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
  GEOCODIFICACAO_URL: z.string().url().default('https://nominatim.openstreetmap.org/reverse'),

  LOG_NIVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  /**
   * Segredo que autoriza a chamada às rotinas agendadas (`/api/cron`).
   *
   * Em hospedagem sem servidor o agendador deixa de ser um processo e vira uma
   * URL — e uma URL que dispara o **expurgo** apaga dado em definitivo. Sem
   * este segredo a rota recusa tudo, inclusive em desenvolvimento: uma rotina
   * destrutiva alcançável por quem souber o caminho não é aceitável em nenhum
   * ambiente.
   *
   * Opcional aqui porque a instalação em contêiner não usa a rota — lá o
   * agendador continua sendo processo. A obrigatoriedade é verificada abaixo,
   * conforme o ambiente.
   */
  CRON_SECRET: z.string().min(24, 'CRON_SECRET precisa ter no mínimo 24 caracteres').optional(),

  /**
   * Commit publicado, preenchido pela Vercel. Vai abreviado na mensagem do
   * "Algo deu errado?" e no relato de erro do aparelho: é o que diz se o
   * motorista estava numa versão antiga, guardada pelo service worker.
   */
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
});

/**
 * O canal `cloud` do WhatsApp (V-05b) exige credenciais. Sem elas o envio
 * falharia silenciosamente em produção — melhor barrar na inicialização.
 */
const esquemaComRegras = esquemaEnv.superRefine((valores, ctx) => {
  if (valores.WHATSAPP_CANAL === 'cloud') {
    if (!valores.WHATSAPP_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WHATSAPP_TOKEN'],
        message: 'WHATSAPP_TOKEN é obrigatório quando WHATSAPP_CANAL=cloud',
      });
    }
    if (!valores.WHATSAPP_PHONE_NUMBER_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WHATSAPP_PHONE_NUMBER_ID'],
        message: 'WHATSAPP_PHONE_NUMBER_ID é obrigatório quando WHATSAPP_CANAL=cloud',
      });
    }
  }

  if (valores.APP_AMBIENTE === 'producao') {
    if (valores.SESSAO_SECRET.startsWith('troque-este-valor')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SESSAO_SECRET'],
        message: 'SESSAO_SECRET ainda é o valor de exemplo. Gere um segredo real.',
      });
    }
    if (!valores.APP_URL.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_URL'],
        message: 'Em produção a APP_URL precisa usar HTTPS (RNF002)',
      });
    }
  }

  // O driver `s3` precisa de destino e credencial. Sem isso a primeira
  // exportação falharia na hora de gravar — e falhar na subida é melhor.
  if (valores.STORAGE_DRIVER === 's3') {
    for (const campo of [
      'S3_BUCKET',
      'S3_REGIAO',
      'S3_ENDPOINT',
      'S3_CHAVE_ID',
      'S3_CHAVE_SECRETA',
    ] as const) {
      if (!valores[campo]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [campo],
          message: `${campo} é obrigatório quando STORAGE_DRIVER=s3`,
        });
      }
    }
  }
});

export type Env = z.infer<typeof esquemaEnv>;

function carregar(): Env {
  const resultado = esquemaComRegras.safeParse(process.env);

  if (!resultado.success) {
    const detalhes = resultado.error.issues
      .map((problema) => `  · ${problema.path.join('.')}: ${problema.message}`)
      .join('\n');

    throw new Error(
      `Configuração de ambiente inválida. Corrija o arquivo .env:\n${detalhes}\n` +
        'Consulte .env.example para a lista completa de variáveis.',
    );
  }

  return resultado.data;
}

export const env = carregar();

/** Rodando de fato em produção — ver a nota em `APP_AMBIENTE`. */
export const emProducao = env.APP_AMBIENTE === 'producao';

/** Máquina do desenvolvedor: cache de instâncias, log legível, cookie sem `Secure`. */
export const emDesenvolvimento = env.APP_AMBIENTE === 'local';

/**
 * `Secure` no cookie de sessão exige HTTPS. Em `localhost` o navegador
 * rejeitaria o cookie, então a flag acompanha o ambiente, não o `NODE_ENV`.
 */
export const usarCookieSeguro = env.APP_AMBIENTE !== 'local';
