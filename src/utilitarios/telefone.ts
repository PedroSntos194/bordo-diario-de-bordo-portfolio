/**
 * Telefone celular brasileiro.
 *
 * É por ele que o resumo do dia chega ao administrador pelo WhatsApp (RF025),
 * então o número precisa estar em formato discável — não basta "parecer" um
 * telefone. O armazenamento é sempre em **E.164** (`+5511999999999`), que é o
 * formato exigido pela API do WhatsApp; a máscara existe só na tela.
 */

const DDI_BRASIL = '55';

/** Remove tudo que não for dígito e descarta o `+`. */
function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/**
 * Converte para E.164, assumindo Brasil quando o DDI não vier.
 *
 * Devolve `null` quando não há número reconhecível — nunca uma string
 * parcialmente montada, que passaria na gravação e falharia no envio.
 */
export function normalizarTelefone(valor: string): string | null {
  let digitos = apenasDigitos(valor);

  // Remove o zero que muita gente digita por hábito antes do DDD ("011 9…").
  // A condição é o comprimento resultante, não "maior que 11": assim o zero só
  // some quando o que sobra é de fato um telefone completo.
  if (digitos.startsWith('0') && (digitos.length === 11 || digitos.length === 12)) {
    digitos = digitos.slice(1);
  }

  if (digitos.startsWith(DDI_BRASIL) && digitos.length > 11) {
    digitos = digitos.slice(DDI_BRASIL.length);
  }

  if (!nacionalEhValido(digitos)) return null;

  return `+${DDI_BRASIL}${digitos}`;
}

/** Valida a parte nacional: DDD + número, sem DDI. */
function nacionalEhValido(digitos: string): boolean {
  if (digitos.length !== 10 && digitos.length !== 11) return false;

  const ddd = Number(digitos.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  // Celular tem 9 dígitos e começa com 9; fixo tem 8 e começa de 2 a 5.
  const numero = digitos.slice(2);
  if (numero.length === 9) return numero.startsWith('9');
  return /^[2-5]/.test(numero);
}

export function telefoneEhValido(valor: string): boolean {
  return normalizarTelefone(valor) !== null;
}

/** `+5511999998888` → `(11) 99999-8888` */
export function formatarTelefone(valor: string): string {
  const normalizado = normalizarTelefone(valor);
  if (!normalizado) return valor;

  const nacional = normalizado.slice(3);
  const ddd = nacional.slice(0, 2);
  const numero = nacional.slice(2);

  if (numero.length === 9) {
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  }
  return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
}

/** Aplica a máscara progressivamente enquanto o usuário digita. */
export function aplicarMascaraTelefone(valor: string): string {
  const digitos = apenasDigitos(valor).slice(0, 11);

  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);

  if (numero.length <= 4) return `(${ddd}) ${numero}`;
  if (numero.length <= 8) return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
}
