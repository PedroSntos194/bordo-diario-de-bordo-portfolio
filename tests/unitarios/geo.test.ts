import { describe, expect, it } from 'vitest';
import {
  chaveDeCacheGeografica,
  coordenadaEhValida,
  distanciaEmKm,
  formatarCoordenada,
  precisaoEhRuim,
} from '@/utilitarios/geo';

describe('coordenadaEhValida', () => {
  it('aceita coordenada real', () => {
    expect(coordenadaEhValida({ latitude: -23.5505, longitude: -46.6333 })).toBe(true);
  });

  it('recusa valores fora da faixa', () => {
    expect(coordenadaEhValida({ latitude: -91, longitude: 0 })).toBe(false);
    expect(coordenadaEhValida({ latitude: 0, longitude: 181 })).toBe(false);
  });

  it('recusa (0,0), que na prática é leitura falha', () => {
    expect(coordenadaEhValida({ latitude: 0, longitude: 0 })).toBe(false);
  });

  it('recusa valores não numéricos', () => {
    expect(coordenadaEhValida({ latitude: Number.NaN, longitude: -46 })).toBe(false);
  });
});

describe('precisaoEhRuim', () => {
  it('sinaliza acima de 100 metros', () => {
    expect(precisaoEhRuim(150)).toBe(true);
    expect(precisaoEhRuim(100)).toBe(false);
    expect(precisaoEhRuim(12.5)).toBe(false);
  });

  it('não sinaliza quando a precisão é desconhecida', () => {
    expect(precisaoEhRuim(null)).toBe(false);
    expect(precisaoEhRuim(undefined)).toBe(false);
  });
});

describe('distanciaEmKm', () => {
  it('é zero para o mesmo ponto', () => {
    const ponto = { latitude: -23.5505, longitude: -46.6333 };
    expect(distanciaEmKm(ponto, ponto)).toBe(0);
  });

  it('aproxima a distância entre São Paulo e Campinas (~80 km em linha reta)', () => {
    const distancia = distanciaEmKm(
      { latitude: -23.5505, longitude: -46.6333 },
      { latitude: -22.9099, longitude: -47.0626 },
    );
    expect(distancia).toBeGreaterThan(75);
    expect(distancia).toBeLessThan(90);
  });

  it('é simétrica', () => {
    const a = { latitude: -23.55, longitude: -46.63 };
    const b = { latitude: -22.91, longitude: -47.06 };
    expect(distanciaEmKm(a, b)).toBeCloseTo(distanciaEmKm(b, a), 6);
  });
});

describe('formatarCoordenada', () => {
  it('usa vírgula decimal', () => {
    expect(formatarCoordenada({ latitude: -23.5505, longitude: -46.6333 })).toBe(
      '-23,550500 / -46,633300',
    );
  });
});

describe('chaveDeCacheGeografica', () => {
  it('agrupa pontos próximos na mesma chave', () => {
    const chaveA = chaveDeCacheGeografica({ latitude: -23.55051, longitude: -46.63331 });
    const chaveB = chaveDeCacheGeografica({ latitude: -23.55053, longitude: -46.63334 });
    expect(chaveA).toBe(chaveB);
  });
});
