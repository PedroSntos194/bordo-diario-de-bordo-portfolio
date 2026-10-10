import { describe, expect, it } from 'vitest';
import {
  DIAS_PADRAO,
  compararValores,
  formatarValorDaTrilha,
  rotularCampo,
  rotularEntidade,
} from '@/modulos/auditoria/auditoria.regras';

/** US040, US041 — leitura da trilha de auditoria. */

describe('compararValores', () => {
  it('junta os campos alterados na alteração', () => {
    const campos = compararValores({ odometroFinal: 100 }, { odometroFinal: 120 });

    expect(campos).toEqual([{ campo: 'odometroFinal', anterior: 100, novo: 120 }]);
  });

  it('cobre a criação, que só tem valor novo', () => {
    const campos = compararValores(null, { nome: 'Carlos' });

    expect(campos).toEqual([{ campo: 'nome', anterior: null, novo: 'Carlos' }]);
  });

  it('cobre a exclusão, que só tem valor anterior', () => {
    const campos = compararValores({ tipo: 'CHEGADA' }, null);

    expect(campos).toEqual([{ campo: 'tipo', anterior: 'CHEGADA', novo: null }]);
  });

  it('une chaves diferentes dos dois lados, em ordem estável', () => {
    const campos = compararValores({ b: 1 }, { a: 2 });

    expect(campos.map((c) => c.campo)).toEqual(['a', 'b']);
  });

  it('devolve lista vazia quando não há nada dos dois lados', () => {
    expect(compararValores(null, null)).toEqual([]);
  });
});

describe('formatarValorDaTrilha', () => {
  it('mostra ausência como travessão, não como vazio', () => {
    expect(formatarValorDaTrilha(null)).toBe('—');
    expect(formatarValorDaTrilha(undefined)).toBe('—');
  });

  it('traduz booleano para a linguagem de quem lê', () => {
    expect(formatarValorDaTrilha(true)).toBe('sim');
    expect(formatarValorDaTrilha(false)).toBe('não');
  });

  it('distingue lista vazia de ausência', () => {
    // "(vazio)" e "—" contam histórias diferentes: uma configuração que foi
    // esvaziada não é a mesma coisa que um campo que nunca existiu.
    expect(formatarValorDaTrilha([])).toBe('(vazio)');
    expect(formatarValorDaTrilha(['a', 'b'])).toBe('a, b');
  });

  it('não quebra com objeto', () => {
    expect(formatarValorDaTrilha({ x: 1 })).toBe('{"x":1}');
  });
});

describe('rótulos', () => {
  it('traduz campo técnico para linguagem de negócio', () => {
    expect(rotularCampo('odometroFinal')).toBe('Odômetro final');
    expect(rotularCampo('kmPercorrido')).toBe('Km percorrido');
  });

  it('devolve o próprio nome quando não há tradução', () => {
    expect(rotularCampo('campoNovoQualquer')).toBe('campoNovoQualquer');
    expect(rotularEntidade('coisa_nova')).toBe('coisa_nova');
  });

  it('traduz as entidades da trilha', () => {
    expect(rotularEntidade('corrida_evento')).toBe('Parada');
    expect(rotularEntidade('aceite_privacidade')).toBe('Aceite de privacidade');
  });
});

describe('período padrão', () => {
  it('são sete dias, como manda o critério da US040', () => {
    expect(DIAS_PADRAO).toBe(7);
  });
});
