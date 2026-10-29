import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ambiente do armazenamento Blob', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('STORAGE_DRIVER', 'blob');
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', undefined);
    vi.stubEnv('BLOB_STORE_ID', undefined);
    vi.stubEnv('VERCEL_OIDC_TOKEN', undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('aceita token read-write fora da Vercel sem exigir OIDC', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'token-ficticio-somente-para-validacao');
    const { env } = await import('@/lib/env');
    expect(env.STORAGE_DRIVER).toBe('blob');
  });

  it('aceita o store conectado com OIDC gerenciado pelo SDK', async () => {
    vi.stubEnv('BLOB_STORE_ID', 'store_ficticio');
    vi.stubEnv('VERCEL_OIDC_TOKEN', 'oidc-ficticio-somente-para-validacao');
    const { env } = await import('@/lib/env');
    expect(env.STORAGE_DRIVER).toBe('blob');
  });

  it.each([{}, { BLOB_STORE_ID: 'store_ficticio' }, { VERCEL_OIDC_TOKEN: 'oidc-ficticio' }])(
    'recusa configuração sem credenciais completas: %j',
    async (variaveis) => {
      for (const [nome, valor] of Object.entries(variaveis)) vi.stubEnv(nome, valor);
      await expect(import('@/lib/env')).rejects.toThrow(
        'STORAGE_DRIVER=blob exige BLOB_STORE_ID com VERCEL_OIDC_TOKEN ou BLOB_READ_WRITE_TOKEN',
      );
    },
  );
});
