import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { aplicarMensagensEmPortugues } from '@/lib/validacao';
import { esquemaLogin, esquemaTrocaDeSenha } from '@/modulos/autenticacao/autenticacao.schema';

beforeAll(() => aplicarMensagensEmPortugues());

/** Extrai a primeira mensagem por campo, como faz `acao-segura.ts`. */
function erros(resultado: z.SafeParseReturnType<unknown, unknown>): Record<string, string> {
  if (resultado.success) return {};
  const campos: Record<string, string> = {};
  for (const problema of resultado.error.issues) {
    const caminho = problema.path.join('.') || 'geral';
    campos[caminho] ??= problema.message;
  }
  return campos;
}

describe('mensagens de validação em português (RNF023)', () => {
  it('campo ausente não devolve "Required"', () => {
    const campos = erros(esquemaLogin.safeParse({}));

    expect(campos.cpf).toBe('Campo obrigatório.');
    expect(campos.senha).toBe('Campo obrigatório.');
  });

  it('tipo errado não vaza mensagem técnica', () => {
    const campos = erros(esquemaLogin.safeParse({ cpf: 123, senha: true }));

    expect(campos.cpf).toBe('Valor inválido.');
    expect(campos.senha).toBe('Valor inválido.');
  });

  it('a mensagem do próprio esquema tem precedência sobre o mapa global', () => {
    const campos = erros(esquemaTrocaDeSenha.safeParse({ novaSenha: 'abc', confirmacao: 'abc' }));

    expect(campos.novaSenha).toBe('A senha precisa ter no mínimo 8 caracteres.');
  });

  it('o mapa global cobre esquemas sem mensagem declarada', () => {
    const esquemaSemMensagens = z.object({
      apelido: z.string().min(3),
      quantidade: z.number().min(1),
    });

    const campos = erros(esquemaSemMensagens.safeParse({ apelido: 'ab', quantidade: 0 }));

    expect(campos.apelido).toBe('Informe ao menos 3 caracteres.');
    expect(campos.quantidade).toBe('O valor mínimo é 1.');
  });

  it('nenhuma mensagem do sistema sai em inglês', () => {
    const amostras = [
      esquemaLogin.safeParse({}),
      esquemaLogin.safeParse({ cpf: 1, senha: 1 }),
      esquemaTrocaDeSenha.safeParse({}),
      esquemaTrocaDeSenha.safeParse({ novaSenha: 'a', confirmacao: 'b' }),
    ];

    const suspeitas = /Required|Expected|Invalid|String must|Number must/;

    for (const amostra of amostras) {
      for (const mensagem of Object.values(erros(amostra))) {
        expect(mensagem).not.toMatch(suspeitas);
      }
    }
  });
});

describe('esquemas da autenticação', () => {
  it('normaliza o CPF com máscara', () => {
    const resultado = esquemaLogin.safeParse({ cpf: '529.982.247-25', senha: 'segredo' });

    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.cpf).toBe('52998224725');
  });

  it('recusa CPF com dígito verificador errado', () => {
    const campos = erros(esquemaLogin.safeParse({ cpf: '111.111.111-11', senha: 'x' }));
    expect(campos.cpf).toBe('CPF inválido. Confira os números digitados.');
  });

  it('exige que a confirmação seja igual à nova senha', () => {
    const campos = erros(
      esquemaTrocaDeSenha.safeParse({ novaSenha: 'bordo2026', confirmacao: 'bordo2027' }),
    );
    expect(campos.confirmacao).toBe('As senhas não conferem.');
  });
});
