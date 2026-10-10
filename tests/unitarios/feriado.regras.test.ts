import { describe, expect, it } from 'vitest';
import {
  domingoDePascoa,
  feriadosNacionais,
  feriadosQueFaltam,
} from '@/modulos/feriado/feriado.regras';

/** Feriados nacionais sugeridos ao fechamento. */

describe('domingoDePascoa', () => {
  it('confere com o calendário', () => {
    expect(domingoDePascoa(2025)).toBe('2025-04-20');
    expect(domingoDePascoa(2026)).toBe('2026-04-05');
    expect(domingoDePascoa(2027)).toBe('2027-03-28');
  });
});

describe('feriadosNacionais', () => {
  const de2026 = feriadosNacionais(2026);

  it('traz os fixos em lei e a Sexta-feira Santa, em ordem', () => {
    expect(de2026).toHaveLength(10);
    expect(de2026[0]).toEqual({ data: '2026-01-01', nome: 'Confraternização Universal' });
    expect(de2026).toContainEqual({ data: '2026-04-03', nome: 'Sexta-feira Santa' });
    expect(de2026).toContainEqual({ data: '2026-10-12', nome: 'Nossa Senhora Aparecida' });
    expect(de2026).toContainEqual({
      data: '2026-11-20',
      nome: 'Dia Nacional de Zumbi e da Consciência Negra',
    });
    expect(de2026.map((f) => f.data)).toEqual([...de2026.map((f) => f.data)].sort());
  });

  it('não sugere ponto facultativo', () => {
    const nomes = de2026.map((f) => f.nome.toLowerCase()).join();
    expect(nomes).not.toContain('carnaval');
    expect(nomes).not.toContain('corpus');
  });
});

describe('feriadosQueFaltam', () => {
  it('não repete o que já está cadastrado', () => {
    const faltam = feriadosQueFaltam(
      feriadosNacionais(2026),
      new Set(['2026-01-01', '2026-12-25']),
    );
    expect(faltam).toHaveLength(8);
    expect(faltam.map((f) => f.data)).not.toContain('2026-01-01');
  });
});
