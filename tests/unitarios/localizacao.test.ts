import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { capturarLocalizacao } from '@/modulos/localizacao/localizacao';

const POSICAO: GeolocationPosition = {
  coords: {
    latitude: -23.550512345,
    longitude: -46.633312345,
    accuracy: 12.345,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  },
  timestamp: Date.parse('2026-10-02T08:14:00.000Z'),
  toJSON: () => ({}),
};

function erroDePosicao(code: number): GeolocationPositionError {
  return {
    code,
    message: 'Localização indisponível',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>();

beforeEach(() => {
  vi.useFakeTimers();
  getCurrentPosition.mockReset();
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('captura pontual de localização (RN022)', () => {
  it('segue sem posição quando o aparelho não oferece a API', async () => {
    vi.stubGlobal('navigator', {});

    await expect(capturarLocalizacao()).resolves.toEqual({ situacao: 'INDISPONIVEL' });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('entrega a posição e libera o prazo ao receber resposta', async () => {
    getCurrentPosition.mockImplementation((sucesso) => sucesso(POSICAO));

    await expect(capturarLocalizacao()).resolves.toEqual({
      situacao: 'CAPTURADA',
      localizacao: {
        latitude: -23.5505123,
        longitude: -46.6333123,
        precisaoMetros: 12.35,
        capturadoEm: '2026-10-02T08:14:00.000Z',
      },
    });
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    [1, 'PERMISSAO_NEGADA'],
    [2, 'INDISPONIVEL'],
    [3, 'TEMPO_ESGOTADO'],
  ])('segue sem posição para o erro %s e libera o prazo', async (codigo, situacao) => {
    getCurrentPosition.mockImplementation((_sucesso, erro) => erro?.(erroDePosicao(codigo)));

    await expect(capturarLocalizacao()).resolves.toEqual({ situacao });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('limita a espera total a dez segundos mesmo sem resposta ao pedido de permissão', async () => {
    let concluida = false;
    const captura = capturarLocalizacao();
    void captura.then(() => {
      concluida = true;
    });

    await vi.advanceTimersByTimeAsync(9999);
    expect(concluida).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(captura).resolves.toEqual({ situacao: 'TEMPO_ESGOTADO' });
    expect(concluida).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserva o prazo de oito segundos e o cache de trinta segundos de paradas e ocorrências', async () => {
    const captura = capturarLocalizacao({ tempoLimiteMs: 8000, idadeMaximaMs: 30000 });

    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000,
    });
    await vi.advanceTimersByTimeAsync(8000);
    await expect(captura).resolves.toEqual({ situacao: 'TEMPO_ESGOTADO' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('segue sem posição se o navegador lançar uma exceção ao solicitar o GPS', async () => {
    getCurrentPosition.mockImplementation(() => {
      throw new Error('API de localização indisponível');
    });

    await expect(capturarLocalizacao()).resolves.toEqual({ situacao: 'INDISPONIVEL' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('segue sem posição quando o navegador entrega uma data inválida', async () => {
    getCurrentPosition.mockImplementation((sucesso) => sucesso({ ...POSICAO, timestamp: NaN }));

    await expect(capturarLocalizacao()).resolves.toEqual({ situacao: 'INDISPONIVEL' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignora callbacks tardios sem processar coordenadas nem interferir na captura seguinte', async () => {
    const primeira = capturarLocalizacao();
    const [sucessoTardio, erroTardio] = getCurrentPosition.mock.calls[0]!;

    await vi.advanceTimersByTimeAsync(5000);
    const segunda = capturarLocalizacao();
    const [sucessoAtual] = getCurrentPosition.mock.calls[1]!;

    await vi.advanceTimersByTimeAsync(5000);
    await expect(primeira).resolves.toEqual({ situacao: 'TEMPO_ESGOTADO' });
    expect(vi.getTimerCount()).toBe(1);

    const lerCoordenadas = vi.fn(() => POSICAO.coords);
    sucessoTardio({
      get coords() {
        return lerCoordenadas();
      },
      timestamp: POSICAO.timestamp,
      toJSON: () => ({}),
    });
    erroTardio?.(erroDePosicao(1));
    expect(lerCoordenadas).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    sucessoAtual(POSICAO);
    await expect(segunda).resolves.toMatchObject({ situacao: 'CAPTURADA' });
    await expect(primeira).resolves.toEqual({ situacao: 'TEMPO_ESGOTADO' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
