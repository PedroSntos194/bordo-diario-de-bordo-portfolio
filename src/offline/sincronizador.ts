import {
  ordenarOperacoes,
  podeSairDaFila,
  type OperacaoOffline,
  type ResultadoDaOperacao,
} from '@/modulos/sincronizacao/sincronizacao.regras';
import {
  contarTentativa,
  guardarRetrato,
  listarFila,
  marcarConflito,
  removerDaFila,
  type OperacaoNaFila,
} from '@/offline/fila-local';

/**
 * Drena a fila local contra `POST /api/sincronizacao` (US025 · RF022).
 *
 * Um módulo, uma responsabilidade: quem decide **o que** é conflito e **em que
 * ordem** as operações vão é `sincronizacao.regras.ts`, compartilhado com o
 * servidor. Aqui só há o transporte e o efeito sobre a fila.
 *
 * A drenagem é serializada por uma promessa em módulo. Duas abas do aplicativo
 * — ou o evento `online` disparando junto com o intervalo — mandariam o mesmo
 * lote duas vezes. Não criaria duplicidade (é para isso que existe a RN025),
 * mas gastaria a rede fraca do motorista em dobro.
 */

let emAndamento: Promise<ResumoDaDrenagem> | null = null;

export interface ResumoDaDrenagem {
  enviadas: number;
  conflitos: number;
  falhas: number;
  /** Nada a enviar, ou sem rede para tentar. */
  ociosa: boolean;
}

const OCIOSA: ResumoDaDrenagem = { enviadas: 0, conflitos: 0, falhas: 0, ociosa: true };

async function drenar(): Promise<ResumoDaDrenagem> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return OCIOSA;

  const fila = await listarFila();

  // Operação em conflito não volta sozinha para a fila de envio: ela espera uma
  // decisão do motorista na tela de pendências.
  const enviaveis = fila.filter((operacao) => !operacao.conflito);
  if (enviaveis.length === 0) return OCIOSA;

  const operacoes = ordenarOperacoes(enviaveis as OperacaoOffline[]).map((operacao) => ({
    clientUuid: operacao.clientUuid,
    tipo: operacao.tipo,
    ocorridoEm: operacao.ocorridoEm,
    dados: operacao.dados,
  }));

  let resposta: Response;
  try {
    resposta = await fetch('/api/sincronizacao', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operacoes }),
    });
  } catch {
    // Rede caiu no meio do envio. Nada é removido: o reenvio é idempotente
    // pelo `clientUuid` (RN025), então tentar de novo é seguro.
    return { enviadas: 0, conflitos: 0, falhas: operacoes.length, ociosa: false };
  }

  if (!resposta.ok) {
    for (const operacao of operacoes) await contarTentativa(operacao.clientUuid);
    return { enviadas: 0, conflitos: 0, falhas: operacoes.length, ociosa: false };
  }

  const corpo = (await resposta.json().catch(() => null)) as {
    resultados?: ResultadoDaOperacao[];
  } | null;

  const resultados = corpo?.resultados ?? [];
  let enviadas = 0;
  let conflitos = 0;
  let falhas = 0;

  for (const resultado of resultados) {
    if (podeSairDaFila(resultado.situacao)) {
      await removerDaFila(resultado.clientUuid);
      enviadas += 1;
      continue;
    }

    if (resultado.situacao === 'CONFLITO') {
      await marcarConflito(resultado.clientUuid, {
        codigo: resultado.codigo ?? 'CONFLITO',
        mensagem: resultado.mensagem ?? 'O servidor recusou este registro.',
      });
      conflitos += 1;
      continue;
    }

    await contarTentativa(resultado.clientUuid);
    falhas += 1;
  }

  return { enviadas, conflitos, falhas, ociosa: false };
}

/** Drena a fila, sem permitir duas drenagens simultâneas. */
export function sincronizarAgora(): Promise<ResumoDaDrenagem> {
  emAndamento ??= drenar().finally(() => {
    emAndamento = null;
  });

  return emAndamento;
}

/**
 * Busca o retrato do dia e o guarda no aparelho.
 *
 * Chamado sempre que há rede. Falhar aqui é silencioso de propósito: é
 * conveniência para o modo sem conexão, não registro operacional — e um erro
 * na tela por causa disso assustaria à toa.
 */
export async function atualizarRetrato(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  try {
    const resposta = await fetch('/api/offline/retrato', { cache: 'no-store' });
    if (!resposta.ok) return;
    await guardarRetrato(await resposta.json());
  } catch {
    /* sem rede: o retrato anterior continua valendo */
  }
}

/**
 * A fila como a tela precisa vê-la.
 *
 * Em ordem cronológica, e não na ordem em que o IndexedDB devolve — que é a
 * ordem da chave, isto é, aleatória. Uma lista de registros do dia fora de
 * ordem é ilegível justamente para quem precisa entender o que aconteceu:
 * "fim de corrida" antes de "início do dia" faz o motorista duvidar do
 * aparelho.
 */
export async function estadoDaFila(): Promise<{
  pendentes: OperacaoNaFila[];
  conflitos: OperacaoNaFila[];
}> {
  const fila = ordenarOperacoes(await listarFila()) as OperacaoNaFila[];

  return {
    pendentes: fila.filter((operacao) => !operacao.conflito),
    conflitos: fila.filter((operacao) => operacao.conflito),
  };
}
