/**
 * CPF — o identificador de login do sistema (RN001, RN002).
 *
 * O armazenamento é sempre com 11 dígitos, sem máscara. A máscara existe apenas
 * na apresentação.
 */

/** Remove tudo que não for dígito. */
export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, '');
}

/**
 * Validação pelos dígitos verificadores.
 *
 * Sequências de dígitos repetidos (`00000000000`, `11111111111`…) passam no
 * cálculo aritmético, mas não são CPFs válidos — por isso a rejeição explícita.
 */
export function cpfEhValido(valor: string): boolean {
  const digitos = normalizarCpf(valor);

  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const calcular = (ate: number): number => {
    let soma = 0;
    for (let posicao = 0; posicao < ate; posicao += 1) {
      soma += Number(digitos[posicao]) * (ate + 1 - posicao);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcular(9) === Number(digitos[9]) && calcular(10) === Number(digitos[10]);
}

/** `12345678900` → `123.456.789-00`. Valor inválido volta como veio. */
export function formatarCpf(valor: string): string {
  const digitos = normalizarCpf(valor);
  if (digitos.length !== 11) return valor;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/**
 * `12345678900` → `***.456.789-**`
 *
 * Formato exibido em listagens (RN029). O detalhe completo só aparece para o
 * administrador, na tela do registro.
 */
export function mascararCpf(valor: string): string {
  const digitos = normalizarCpf(valor);
  if (digitos.length !== 11) return '***.***.***-**';
  return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
}

/** Aplica a máscara progressivamente enquanto o usuário digita. */
export function aplicarMascaraCpf(valor: string): string {
  const digitos = normalizarCpf(valor).slice(0, 11);

  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  }
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}
