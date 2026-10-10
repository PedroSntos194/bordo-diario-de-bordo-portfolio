import type {
  OperacaoOffline,
  RetratoDoDia,
  TipoDeOperacao,
} from '@/modulos/sincronizacao/sincronizacao.regras';

/**
 * Fila de operações e retrato do dia, no próprio aparelho (US025 · RF022).
 *
 * **IndexedDB, e não `localStorage`.** O critério é explícito: "registros
 * pendentes sobrevivem ao fechamento do aplicativo e à reinicialização do
 * aparelho". Os dois guardam dado depois de fechar, mas `localStorage` é
 * síncrono — trava a interface — e tem um teto de poucos megabytes que um dia
 * inteiro de coordenadas alcança. IndexedDB é assíncrono e é o que o navegador
 * oferece para isto.
 *
 * Este arquivo é a **única** parte do sistema que conhece IndexedDB. Quem usa a
 * fila enxerga funções que devolvem promessas de objetos; trocar o
 * armazenamento não afeta nenhuma tela — a mesma disciplina de
 * `armazenamento.ts` no servidor.
 */

const BANCO = 'bordo-offline';
const VERSAO = 1;
const DEPOSITO_FILA = 'operacoes';
const DEPOSITO_RETRATO = 'retrato';

export interface OperacaoNaFila extends OperacaoOffline {
  /** Quantas vezes o envio já foi tentado — só para diagnóstico na tela. */
  tentativas: number;
  /**
   * Recusa do servidor que exige decisão do motorista.
   *
   * Enquanto estiver preenchido, a operação **fica** na fila e **não** é
   * reenviada automaticamente: o critério de aceitação proíbe descartar
   * conflito em silêncio, e repetir sozinho só produziria a mesma recusa.
   */
  conflito: { codigo: string; mensagem: string } | null;
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(BANCO, VERSAO);

    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      if (!banco.objectStoreNames.contains(DEPOSITO_FILA)) {
        banco.createObjectStore(DEPOSITO_FILA, { keyPath: 'clientUuid' });
      }
      if (!banco.objectStoreNames.contains(DEPOSITO_RETRATO)) {
        banco.createObjectStore(DEPOSITO_RETRATO);
      }
    };

    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error ?? new Error('IndexedDB indisponível.'));
  });
}

function executar<T>(
  deposito: string,
  modo: IDBTransactionMode,
  acao: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrirBanco().then(
    (banco) =>
      new Promise<T>((resolver, rejeitar) => {
        const transacao = banco.transaction(deposito, modo);
        const pedido = acao(transacao.objectStore(deposito));

        pedido.onsuccess = () => resolver(pedido.result);
        pedido.onerror = () => rejeitar(pedido.error ?? new Error('Falha no armazenamento local.'));
        transacao.oncomplete = () => banco.close();
      }),
  );
}

/**
 * O navegador tem IndexedDB utilizável?
 *
 * Em janela anônima de alguns navegadores a API existe e falha ao abrir. Quem
 * chama precisa saber disso **antes** de prometer ao motorista que o registro
 * ficou guardado — prometer e perder é pior do que avisar que não dá.
 */
export function armazenamentoLocalDisponivel(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function listarFila(): Promise<OperacaoNaFila[]> {
  if (!armazenamentoLocalDisponivel()) return [];

  try {
    const operacoes = await executar<OperacaoNaFila[]>(DEPOSITO_FILA, 'readonly', (loja) =>
      loja.getAll(),
    );
    return operacoes;
  } catch {
    return [];
  }
}

export async function enfileirar(operacao: {
  clientUuid: string;
  tipo: TipoDeOperacao;
  ocorridoEm: string;
  dados: Record<string, unknown>;
}): Promise<void> {
  await executar(DEPOSITO_FILA, 'readwrite', (loja) =>
    loja.put({ ...operacao, tentativas: 0, conflito: null } satisfies OperacaoNaFila),
  );
}

export async function removerDaFila(clientUuid: string): Promise<void> {
  await executar(DEPOSITO_FILA, 'readwrite', (loja) => loja.delete(clientUuid));
}

export async function marcarConflito(
  clientUuid: string,
  conflito: { codigo: string; mensagem: string },
): Promise<void> {
  const atual = await executar<OperacaoNaFila | undefined>(DEPOSITO_FILA, 'readonly', (loja) =>
    loja.get(clientUuid),
  );
  if (!atual) return;

  await executar(DEPOSITO_FILA, 'readwrite', (loja) =>
    loja.put({ ...atual, conflito, tentativas: atual.tentativas + 1 }),
  );
}

export async function contarTentativa(clientUuid: string): Promise<void> {
  const atual = await executar<OperacaoNaFila | undefined>(DEPOSITO_FILA, 'readonly', (loja) =>
    loja.get(clientUuid),
  );
  if (!atual) return;

  await executar(DEPOSITO_FILA, 'readwrite', (loja) =>
    loja.put({ ...atual, tentativas: atual.tentativas + 1 }),
  );
}

// ------------------------------------------------------------- retrato

export async function guardarRetrato(retrato: RetratoDoDia): Promise<void> {
  if (!armazenamentoLocalDisponivel()) return;

  try {
    await executar(DEPOSITO_RETRATO, 'readwrite', (loja) => loja.put(retrato, 'atual'));
  } catch {
    // Guardar o retrato é conveniência: sem ele o modo sem conexão fica mais
    // pobre, mas nada do que o motorista registrou se perde.
  }
}

export async function lerRetrato(): Promise<RetratoDoDia | null> {
  if (!armazenamentoLocalDisponivel()) return null;

  try {
    const retrato = await executar<RetratoDoDia | undefined>(DEPOSITO_RETRATO, 'readonly', (loja) =>
      loja.get('atual'),
    );
    return retrato ?? null;
  } catch {
    return null;
  }
}
