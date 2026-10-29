import { createHash } from 'node:crypto';
import { BlobNotFoundError } from '@vercel/blob';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { armazenamento } from '@/lib/armazenamento';

const sdk = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  head: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@vercel/blob', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vercel/blob')>()),
  ...sdk,
}));
vi.mock('@/lib/env', () => ({ env: { STORAGE_DRIVER: 'blob' } }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn() } }));

const chave = 'exportacao/2026/10/arquivo-uuid.xlsx';

describe('armazenamento Blob privado', () => {
  beforeEach(() => vi.resetAllMocks());

  it('grava bytes privados com chave estável e hash calculado sobre o conteúdo', async () => {
    const conteudo = Buffer.from([0, 255, 10, 42]);
    sdk.put.mockResolvedValue({ url: 'https://ignorada.private.blob.vercel-storage.com/arquivo' });

    await expect(armazenamento.gravar(chave, conteudo)).resolves.toEqual({
      chave,
      tamanhoBytes: conteudo.byteLength,
      hashSha256: createHash('sha256').update(conteudo).digest('hex'),
    });
    expect(sdk.put).toHaveBeenCalledWith(chave, conteudo, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  });

  it('lê o binário privado atual sem devolver URL ou metadados do store', async () => {
    const conteudo = new Uint8Array([0, 255, 10, 42]);
    sdk.get.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream({
        start(controlador) {
          controlador.enqueue(conteudo);
          controlador.close();
        },
      }),
    });

    await expect(armazenamento.ler(chave)).resolves.toEqual(Buffer.from(conteudo));
    expect(sdk.get).toHaveBeenCalledWith(chave, { access: 'private', useCache: false });
  });

  it('traduz arquivo ausente em null e preserva falhas de leitura', async () => {
    sdk.get.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('falha de autenticação'));
    await expect(armazenamento.ler(chave)).resolves.toBeNull();
    await expect(armazenamento.ler(chave)).rejects.toThrow('falha de autenticação');
  });

  it('consulta apenas metadados e distingue ausência de indisponibilidade do serviço', async () => {
    sdk.head
      .mockResolvedValueOnce({ size: 10 })
      .mockRejectedValueOnce(new BlobNotFoundError())
      .mockRejectedValueOnce(new Error('serviço indisponível'));

    await expect(armazenamento.existe(chave)).resolves.toBe(true);
    await expect(armazenamento.existe(chave)).resolves.toBe(false);
    await expect(armazenamento.existe(chave)).rejects.toThrow('serviço indisponível');
    expect(sdk.get).not.toHaveBeenCalled();
  });

  it('remove pela chave e preserva falhas do serviço', async () => {
    sdk.del.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('sem permissão'));
    await expect(armazenamento.remover(chave)).resolves.toBeUndefined();
    await expect(armazenamento.remover(chave)).rejects.toThrow('sem permissão');
    expect(sdk.del).toHaveBeenCalledWith(chave);
  });

  it.each([
    'https://outro.private.blob.vercel-storage.com/a',
    '../segredo',
    '/absoluto',
    'a\\b',
    'a//b',
  ])('recusa a chave %s antes de chamar o SDK', async (invalida) => {
    await expect(armazenamento.gravar(invalida, Buffer.from('teste'))).rejects.toThrow(
      'Chave de armazenamento Blob inválida.',
    );
    await expect(armazenamento.ler(invalida)).rejects.toThrow();
    await expect(armazenamento.existe(invalida)).rejects.toThrow();
    await expect(armazenamento.remover(invalida)).rejects.toThrow();
    for (const chamada of Object.values(sdk)) expect(chamada).not.toHaveBeenCalled();
  });
});
