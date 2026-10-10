import { describe, expect, it } from 'vitest';
import { CodigoErro } from '@/lib/erros';
import {
  CHAVES_EDITAVEIS,
  PARAMETROS,
  validarOrdemDosHorarios,
  validarParametro,
} from '@/modulos/configuracao/configuracao.regras';

/** US042 — parâmetros do sistema (RF040). */

function codigoDoErro(acao: () => void): string {
  try {
    acao();
  } catch (erro) {
    return (erro as { codigo: string }).codigo;
  }
  throw new Error('esperava um erro, não houve');
}

describe('catálogo de parâmetros', () => {
  it('os de operação são exatamente os cinco previstos na US042', () => {
    const operacao = PARAMETROS.filter(
      (parametro) => (parametro.grupo ?? 'operacao') === 'operacao',
    );
    expect(operacao.map((parametro) => parametro.chave)).toEqual([
      'janela_edicao_horas',
      'horario_consolidado',
      'horario_alerta_pendencia',
      'tolerancia_odometro_km',
      'destinatarios_resumo',
    ]);
  });

  it('os do fechamento têm valor inicial, para a tela não mostrar campo vazio', () => {
    // Sem padrão, salvar o formulário daria erro num campo que ninguém tocou.
    const fechamento = PARAMETROS.filter((parametro) => parametro.grupo === 'fechamento');
    expect(fechamento.length).toBeGreaterThan(0);
    for (const parametro of fechamento) expect(parametro.padrao).not.toBeUndefined();
    expect(CHAVES_EDITAVEIS).toContain('he_valor_diaria');
    expect(CHAVES_EDITAVEIS).toContain('km_limite_dia');
  });

  it('os valores iniciais do fechamento são os informados pelo cliente', () => {
    const padrao = (chave: string) => PARAMETROS.find((p) => p.chave === chave)?.padrao;
    expect(padrao('he_valor_diaria')).toBe(105);
    expect(padrao('km_limite_dia')).toBe(130);
    expect(padrao('km_valor_motorista')).toBe(3);
    expect(padrao('he_limite_entrada')).toBe('06:00');
    expect(padrao('he_saida_seg_qui')).toBe('18:00');
    expect(padrao('he_saida_sex_dom')).toBe('17:00');
    expect(padrao('ciclo_dia_inicio')).toBe(16);
  });

  it('todo padrão passa na própria validação', () => {
    for (const parametro of PARAMETROS) {
      if (parametro.padrao === undefined) continue;
      expect(() => validarParametro(parametro.chave, parametro.padrao)).not.toThrow();
    }
  });

  it('mantém fora o que não deve ser editado numa lista de horários', () => {
    // Mudar a versão do aviso força todo mundo a aceitar de novo (RF042), e a
    // retenção apaga dado pessoal em definitivo (RNF007).
    expect(CHAVES_EDITAVEIS).not.toContain('versao_aviso_privacidade');
    expect(CHAVES_EDITAVEIS).not.toContain('retencao_localizacao_meses');
  });

  it('todo parâmetro explica o que muda na operação', () => {
    for (const parametro of PARAMETROS) {
      expect(parametro.explicacao.length).toBeGreaterThan(30);
    }
  });
});

describe('validarParametro · inteiros', () => {
  it('aceita dentro da faixa e devolve número', () => {
    expect(validarParametro('janela_edicao_horas', '24')).toBe(24);
    expect(validarParametro('tolerancia_odometro_km', 500)).toBe(500);
  });

  it('recusa fora da faixa', () => {
    expect(codigoDoErro(() => validarParametro('janela_edicao_horas', '999'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
    expect(codigoDoErro(() => validarParametro('janela_edicao_horas', '0'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
    expect(codigoDoErro(() => validarParametro('tolerancia_odometro_km', '5'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });

  it('recusa o que não é inteiro', () => {
    expect(codigoDoErro(() => validarParametro('janela_edicao_horas', '12,5'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
    expect(codigoDoErro(() => validarParametro('janela_edicao_horas', 'doze'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });
});

describe('validarParametro · horários', () => {
  it('aceita HH:MM válido', () => {
    expect(validarParametro('horario_consolidado', '23:00')).toBe('23:00');
    expect(validarParametro('horario_consolidado', '00:00')).toBe('00:00');
  });

  it('recusa formato e valores fora do relógio', () => {
    expect(codigoDoErro(() => validarParametro('horario_consolidado', '24:00'))).toBe(
      CodigoErro.HORARIO_INVALIDO,
    );
    expect(codigoDoErro(() => validarParametro('horario_consolidado', '23:60'))).toBe(
      CodigoErro.HORARIO_INVALIDO,
    );
    expect(codigoDoErro(() => validarParametro('horario_consolidado', '11h'))).toBe(
      CodigoErro.HORARIO_INVALIDO,
    );
  });
});

describe('validarParametro · telefones', () => {
  it('normaliza para E.164 e aceita separadores variados', () => {
    expect(validarParametro('destinatarios_resumo', '(11) 98888-7777\n21 97777-6666')).toEqual([
      '+5511988887777',
      '+5521977776666',
    ]);
  });

  it('remove duplicados', () => {
    // Duplicado faria o mesmo administrador receber o resumo duas vezes.
    expect(validarParametro('destinatarios_resumo', '11 98888-7777, (11) 98888-7777')).toEqual([
      '+5511988887777',
    ]);
  });

  it('aceita lista vazia', () => {
    expect(validarParametro('destinatarios_resumo', '')).toEqual([]);
  });

  it('recusa número que não dá para discar, nomeando o culpado', () => {
    // No cadastro dá para corrigir; por isso aqui recusa, ao contrário de
    // `escolherDestinatarios`, que descarta na hora do envio.
    expect(codigoDoErro(() => validarParametro('destinatarios_resumo', '11 98888-7777\n123'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });
});

describe('validarParametro · chave desconhecida', () => {
  it('recusa parâmetro que não está no catálogo', () => {
    expect(codigoDoErro(() => validarParametro('apagar_tudo', 'sim'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });
});

describe('validarOrdemDosHorarios', () => {
  it('aceita o alerta antes do consolidado', () => {
    expect(() => validarOrdemDosHorarios('20:00', '23:00')).not.toThrow();
  });

  it('recusa alerta depois ou junto do consolidado', () => {
    // Invertidos, o sistema cobraria o registro de um dia que ele já fechou.
    expect(codigoDoErro(() => validarOrdemDosHorarios('23:30', '23:00'))).toBe(
      CodigoErro.HORARIO_INVALIDO,
    );
    expect(codigoDoErro(() => validarOrdemDosHorarios('23:00', '23:00'))).toBe(
      CodigoErro.HORARIO_INVALIDO,
    );
  });

  it('não opina quando algum horário é inválido — quem recusa é validarParametro', () => {
    expect(() => validarOrdemDosHorarios('abc', '23:00')).not.toThrow();
  });
});

describe('validarParametro · dinheiro', () => {
  it('aceita como o administrador escreve e grava em reais com duas casas', () => {
    expect(validarParametro('he_valor_diaria', '105')).toBe(105);
    expect(validarParametro('he_valor_diaria', '105,50')).toBe(105.5);
    expect(validarParametro('he_valor_diaria', 'R$ 1.250,00')).toBe(1250);
    expect(validarParametro('he_valor_diaria', '99.9')).toBe(99.9);
    expect(validarParametro('km_valor_motorista', 3)).toBe(3);
  });

  it('recusa vazio, texto e fora da faixa', () => {
    expect(codigoDoErro(() => validarParametro('he_valor_diaria', ''))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
    expect(codigoDoErro(() => validarParametro('he_valor_diaria', 'cem'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
    expect(codigoDoErro(() => validarParametro('he_valor_diaria', '-1'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });
});

describe('validarParametro · sim ou não', () => {
  it('aceita sim, não e booleano', () => {
    expect(validarParametro('he_exige_ambas', 'sim')).toBe(true);
    expect(validarParametro('he_exige_ambas', 'nao')).toBe(false);
    expect(validarParametro('he_exige_ambas', false)).toBe(false);
  });

  it('recusa o resto', () => {
    expect(codigoDoErro(() => validarParametro('he_exige_ambas', 'talvez'))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });
});

describe('parâmetro de texto', () => {
  it('limpa espaços e aceita vazio', () => {
    expect(validarParametro('medicao_contrato', '  CT-001/2026 ')).toBe('CT-001/2026');
    expect(validarParametro('empresa_razao_social', 'TRANSPORTES   EXEMPLO')).toBe(
      'TRANSPORTES EXEMPLO',
    );
    expect(validarParametro('medicao_contrato', '')).toBe('');
  });

  it('recusa texto longo demais', () => {
    expect(codigoDoErro(() => validarParametro('medicao_contrato', 'x'.repeat(61)))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });
});
