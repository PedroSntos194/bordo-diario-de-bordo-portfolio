import { z } from 'zod';
import { esquemaPaginacao } from '@/lib/paginacao';

/** Contratos de entrada de rotas e pontos de parada (US012, US013 · RF011, RF012). */

export const TURNOS = ['MANHA', 'TARDE', 'NOITE', 'INTEGRAL'] as const;
export const STATUS_ROTA = ['ATIVA', 'INATIVA'] as const;

export const ROTULO_TURNO: Record<(typeof TURNOS)[number], string> = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
  INTEGRAL: 'Integral',
};

const camposDaRota = {
  codigo: z
    .string()
    .trim()
    .min(2, 'Informe o código da rota.')
    .max(20)
    .transform((valor) => valor.toUpperCase()),
  nome: z.string().trim().min(3, 'Informe o nome da rota.').max(120),
  origem: z.string().trim().min(3, 'Informe a origem.').max(160),
  destino: z.string().trim().min(3, 'Informe o destino.').max(160),
  turno: z.enum(TURNOS),
  distanciaEstimadaKm: z.coerce
    .number()
    .min(0, 'A distância não pode ser negativa.')
    .max(9999, 'Distância acima do plausível.')
    .optional(),
};

export const esquemaCriarRota = z.object(camposDaRota);
export type EntradaCriarRota = z.infer<typeof esquemaCriarRota>;

export const esquemaEditarRota = z.object({ id: z.string().uuid(), ...camposDaRota });
export type EntradaEditarRota = z.infer<typeof esquemaEditarRota>;

export const esquemaAlterarStatusRota = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUS_ROTA),
});

export type EntradaAlterarStatusRota = z.infer<typeof esquemaAlterarStatusRota>;

/**
 * Ponto de parada.
 *
 * Coordenadas são opcionais: uma rota pode ser cadastrada só com os nomes das
 * paradas e ganhar as coordenadas depois. Exigi-las de saída travaria a carga
 * inicial das ~30 rotas por causa de um dado que ninguém tem à mão.
 */
export const esquemaPontoDeParada = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do ponto.').max(120),
  endereco: z.string().trim().max(240).optional().or(z.literal('')),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
});

export type EntradaPontoDeParada = z.infer<typeof esquemaPontoDeParada>;

/**
 * A lista completa substitui a anterior, e a ordem é a posição no array.
 *
 * Enviar a lista inteira em vez de operações individuais (adicionar, remover,
 * reordenar) elimina a classe de bug em que a ordem no banco diverge da tela
 * depois de uma sequência de edições parcialmente aplicada.
 */
export const esquemaSalvarPontos = z.object({
  rotaId: z.string().uuid(),
  pontos: z.array(esquemaPontoDeParada).max(50, 'Máximo de 50 pontos por rota.'),
});

export type EntradaSalvarPontos = z.infer<typeof esquemaSalvarPontos>;

export const esquemaListarRotas = esquemaPaginacao.extend({
  busca: z.string().trim().max(120).optional(),
  turno: z.enum(TURNOS).optional(),
  status: z.enum(STATUS_ROTA).optional(),
  ordenar: z.enum(['codigo', 'nome']).default('codigo'),
  direcao: z.enum(['asc', 'desc']).default('asc'),
});

export type EntradaListarRotas = z.infer<typeof esquemaListarRotas>;
