import { z } from 'zod';

/**
 * Mensagens de validação em português (RNF023).
 *
 * O Zod devolve mensagens em inglês por padrão — `Required`,
 * `String must contain at least 8 character(s)`. Essas mensagens **chegam à
 * tela do usuário**, ligadas ao campo que falhou. Traduzir campo a campo daria
 * certo até o primeiro esquema novo escrito sem lembrar disso; um mapa global
 * cobre inclusive o que ainda não foi escrito.
 *
 * Mensagens específicas declaradas no próprio esquema (`.min(1, 'Informe seu
 * CPF.')`) continuam tendo precedência sobre este mapa.
 *
 * Importado por `acao-segura.ts`, que é o ponto único por onde toda validação
 * do servidor passa.
 */
const mapaDeErros: z.ZodErrorMap = (problema, contexto) => {
  switch (problema.code) {
    case z.ZodIssueCode.invalid_type:
      if (problema.received === 'undefined' || problema.received === 'null') {
        return { message: 'Campo obrigatório.' };
      }
      if (problema.expected === 'number') return { message: 'Informe um número.' };
      if (problema.expected === 'date') return { message: 'Informe uma data válida.' };
      return { message: 'Valor inválido.' };

    case z.ZodIssueCode.too_small:
      if (problema.type === 'string') {
        return problema.minimum === 1
          ? { message: 'Campo obrigatório.' }
          : { message: `Informe ao menos ${problema.minimum} caracteres.` };
      }
      if (problema.type === 'number') {
        return { message: `O valor mínimo é ${problema.minimum}.` };
      }
      if (problema.type === 'array') {
        return { message: `Selecione ao menos ${problema.minimum} item(ns).` };
      }
      return { message: 'Valor abaixo do permitido.' };

    case z.ZodIssueCode.too_big:
      if (problema.type === 'string') {
        return { message: `Use no máximo ${problema.maximum} caracteres.` };
      }
      if (problema.type === 'number') {
        return { message: `O valor máximo é ${problema.maximum}.` };
      }
      return { message: 'Valor acima do permitido.' };

    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Selecione uma das opções disponíveis.' };

    case z.ZodIssueCode.invalid_string:
      if (problema.validation === 'email') return { message: 'E-mail inválido.' };
      if (problema.validation === 'uuid') return { message: 'Identificador inválido.' };
      if (problema.validation === 'url') return { message: 'Endereço inválido.' };
      return { message: 'Formato inválido.' };

    case z.ZodIssueCode.invalid_date:
      return { message: 'Data inválida.' };

    case z.ZodIssueCode.not_multiple_of:
      return { message: `O valor precisa ser múltiplo de ${problema.multipleOf}.` };

    default:
      return { message: contexto.defaultError };
  }
};

let aplicado = false;

/** Idempotente: pode ser chamada de vários pontos de entrada sem efeito duplicado. */
export function aplicarMensagensEmPortugues(): void {
  if (aplicado) return;
  z.setErrorMap(mapaDeErros);
  aplicado = true;
}
