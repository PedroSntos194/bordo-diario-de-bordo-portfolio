import type { Prisma, TipoArquivo } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';

/**
 * Acesso a dados dos arquivos gerados (RF036 · RN030).
 *
 * `chaveArmazenamento` **nunca** entra nas projeções de leitura usadas pela
 * interface: ela só é lida no momento do download, por `buscarParaDownload`.
 * Manter os dois caminhos separados é o que impede o caminho no disco de vazar
 * por descuido em uma tela nova (doc 17).
 */

const CAMPOS_PUBLICOS = {
  id: true,
  tipo: true,
  nomeOriginal: true,
  mimeType: true,
  tamanhoBytes: true,
  parametros: true,
  expiraEm: true,
  criadoEm: true,
  autor: { select: { id: true, nome: true } },
} as const;

export interface NovoArquivo {
  tipo: TipoArquivo;
  nomeOriginal: string;
  chaveArmazenamento: string;
  mimeType: string;
  tamanhoBytes: number;
  hashSha256: string;
  parametros: Prisma.InputJsonValue;
  /** Nulo quando quem gerou foi o próprio sistema (rotina agendada). */
  geradoPor: string | null;
  expiraEm: Date | null;
}

export async function registrarArquivo(
  cliente: ClientePrisma,
  dados: NovoArquivo,
): Promise<{ id: string }> {
  return cliente.arquivo.create({
    data: {
      tipo: dados.tipo,
      nomeOriginal: dados.nomeOriginal,
      chaveArmazenamento: dados.chaveArmazenamento,
      mimeType: dados.mimeType,
      tamanhoBytes: BigInt(dados.tamanhoBytes),
      hashSha256: dados.hashSha256,
      parametros: dados.parametros,
      geradoPor: dados.geradoPor,
      expiraEm: dados.expiraEm,
    },
    select: { id: true },
  });
}

export interface FiltrosDeArquivo {
  tipo?: TipoArquivo;
  dataInicio?: Date;
  dataFim?: Date;
  skip: number;
  take: number;
}

export async function listarArquivos(cliente: ClientePrisma, filtros: FiltrosDeArquivo) {
  const where: Prisma.ArquivoWhereInput = {
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    ...(filtros.dataInicio || filtros.dataFim
      ? {
          criadoEm: {
            ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}),
            ...(filtros.dataFim ? { lte: filtros.dataFim } : {}),
          },
        }
      : {}),
  };

  const [linhas, total] = await Promise.all([
    cliente.arquivo.findMany({
      where,
      // A chave entra aqui e **sai** no serviço, convertida em um booleano.
      // Nenhuma tela recebe o caminho no disco (RN030 · doc 17).
      select: { ...CAMPOS_PUBLICOS, chaveArmazenamento: true },
      orderBy: { criadoEm: 'desc' },
      skip: filtros.skip,
      take: filtros.take,
    }),
    cliente.arquivo.count({ where }),
  ]);

  // `BigInt` não é serializável em JSON e quebraria a resposta da API e o
  // limite entre servidor e cliente do React. O tamanho de uma planilha cabe
  // com folga em `number`.
  return {
    arquivos: linhas.map((linha) => ({ ...linha, tamanhoBytes: Number(linha.tamanhoBytes) })),
    total,
  };
}

export type ArquivoDaListagem = Awaited<ReturnType<typeof listarArquivos>>['arquivos'][number];

/** Único ponto que lê a chave de armazenamento. Só o download a usa. */
export async function buscarParaDownload(cliente: ClientePrisma, id: string) {
  return cliente.arquivo.findUnique({
    where: { id },
    select: {
      id: true,
      tipo: true,
      nomeOriginal: true,
      chaveArmazenamento: true,
      mimeType: true,
      expiraEm: true,
      geradoPor: true,
    },
  });
}
