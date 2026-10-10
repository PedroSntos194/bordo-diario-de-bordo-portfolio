import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { aplicarMensagensEmPortugues } from '@/lib/validacao';
import {
  esquemaAlterarStatus,
  esquemaCriarUsuario,
  esquemaEditarUsuario,
  esquemaListarUsuarios,
} from '@/modulos/usuario/usuario.schema';

beforeAll(() => aplicarMensagensEmPortugues());

function erros(resultado: z.SafeParseReturnType<unknown, unknown>): Record<string, string> {
  if (resultado.success) return {};
  const campos: Record<string, string> = {};
  for (const problema of resultado.error.issues) {
    campos[problema.path.join('.') || 'geral'] ??= problema.message;
  }
  return campos;
}

const VALIDO = {
  nome: 'João da Silva',
  cpf: '529.982.247-25',
  telefone: '(11) 99999-8888',
  perfil: 'MOTORISTA' as const,
};

describe('esquemaCriarUsuario (US004)', () => {
  it('normaliza CPF e telefone para o formato de armazenamento', () => {
    const resultado = esquemaCriarUsuario.safeParse(VALIDO);

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.cpf).toBe('52998224725');
      expect(resultado.data.telefone).toBe('+5511999998888');
    }
  });

  it('exige nome e sobrenome', () => {
    // Nome de uma palavra é quase sempre cadastro pela metade, e é ele que
    // identifica a pessoa no relatório do dia.
    const campos = erros(esquemaCriarUsuario.safeParse({ ...VALIDO, nome: 'João' }));
    expect(campos.nome).toBe('Informe nome e sobrenome.');
  });

  it('recusa CPF inválido', () => {
    const campos = erros(esquemaCriarUsuario.safeParse({ ...VALIDO, cpf: '111.111.111-11' }));
    expect(campos.cpf).toBe('CPF inválido. Confira os números digitados.');
  });

  it('recusa telefone incompleto', () => {
    const campos = erros(esquemaCriarUsuario.safeParse({ ...VALIDO, telefone: '9999' }));
    expect(campos.telefone).toContain('Telefone inválido');
  });

  it('recusa perfil fora das opções', () => {
    const campos = erros(esquemaCriarUsuario.safeParse({ ...VALIDO, perfil: 'SUPERVISOR' }));
    expect(campos.perfil).toBe('Selecione uma das opções disponíveis.');
  });

  it('aceita campos opcionais vazios', () => {
    const resultado = esquemaCriarUsuario.safeParse({
      ...VALIDO,
      matricula: '',
      email: '',
      cnhNumero: '',
      cnhValidade: '',
    });
    expect(resultado.success).toBe(true);
  });

  it('recusa e-mail malformado quando informado', () => {
    const campos = erros(esquemaCriarUsuario.safeParse({ ...VALIDO, email: 'joao@' }));
    expect(campos.email).toBe('E-mail inválido.');
  });

  it('recusa data de CNH fora do formato', () => {
    const campos = erros(esquemaCriarUsuario.safeParse({ ...VALIDO, cnhValidade: '10/05/2028' }));
    expect(campos.cnhValidade).toBe('Data inválida.');
  });

  it('remove espaços em volta do nome', () => {
    const resultado = esquemaCriarUsuario.safeParse({ ...VALIDO, nome: '  João da Silva  ' });
    if (resultado.success) expect(resultado.data.nome).toBe('João da Silva');
  });
});

describe('esquemaEditarUsuario (US005)', () => {
  const id = '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607';

  it('aceita edição sem CPF — quem tem histórico não pode alterá-lo', () => {
    const resultado = esquemaEditarUsuario.safeParse({
      id,
      nome: VALIDO.nome,
      telefone: VALIDO.telefone,
      perfil: VALIDO.perfil,
    });
    expect(resultado.success).toBe(true);
  });

  it('exige identificador válido', () => {
    const campos = erros(esquemaEditarUsuario.safeParse({ ...VALIDO, id: '123' }));
    expect(campos.id).toBe('Identificador inválido.');
  });
});

describe('esquemaAlterarStatus (US006)', () => {
  const id = '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607';

  it('aceita os quatro status do domínio', () => {
    for (const status of ['ATIVO', 'INATIVO', 'BLOQUEADO', 'EXCLUIDO']) {
      expect(esquemaAlterarStatus.safeParse({ id, status }).success).toBe(true);
    }
  });

  it('recusa status inventado', () => {
    expect(esquemaAlterarStatus.safeParse({ id, status: 'SUSPENSO' }).success).toBe(false);
  });
});

describe('esquemaListarUsuarios (US007)', () => {
  it('aplica ordenação e paginação padrão', () => {
    const resultado = esquemaListarUsuarios.safeParse({});

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data).toMatchObject({
        pagina: 1,
        tamanho: 20,
        ordenar: 'nome',
        direcao: 'asc',
      });
    }
  });

  it('recusa coluna de ordenação fora da lista permitida', () => {
    // Sem lista branca, `ordenar` viraria injeção no `orderBy` do Prisma.
    expect(esquemaListarUsuarios.safeParse({ ordenar: 'senhaHash' }).success).toBe(false);
  });
});
