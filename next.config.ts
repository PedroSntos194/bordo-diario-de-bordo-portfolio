import type { NextConfig } from 'next';

/**
 * Cabeçalhos de segurança fixos (doc 17 · RNF002, RNF003).
 *
 * A **Content Security Policy não está aqui**: ela precisa de um `nonce` novo a
 * cada requisição e é montada em `src/middleware.ts`. Declarar uma CSP estática
 * neste arquivo faria os dois cabeçalhos coexistirem, e o navegador aplica a
 * interseção dos dois — o que bloquearia os scripts do próprio Next.
 */

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Empacotamento mínimo para a imagem Docker (ver Dockerfile).
  output: 'standalone',
  serverExternalPackages: ['@node-rs/argon2'],
  experimental: {
    // Limite do corpo aceito por Server Actions (doc 17 · upload vai por rota própria).
    serverActions: { bodySizeLimit: '1mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(self), camera=(), microphone=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
