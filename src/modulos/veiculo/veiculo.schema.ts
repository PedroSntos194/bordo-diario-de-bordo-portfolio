import { z } from 'zod';
import { esquemaPaginacao } from '@/lib/paginacao';
import { normalizarPlaca, placaEhValida } from '@/utilitarios/placa';

/** Contratos de entrada do cadastro de veículos (US011 · RF010). ⚠️ V-03 */

export const STATUS_VEICULO = ['ATIVO', 'INATIVO', 'MANUTENCAO'] as const;

const anoAtual = new Date().getFullYear();

const campoPlaca = z
  .string()
  .min(1)
  .transform(normalizarPlaca)
  .refine(placaEhValida, 'Placa inválida. Use o formato ABC-1234 ou ABC1D23.');

const camposComuns = {
  modelo: z.string().trim().min(2, 'Informe o modelo.').max(60),
  marca: z.string().trim().max(60).optional().or(z.literal('')),
  ano: z.coerce
    .number()
    .int()
    .min(1980, 'Ano muito antigo.')
    // Fabricantes lançam o modelo do ano seguinte, então o teto é +1.
    .max(anoAtual + 1, 'Ano no futuro.')
    .optional(),
  capacidadePassageiros: z.coerce
    .number()
    .int()
    .min(1, 'Informe a capacidade.')
    .max(60, 'Capacidade acima do esperado para uma van.'),
  observacoes: z.string().trim().max(500).optional().or(z.literal('')),
};

export const esquemaCriarVeiculo = z.object({
  placa: campoPlaca,
  ...camposComuns,
  odometroAtual: z.coerce
    .number()
    .int()
    .min(0, 'O odômetro não pode ser negativo.')
    .max(9_999_999, 'Valor acima do plausível.'),
});

export type EntradaCriarVeiculo = z.infer<typeof esquemaCriarVeiculo>;

/**
 * O odômetro **não** é editável no cadastro.
 *
 * Ele é resultado da operação (RN020): quem o move é o encerramento da jornada.
 * Deixá-lo editável abriria um caminho para "acertar" a quilometragem por fora,
 * sem jornada e sem justificativa — justamente o que o sistema existe para
 * impedir. Correção de odômetro acontece corrigindo a jornada.
 */
export const esquemaEditarVeiculo = z.object({
  id: z.string().uuid(),
  placa: campoPlaca,
  ...camposComuns,
});

export type EntradaEditarVeiculo = z.infer<typeof esquemaEditarVeiculo>;

export const esquemaAlterarStatusVeiculo = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUS_VEICULO),
});

export type EntradaAlterarStatusVeiculo = z.infer<typeof esquemaAlterarStatusVeiculo>;

export const esquemaListarVeiculos = esquemaPaginacao.extend({
  busca: z.string().trim().max(120).optional(),
  status: z.enum(STATUS_VEICULO).optional(),
  ordenar: z.enum(['placa', 'modelo', 'odometroAtual']).default('placa'),
  direcao: z.enum(['asc', 'desc']).default('asc'),
});

export type EntradaListarVeiculos = z.infer<typeof esquemaListarVeiculos>;

// ------------------------------------------------------------ contrato (boletim de medição)

export const CATEGORIAS_DE_MEDICAO = ['ONIBUS', 'VAN_DIURNA', 'VAN_NOTURNA'] as const;

/** "20.100,00", "20100" ou vazio → número em reais ou nulo. */
function dinheiroOpcional(maximo: number) {
  return z.preprocess(
    (valor) => {
      if (valor === null || valor === undefined) return null;
      const texto = String(valor)
        .trim()
        .replace(/^R\$\s*/i, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.');
      return texto === '' ? null : Number(texto);
    },
    z
      .number({ invalid_type_error: 'Informe um valor, como 1.250,00.' })
      .min(0, 'O valor não pode ser negativo.')
      .max(maximo, 'Valor acima do plausível.')
      .nullable(),
  );
}

const textoOpcional = (maximo: number) =>
  z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
    z.string().trim().max(maximo, `Use até ${maximo} caracteres.`).nullable().default(null),
  );

/**
 * Contrato da van com o cliente, para o boletim de medição. Tudo opcional: o
 * fechamento mostra como pendência o que faltar, em vez de recusar o cadastro.
 */
export const esquemaContratoVeiculo = z.object({
  id: z.string().uuid(),
  cliente: textoOpcional(60),
  categoriaMedicao: z.preprocess(
    (valor) => (valor === '' ? null : valor),
    z.enum(CATEGORIAS_DE_MEDICAO).nullable().default(null),
  ),
  valorMensal: dinheiroOpcional(1_000_000),
  valorKmExcedido: dinheiroOpcional(1000),
  valorDiaExtra: dinheiroOpcional(100_000),
  limiteKmDia: z.preprocess(
    (valor) => (valor === '' || valor === null || valor === undefined ? null : valor),
    z.coerce
      .number()
      .int('Informe km inteiros.')
      .min(1, 'Informe pelo menos 1 km.')
      .max(2000, 'Valor acima do plausível.')
      .nullable(),
  ),
  linhaOrigem: textoOpcional(80),
  linhaDestino: textoOpcional(80),
});

export type EntradaContratoVeiculo = z.infer<typeof esquemaContratoVeiculo>;
