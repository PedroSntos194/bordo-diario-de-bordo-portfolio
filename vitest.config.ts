import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Valores mínimos para que `lib/env.ts` valide durante os testes.
    // Nenhum deles toca um serviço real: os testes unitários são hermeticos.
    env: {
      NODE_ENV: 'test',
      APP_URL: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://teste:teste@localhost:5432/teste',
      SESSAO_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
      LOG_NIVEL: 'error',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/modulos/**/*.regras.ts', 'src/utilitarios/**/*.ts'],
      thresholds: {
        // Meta do doc 19: alta cobertura onde está o risco (regras puras),
        // sem meta global artificial.
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
