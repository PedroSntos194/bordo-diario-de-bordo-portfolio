import { PrismaClient } from '@prisma/client';
import { emDesenvolvimento } from '@/lib/env';

/**
 * Instância única do Prisma Client.
 *
 * Em desenvolvimento o Next recarrega os módulos a cada alteração; sem o cache
 * global, cada recarga abriria um novo pool de conexões até esgotar o banco.
 *
 * Regra de projeto (doc 15): este é o único módulo que exporta o client.
 * Nenhum componente, action ou rota importa Prisma diretamente — o acesso a
 * dados fica restrito aos arquivos `*.repositorio.ts`.
 */
const globalParaPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalParaPrisma.prisma ??
  new PrismaClient({
    // Sem o nível `query`: o SQL registrado traria valores de parâmetro, e com
    // eles CPF e coordenadas iriam parar no log (doc 17).
    log: ['error', 'warn'],
  });

if (emDesenvolvimento) {
  globalParaPrisma.prisma = prisma;
}

/** Cliente dentro de uma transação, aceito pelos repositórios. */
export type ClientePrisma = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
