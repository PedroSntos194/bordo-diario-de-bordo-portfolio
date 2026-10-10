import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    // `dist/` é o bundle do agendador, gerado por esbuild: código de terceiros
    // concatenado, que não se analisa nem se corrige.
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'tmp/**',
      'output/**',
      'storage/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      // Regra de projeto (doc 15): nada de `any` silencioso na camada de domínio.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Doc 17: `dangerouslySetInnerHTML` é proibido no projeto (XSS).
      'react/no-danger': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // O logger é o único lugar autorizado a escrever no console.
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['prisma/*.ts', 'scripts/**/*.ts', 'tests/ponta-a-ponta/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
];

export default config;
