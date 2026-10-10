import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { baixar, comoResposta } = vi.hoisted(() => ({
  baixar: vi.fn(),
  comoResposta: vi.fn((resultado: unknown) => Response.json(resultado, { status: 401 })),
}));

vi.mock('@/modulos/arquivo/arquivo.servico', () => ({ baixar }));
vi.mock('@/lib/acao-segura', () => ({ comoResposta }));

import { GET } from '../../src/app/api/arquivos/[id]/download/route';

describe('download autenticado em fluxo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('entrega mais de 4,5 MB sem truncar bytes nem duplicar o buffer inteiro', async () => {
    const origem = Buffer.alloc(6 * 1024 * 1024 + 17);
    for (let indice = 0; indice < origem.length; indice += 1) origem[indice] = indice % 251;
    const conteudo = origem.subarray(9, origem.length - 8);
    baixar.mockResolvedValue({
      sucesso: true,
      dados: { nome: 'corridas"\\.xlsx', mimeType: 'application/xlsx', conteudo },
    });

    const resposta = await GET(new Request('http://localhost/api/arquivos/arquivo/download'), {
      params: Promise.resolve({ id: 'arquivo' }),
    });

    expect(baixar).toHaveBeenCalledWith({ id: 'arquivo' });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-length')).toBeNull();
    expect(resposta.headers.get('cache-control')).toBe('private, no-store');
    expect(resposta.headers.get('content-disposition')).toBe(
      'attachment; filename="corridas.xlsx"',
    );

    const leitor = resposta.body!.getReader();
    const hash = createHash('sha256');
    let bytes = 0;
    for (;;) {
      const parte = await leitor.read();
      if (parte.done) break;
      expect(parte.value.byteLength).toBeLessThanOrEqual(64 * 1024);
      bytes += parte.value.byteLength;
      hash.update(parte.value);
    }
    expect(bytes).toBe(conteudo.byteLength);
    expect(hash.digest('hex')).toBe(createHash('sha256').update(conteudo).digest('hex'));
  });

  it('preserva o erro de autorização e não inicia o download', async () => {
    const resultado = { sucesso: false, erro: { codigo: 'NAO_AUTENTICADO' } };
    baixar.mockResolvedValue(resultado);
    const resposta = await GET(new Request('http://localhost/api/arquivos/arquivo/download'), {
      params: Promise.resolve({ id: 'arquivo' }),
    });
    expect(comoResposta).toHaveBeenCalledWith(resultado);
    expect(resposta.status).toBe(401);
    expect(resposta.headers.get('content-disposition')).toBeNull();
  });
});
