import type { Prisma, StatusImportacao, TipoDestinoImportacao } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';

/** Acesso a dados da importação por planilha (US015 · RF035 · RN031, RN032). */

export interface NovaImportacao {
  arquivoId: string;
  tipoDestino: TipoDestinoImportacao;
  linhasTotal: number;
  linhasOk: number;
  linhasErro: number;
  resultado: Prisma.InputJsonValue;
  executadoPor: string;
}

export async function criarImportacao(
  cliente: ClientePrisma,
  dados: NovaImportacao,
): Promise<{ id: string }> {
  return cliente.importacao.create({
    // Nasce PROCESSANDO: a análise já aconteceu, mas nada foi gravado no
    // cadastro ainda. Só a confirmação do administrador a leva a CONCLUIDA.
    data: { ...dados, status: 'PROCESSANDO' },
    select: { id: true },
  });
}

/**
 * A importação com a chave do arquivo enviado.
 *
 * É o único ponto do módulo que lê `chaveArmazenamento`, e ela nunca sai daqui
 * em direção à tela (RN030 · doc 17) — a confirmação precisa reabrir o mesmo
 * arquivo para revalidar antes de gravar.
 */
export async function buscarParaConfirmar(cliente: ClientePrisma, id: string) {
  return cliente.importacao.findUnique({
    where: { id },
    select: {
      id: true,
      tipoDestino: true,
      status: true,
      linhasTotal: true,
      executadoPor: true,
      arquivo: {
        select: { id: true, nomeOriginal: true, chaveArmazenamento: true },
      },
    },
  });
}

export async function concluirImportacao(
  cliente: ClientePrisma,
  id: string,
  dados: {
    status: StatusImportacao;
    linhasOk: number;
    linhasErro: number;
    resultado: Prisma.InputJsonValue;
  },
): Promise<void> {
  await cliente.importacao.update({ where: { id }, data: dados });
}

const CAMPOS_DA_LISTAGEM = {
  id: true,
  tipoDestino: true,
  status: true,
  linhasTotal: true,
  linhasOk: true,
  linhasErro: true,
  criadoEm: true,
  arquivo: { select: { id: true, nomeOriginal: true } },
  autor: { select: { id: true, nome: true } },
} as const;

export async function listarImportacoes(
  cliente: ClientePrisma,
  filtros: { skip: number; take: number },
) {
  const [importacoes, total] = await Promise.all([
    cliente.importacao.findMany({
      select: CAMPOS_DA_LISTAGEM,
      orderBy: { criadoEm: 'desc' },
      skip: filtros.skip,
      take: filtros.take,
    }),
    cliente.importacao.count(),
  ]);

  return { importacoes, total };
}

export type ImportacaoDaListagem = Awaited<
  ReturnType<typeof listarImportacoes>
>['importacoes'][number];
