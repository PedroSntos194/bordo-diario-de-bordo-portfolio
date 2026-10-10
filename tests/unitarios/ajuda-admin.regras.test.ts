import { describe, expect, it } from 'vitest';
import { ajudaAdminParaCaminho } from '@/modulos/ajuda/ajuda-admin.regras';

describe('ajuda administrativa por tela', () => {
  it.each([
    ['/admin', 'painel'],
    ['/admin/motoristas', 'motoristas'],
    ['/admin/usuarios/123', 'usuarios'],
    ['/admin/jornadas/123', 'jornadas'],
    ['/admin/corridas/123', 'corridas'],
    ['/admin/escala', 'escala'],
    ['/admin/preparacao', 'escala'],
    ['/admin/pendencias', 'pendencias'],
    ['/admin/relatorios', 'relatorios'],
    ['/admin/resumo', 'relatorios'],
    ['/admin/configuracoes', 'configuracoes'],
    ['/admin/fechamento', 'fechamento'],
    ['/admin/feriados', 'fechamento'],
  ])('orienta a rotina correspondente em %s', (caminho, chave) => {
    expect(ajudaAdminParaCaminho(caminho).chave).toBe(chave);
  });

  it('não trata uma seção desconhecida como se fosse outra tela', () => {
    expect(ajudaAdminParaCaminho('/admin/usuarios-antigos').chave).toBe('painel');
  });
});
