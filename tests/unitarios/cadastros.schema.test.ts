import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { aplicarMensagensEmPortugues } from '@/lib/validacao';
import { esquemaCriarVeiculo, esquemaEditarVeiculo } from '@/modulos/veiculo/veiculo.schema';
import {
  esquemaCriarRota,
  esquemaPontoDeParada,
  esquemaSalvarPontos,
} from '@/modulos/rota/rota.schema';
import { esquemaAbrirJornada } from '@/modulos/jornada/jornada.schema';

beforeAll(() => aplicarMensagensEmPortugues());

function erros(resultado: z.SafeParseReturnType<unknown, unknown>): Record<string, string> {
  if (resultado.success) return {};
  const campos: Record<string, string> = {};
  for (const problema of resultado.error.issues) {
    campos[problema.path.join('.') || 'geral'] ??= problema.message;
  }
  return campos;
}

describe('esquemaCriarVeiculo (US011)', () => {
  const VALIDO = {
    placa: 'ABC-1234',
    modelo: 'Sprinter 416',
    capacidadePassageiros: '16',
    odometroAtual: '84320',
  };

  it('normaliza a placa para o formato de armazenamento', () => {
    const resultado = esquemaCriarVeiculo.safeParse(VALIDO);

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.placa).toBe('ABC1234');
  });

  it('aceita placa Mercosul', () => {
    const resultado = esquemaCriarVeiculo.safeParse({ ...VALIDO, placa: 'abc1d23' });
    if (resultado.success) expect(resultado.data.placa).toBe('ABC1D23');
    expect(resultado.success).toBe(true);
  });

  it('recusa placa fora dos dois formatos', () => {
    const campos = erros(esquemaCriarVeiculo.safeParse({ ...VALIDO, placa: 'AB-123' }));
    expect(campos.placa).toContain('Placa inválida');
  });

  it('converte texto de formulário em número', () => {
    const resultado = esquemaCriarVeiculo.safeParse(VALIDO);
    if (resultado.success) {
      expect(resultado.data.capacidadePassageiros).toBe(16);
      expect(resultado.data.odometroAtual).toBe(84320);
    }
  });

  it('recusa odômetro negativo', () => {
    const campos = erros(esquemaCriarVeiculo.safeParse({ ...VALIDO, odometroAtual: '-1' }));
    expect(campos.odometroAtual).toBe('O odômetro não pode ser negativo.');
  });

  it('recusa capacidade zero', () => {
    const campos = erros(esquemaCriarVeiculo.safeParse({ ...VALIDO, capacidadePassageiros: '0' }));
    expect(campos.capacidadePassageiros).toBe('Informe a capacidade.');
  });

  it('recusa ano no futuro além do modelo seguinte', () => {
    const daquiADois = new Date().getFullYear() + 2;
    const campos = erros(esquemaCriarVeiculo.safeParse({ ...VALIDO, ano: String(daquiADois) }));
    expect(campos.ano).toBe('Ano no futuro.');
  });
});

describe('esquemaEditarVeiculo (RN020)', () => {
  it('não aceita odômetro — ele é resultado da operação, não do cadastro', () => {
    const resultado = esquemaEditarVeiculo.safeParse({
      id: '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607',
      placa: 'ABC1234',
      modelo: 'Sprinter',
      capacidadePassageiros: '16',
      odometroAtual: '1',
    });

    expect(resultado.success).toBe(true);
    // O campo é descartado silenciosamente: não existe caminho pelo formulário
    // para "acertar" a quilometragem sem jornada e sem justificativa.
    if (resultado.success) expect('odometroAtual' in resultado.data).toBe(false);
  });
});

describe('esquemaCriarRota (US012)', () => {
  const VALIDO = {
    codigo: 'r-014',
    nome: 'Centro → Fábrica',
    origem: 'Terminal Centro',
    destino: 'Planta Industrial',
    turno: 'MANHA',
  };

  it('padroniza o código em maiúsculas', () => {
    const resultado = esquemaCriarRota.safeParse(VALIDO);
    if (resultado.success) expect(resultado.data.codigo).toBe('R-014');
  });

  it('recusa turno fora das opções', () => {
    const campos = erros(esquemaCriarRota.safeParse({ ...VALIDO, turno: 'MADRUGADA' }));
    expect(campos.turno).toBe('Selecione uma das opções disponíveis.');
  });

  it('aceita distância decimal', () => {
    const resultado = esquemaCriarRota.safeParse({ ...VALIDO, distanciaEstimadaKm: '27.5' });
    if (resultado.success) expect(resultado.data.distanciaEstimadaKm).toBe(27.5);
  });
});

describe('esquemaPontoDeParada (US013)', () => {
  it('aceita ponto sem coordenada', () => {
    // Exigir coordenada travaria a carga inicial das rotas por um dado que
    // ninguém tem à mão no momento do cadastro.
    expect(esquemaPontoDeParada.safeParse({ nome: 'Terminal Centro' }).success).toBe(true);
  });

  it('recusa coordenada fora da faixa válida', () => {
    const campos = erros(
      esquemaPontoDeParada.safeParse({ nome: 'Ponto', latitude: '95', longitude: '0' }),
    );
    expect(campos.latitude).toBeDefined();
  });

  it('limita a quantidade de pontos por rota', () => {
    const muitos = Array.from({ length: 51 }, (_, indice) => ({ nome: `Ponto ${indice}` }));
    const campos = erros(
      esquemaSalvarPontos.safeParse({
        rotaId: '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607',
        pontos: muitos,
      }),
    );
    expect(campos.pontos).toBe('Máximo de 50 pontos por rota.');
  });

  it('aceita lista vazia — rota ponto a ponto é válida', () => {
    expect(
      esquemaSalvarPontos.safeParse({
        rotaId: '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607',
        pontos: [],
      }).success,
    ).toBe(true);
  });
});

describe('esquemaAbrirJornada (US016)', () => {
  const veiculoId = '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607';

  it('converte o odômetro digitado em número inteiro', () => {
    const resultado = esquemaAbrirJornada.safeParse({ veiculoId, odometroInicial: '84320' });

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.odometroInicial).toBe(84320);
  });

  it('recusa odômetro fracionário', () => {
    const campos = erros(esquemaAbrirJornada.safeParse({ veiculoId, odometroInicial: '84320.5' }));
    expect(campos.odometroInicial).toBe('Informe o odômetro em quilômetros inteiros.');
  });

  it('exige a seleção do veículo', () => {
    const campos = erros(esquemaAbrirJornada.safeParse({ odometroInicial: '1' }));
    expect(campos.veiculoId).toBe('Campo obrigatório.');
  });

  it('a confirmação de divergência começa falsa', () => {
    const resultado = esquemaAbrirJornada.safeParse({ veiculoId, odometroInicial: '1' });
    // Confirmar precisa ser ação explícita do motorista (RN015).
    if (resultado.success) expect(resultado.data.confirmaDivergencia).toBe(false);
  });

  it('aceita o identificador local da sincronização offline', () => {
    const resultado = esquemaAbrirJornada.safeParse({
      veiculoId,
      odometroInicial: '1',
      clientUuid: '8a7b6c5d-4e3f-4a2b-9c8d-7e6f5a4b3c2d',
    });
    expect(resultado.success).toBe(true);
  });
});
