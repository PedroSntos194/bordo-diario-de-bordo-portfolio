import { z } from 'zod';
import { TIPOS_DE_OPERACAO } from '@/modulos/sincronizacao/sincronizacao.regras';

/**
 * Contrato do lote de sincronização (US025 · RF022 · doc 16).
 *
 * `dados` fica deliberadamente aberto neste esquema: cada operação é validada
 * pelo **esquema do seu próprio caso de uso** — `esquemaAbrirJornada`,
 * `esquemaIniciarCorrida` e companhia — quando é delegada. Duplicar aqui a
 * validação de cinco entradas criaria uma segunda fonte da verdade que
 * divergiria da primeira na próxima mudança de regra (regra 4 do projeto).
 *
 * O que este esquema garante é o **envelope**: identificador válido, tipo
 * conhecido, instante legível e tamanho de lote com teto.
 */

export const esquemaOperacaoOffline = z.object({
  clientUuid: z.string().uuid('Identificador local inválido.'),
  tipo: z.enum(TIPOS_DE_OPERACAO, {
    errorMap: () => ({ message: 'Tipo de operação desconhecido.' }),
  }),
  ocorridoEm: z.string().datetime('Instante inválido.'),
  dados: z.record(z.string(), z.unknown()).default({}),
});

export type EntradaOperacaoOffline = z.infer<typeof esquemaOperacaoOffline>;

/**
 * Teto de operações por lote.
 *
 * Um dia inteiro sem sinal produz, no pior caso, algumas dezenas de registros:
 * abrir o dia, meia dúzia de corridas com paradas, encerrar. Duzentas cobrem
 * isso com folga e ainda impedem que um aparelho com a fila corrompida mande
 * dez mil operações numa requisição só.
 */
export const MAXIMO_DE_OPERACOES_POR_LOTE = 200;

export const esquemaSincronizar = z.object({
  operacoes: z
    .array(esquemaOperacaoOffline)
    .min(1, 'Nenhuma operação para sincronizar.')
    .max(
      MAXIMO_DE_OPERACOES_POR_LOTE,
      `Envie no máximo ${MAXIMO_DE_OPERACOES_POR_LOTE} operações por vez.`,
    ),
});

export type EntradaSincronizar = z.infer<typeof esquemaSincronizar>;
