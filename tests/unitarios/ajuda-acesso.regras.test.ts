import { describe, expect, it } from 'vitest';
import { CodigoErro } from '@/lib/erros';
import { orientacaoParaErroDeLogin } from '@/modulos/autenticacao/ajuda-acesso.regras';

describe('orientacaoParaErroDeLogin', () => {
  it.each([
    [CodigoErro.CONTA_BLOQUEADA, '/ajuda-acesso#bloqueio'],
    [CodigoErro.SENHA_TEMPORARIA_EXPIRADA, '/ajuda-acesso#senha-vencida'],
    [CodigoErro.CONTA_INATIVA, '/ajuda-acesso#acesso-indisponivel'],
  ])('encaminha %s para a solução correspondente', (codigo, caminho) => {
    expect(orientacaoParaErroDeLogin(codigo).caminho).toBe(caminho);
  });

  it('orienta a conferir CPF e senha atual sem afirmar que o CPF está cadastrado', () => {
    const orientacao = orientacaoParaErroDeLogin(CodigoErro.CREDENCIAIS_INVALIDAS);
    expect(orientacao.explicacao).toContain('senha atual');
    expect(orientacao.explicacao).not.toMatch(/cadastrado|não existe|não encontrado/i);
    expect(orientacao.caminho).toBe('/ajuda-acesso#primeiro-acesso');
  });

  it('orienta a aguardar quando o limite de solicitações é atingido', () => {
    const orientacao = orientacaoParaErroDeLogin(CodigoErro.LIMITE_EXCEDIDO);
    expect(orientacao.explicacao).toContain('Espere');
    expect(orientacao.caminho).toBe('/ajuda-acesso#suporte');
  });

  it('mantém todos os caminhos de ajuda internos e sem dados pessoais em parâmetros', () => {
    for (const codigo of Object.values(CodigoErro)) {
      const orientacao = orientacaoParaErroDeLogin(codigo);
      expect(orientacao.caminho).toMatch(/^\/ajuda-acesso#[a-z-]+$/);
      expect(orientacao.rotulo.length).toBeGreaterThan(0);
    }
  });
});
