import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Armazenamento de arquivos gerados (doc 13 · RN030).
 *
 * Duas decisões estruturais, ambas de segurança:
 *
 * 1. **Nada é servido por URL direta.** Os arquivos vivem fora de `public/`, e
 *    o download passa sempre por rota autenticada que verifica permissão sobre
 *    o *conteúdo* antes de devolver o binário. A `chaveArmazenamento` nunca
 *    chega ao navegador — é por isso que ela está na lista de campos sensíveis
 *    da auditoria.
 *
 * 2. **A chave é gerada aqui, nunca recebida.** Nome de arquivo vindo de fora é
 *    o caminho clássico para travessia de diretório. O nome que o usuário vê
 *    (`nomeOriginal`) é só um rótulo no banco; o que existe no disco é um uuid.
 *
 * A interface tem duas implementações previstas — sistema de arquivos local
 * (padrão) e S3/MinIO, quando houver mais de uma instância. Trocar uma pela
 * outra não afeta nenhum caso de uso.
 */

export interface ArquivoArmazenado {
  chave: string;
  tamanhoBytes: number;
  hashSha256: string;
}

export interface Armazenamento {
  gravar(chave: string, conteudo: Buffer): Promise<ArquivoArmazenado>;
  ler(chave: string): Promise<Buffer | null>;
  /**
   * O binário ainda existe? Consulta barata, sem carregar o conteúdo.
   *
   * Serve à listagem (US034): mostrar "Baixar" para um arquivo que sumiu do
   * disco entrega um link que só falha depois do clique. Uma listagem de vinte
   * linhas custa vinte `stat`; carregar vinte planilhas para descobrir o mesmo
   * custaria memória à toa.
   */
  existe(chave: string): Promise<boolean>;
  remover(chave: string): Promise<void>;
}

/**
 * Monta a chave de armazenamento: `<tipo>/<ano>/<mes>/<uuid>.<extensao>`.
 *
 * O particionamento por ano e mês não é enfeite: com um consolidado por dia e
 * as exportações manuais, um diretório único passaria de dez mil entradas em
 * poucos anos, e listar diretório grande é lento em qualquer sistema de
 * arquivos.
 */
export function montarChave(tipo: string, extensao: string, agora: Date = new Date()): string {
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, '0');
  return `${tipo.toLowerCase()}/${ano}/${mes}/${crypto.randomUUID()}.${extensao}`;
}

/**
 * Resolve a chave para um caminho absoluto **dentro** da raiz configurada.
 *
 * A verificação existe mesmo com a chave sendo gerada internamente: ela volta
 * do banco antes de ser usada, e um dia alguém pode gravar lá outra coisa. O
 * custo é uma comparação de prefixo; o custo de não ter é ler `/etc/passwd`.
 */
function caminhoSeguro(raiz: string, chave: string): string {
  const raizAbsoluta = resolve(raiz);
  const alvo = resolve(join(raizAbsoluta, normalize(chave)));

  if (alvo !== raizAbsoluta && !alvo.startsWith(raizAbsoluta + sep)) {
    throw new Error('Chave de armazenamento fora da raiz permitida.');
  }

  return alvo;
}

class ArmazenamentoLocal implements Armazenamento {
  constructor(private readonly raiz: string) {}

  async gravar(chave: string, conteudo: Buffer): Promise<ArquivoArmazenado> {
    const caminho = caminhoSeguro(this.raiz, chave);
    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, conteudo);

    return {
      chave,
      tamanhoBytes: conteudo.byteLength,
      hashSha256: createHash('sha256').update(conteudo).digest('hex'),
    };
  }

  async ler(chave: string): Promise<Buffer | null> {
    try {
      return await readFile(caminhoSeguro(this.raiz, chave));
    } catch (erro) {
      // Arquivo removido do disco com o registro ainda no banco é um estado
      // possível (limpeza manual, restauração parcial). Quem chama traduz isso
      // em 410, não em 500 — ver `arquivo.servico.ts`.
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw erro;
    }
  }

  async existe(chave: string): Promise<boolean> {
    try {
      await stat(caminhoSeguro(this.raiz, chave));
      return true;
    } catch {
      return false;
    }
  }

  async remover(chave: string): Promise<void> {
    try {
      await unlink(caminhoSeguro(this.raiz, chave));
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') throw erro;
    }
  }
}

/**
 * Armazenamento compatível com S3 — AWS, Cloudflare R2, Backblaze B2, MinIO.
 *
 * Existe porque hospedagem sem servidor **não tem disco que sobreviva** entre
 * duas invocações (doc 27). O `ArmazenamentoLocal` continua sendo o caminho do
 * contêiner; este é o da nuvem.
 *
 * ## O balde é privado
 *
 * Nenhum objeto é servido por URL direta, e nenhuma URL assinada é gerada. O
 * download continua passando pela rota autenticada que confere permissão sobre
 * o **conteúdo** antes de devolver o binário (RN030) — o mesmo desenho de
 * sempre. Trocar isso por "URL pública com nome difícil de adivinhar" seria
 * trocar autenticação por obscuridade, sobre planilha que tem CPF e trajeto de
 * empregado.
 *
 * ## `forcePathStyle`
 *
 * Ligado porque o alvo não é necessariamente a AWS. MinIO e a maioria dos
 * compatíveis endereçam o balde pelo **caminho** (`endpoint/balde/chave`), não
 * pelo subdomínio (`balde.endpoint/chave`). A AWS aceita os dois.
 */
class ArmazenamentoS3 implements Armazenamento {
  private readonly cliente: S3Client;

  constructor(
    private readonly balde: string,
    regiao: string,
    endpoint: string,
    chaveId: string,
    chaveSecreta: string,
  ) {
    this.cliente = new S3Client({
      region: regiao,
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: chaveId, secretAccessKey: chaveSecreta },
    });
  }

  async gravar(chave: string, conteudo: Buffer): Promise<ArquivoArmazenado> {
    // O hash é calculado aqui, sobre os mesmos bytes que sobem. Usar o ETag do
    // S3 seria tentador e errado: ele é MD5 para envio simples, mas vira outra
    // coisa em envio multiparte — e o registro precisa de um SHA-256 estável.
    const hashSha256 = createHash('sha256').update(conteudo).digest('hex');

    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.balde,
        Key: chave,
        Body: conteudo,
        ContentLength: conteudo.byteLength,
      }),
    );

    return { chave, tamanhoBytes: conteudo.byteLength, hashSha256 };
  }

  async ler(chave: string): Promise<Buffer | null> {
    try {
      const resposta = await this.cliente.send(
        new GetObjectCommand({ Bucket: this.balde, Key: chave }),
      );

      if (!resposta.Body) return null;

      const bytes = await resposta.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (erro) {
      // Objeto removido com o registro ainda no banco é estado possível
      // (limpeza manual, restauração parcial). Quem chama traduz em 410, não
      // em 500 — mesma decisão do armazenamento local.
      if (this.ehNaoEncontrado(erro)) return null;
      throw erro;
    }
  }

  async existe(chave: string): Promise<boolean> {
    try {
      await this.cliente.send(new HeadObjectCommand({ Bucket: this.balde, Key: chave }));
      return true;
    } catch (erro) {
      if (this.ehNaoEncontrado(erro)) return false;
      throw erro;
    }
  }

  async remover(chave: string): Promise<void> {
    // O S3 não reclama de apagar o que não existe, mas um compatível pode.
    try {
      await this.cliente.send(new DeleteObjectCommand({ Bucket: this.balde, Key: chave }));
    } catch (erro) {
      if (!this.ehNaoEncontrado(erro)) throw erro;
    }
  }

  /**
   * "Não encontrado" chega de três formas conforme o provedor: `NoSuchKey` no
   * corpo, `NotFound` no nome do erro, ou só o 404 nos metadados da resposta —
   * o `HeadObject` não tem corpo para carregar o código.
   */
  private ehNaoEncontrado(erro: unknown): boolean {
    if (erro instanceof NoSuchKey || erro instanceof NotFound) return true;

    const candidato = erro as {
      name?: string;
      Code?: string;
      $metadata?: { httpStatusCode?: number };
    };

    return (
      candidato?.name === 'NoSuchKey' ||
      candidato?.name === 'NotFound' ||
      candidato?.Code === 'NoSuchKey' ||
      candidato?.$metadata?.httpStatusCode === 404
    );
  }
}

function criar(): Armazenamento {
  if (env.STORAGE_DRIVER === 's3') {
    // As cinco variáveis são exigidas na validação do ambiente (`env.ts`), que
    // falha na subida se faltar alguma. As asserções aqui são só para o tipo.
    logger.debug('armazenamento.s3', { balde: env.S3_BUCKET, endpoint: env.S3_ENDPOINT });

    return new ArmazenamentoS3(
      env.S3_BUCKET!,
      env.S3_REGIAO!,
      env.S3_ENDPOINT!,
      env.S3_CHAVE_ID!,
      env.S3_CHAVE_SECRETA!,
    );
  }

  logger.debug('armazenamento.local', { raiz: resolve(env.STORAGE_PATH) });
  return new ArmazenamentoLocal(env.STORAGE_PATH);
}

export const armazenamento: Armazenamento = criar();
