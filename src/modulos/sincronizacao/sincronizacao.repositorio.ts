import type { TipoOperacaoOffline } from '@prisma/client';
import type { ClientePrisma } from '@/lib/prisma';

/**
 * Livro-razão da sincronização (US025 · RN025).
 *
 * As colunas `client_uuid` de jornada, corrida e evento resolvem a
 * **referência**: o encerramento aponta para uma corrida que o servidor ainda
 * não conhecia. Esta tabela resolve a **repetição**, inclusive das operações
 * que só atualizam — e que, por não criarem linha nova, não têm onde carimbar
 * o identificador do aparelho.
 */

export interface OperacaoAplicada {
  clientUuid: string;
  usuarioId: string;
  tipo: TipoOperacaoOffline;
  ocorridoEm: Date;
  entidade: string;
  entidadeId: string | null;
}

/** Esta operação já foi aplicada antes? */
export async function buscarOperacao(cliente: ClientePrisma, clientUuid: string) {
  return cliente.operacaoSincronizada.findUnique({
    where: { clientUuid },
    select: { clientUuid: true, entidade: true, entidadeId: true, usuarioId: true },
  });
}

export async function registrarOperacao(
  cliente: ClientePrisma,
  dados: OperacaoAplicada,
): Promise<void> {
  // `upsert` e não `create`: duas abas do mesmo aparelho podem drenar a fila ao
  // mesmo tempo, e a segunda não deve derrubar o lote por colidir na chave.
  await cliente.operacaoSincronizada.upsert({
    where: { clientUuid: dados.clientUuid },
    update: {},
    create: dados,
  });
}

/**
 * Resolve o identificador do aparelho para o id da corrida no servidor.
 *
 * É o que permite encerrar, sem rede, uma corrida que também foi iniciada sem
 * rede: quando o encerramento chega, a corrida já subiu e ganhou id, mas o
 * aparelho só sabe o `clientUuid` que ele mesmo gerou.
 */
export async function corridaPorClientUuid(cliente: ClientePrisma, clientUuid: string) {
  return cliente.corrida.findUnique({
    where: { clientUuid },
    select: { id: true },
  });
}
