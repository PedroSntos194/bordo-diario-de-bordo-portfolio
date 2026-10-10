import { describe, expect, it } from 'vitest';
import { CodigoErro, ehErroDaAplicacao } from '@/lib/erros';
import {
  compararComEscala,
  houveDivergencia,
  resumirDivergencia,
  turnosConflitam,
  validarMotoristaLivre,
  validarVeiculoLivre,
  type EscalaDoDia,
  type EscalaExistente,
} from '@/modulos/escala/escala.regras';

/** US014 — conflito de turno (RN013) e divergência entre plano e registro. */

function escalado(sobrescritas: Partial<EscalaExistente> = {}): EscalaExistente {
  return {
    turno: 'MANHA',
    motorista: { nome: 'Carlos Pereira' },
    veiculo: { placa: 'ABC1234' },
    ...sobrescritas,
  };
}

function codigoDoErro(executar: () => void): string | null {
  try {
    executar();
    return null;
  } catch (erro) {
    return ehErroDaAplicacao(erro) ? erro.codigo : 'DESCONHECIDO';
  }
}

const ESCALA: EscalaDoDia = {
  veiculoId: 'van-1',
  placa: 'ABC1234',
  turno: 'INTEGRAL',
  rotas: [
    { id: 'r1', codigo: 'R-014' },
    { id: 'r2', codigo: 'R-022' },
  ],
};

describe('turnosConflitam', () => {
  it('o mesmo turno conflita', () => {
    expect(turnosConflitam('MANHA', 'MANHA')).toBe(true);
  });

  it('turnos específicos diferentes convivem', () => {
    // Numa frota pequena, a mesma van roda de manhã com um motorista e à tarde
    // com outro. Bloquear isso inviabilizaria a escala.
    expect(turnosConflitam('MANHA', 'TARDE')).toBe(false);
    expect(turnosConflitam('TARDE', 'NOITE')).toBe(false);
  });

  it('o dia inteiro conflita com qualquer turno', () => {
    // É o caso que o índice único do banco NÃO alcança: `INTEGRAL` e `MANHA`
    // são valores diferentes na coluna e passariam pela restrição.
    expect(turnosConflitam('INTEGRAL', 'MANHA')).toBe(true);
    expect(turnosConflitam('NOITE', 'INTEGRAL')).toBe(true);
    expect(turnosConflitam('INTEGRAL', 'INTEGRAL')).toBe(true);
  });
});

describe('validarVeiculoLivre', () => {
  it('aceita quando não há ninguém no turno', () => {
    expect(codigoDoErro(() => validarVeiculoLivre('TARDE', [escalado()]))).toBe(null);
    expect(codigoDoErro(() => validarVeiculoLivre('MANHA', []))).toBe(null);
  });

  it('recusa a mesma van no mesmo turno, dizendo quem já a tem', () => {
    let mensagem = '';
    try {
      validarVeiculoLivre('MANHA', [escalado()]);
    } catch (erro) {
      mensagem = ehErroDaAplicacao(erro) ? erro.message : '';
      expect(ehErroDaAplicacao(erro) && erro.codigo).toBe(CodigoErro.VEICULO_EM_USO);
    }

    // Sem o nome, o administrador vê "conflito" e precisa procurar na lista.
    expect(mensagem).toContain('Carlos Pereira');
    expect(mensagem).toContain('ABC-1234');
  });

  it('recusa turno específico contra dia inteiro já escalado', () => {
    expect(
      codigoDoErro(() => validarVeiculoLivre('NOITE', [escalado({ turno: 'INTEGRAL' })])),
    ).toBe(CodigoErro.VEICULO_EM_USO);
  });
});

describe('validarMotoristaLivre', () => {
  it('recusa a mesma pessoa em duas vans no mesmo turno', () => {
    expect(codigoDoErro(() => validarMotoristaLivre('MANHA', [escalado()]))).toBe(
      CodigoErro.CONFLITO,
    );
  });

  it('aceita a mesma pessoa em turnos diferentes', () => {
    expect(codigoDoErro(() => validarMotoristaLivre('TARDE', [escalado()]))).toBe(null);
  });
});

describe('compararComEscala', () => {
  it('sem escala, não há divergência a apontar', () => {
    const divergencia = compararComEscala(null, {
      veiculoId: 'van-9',
      placa: 'XYZ2B34',
      rotasUsadas: [{ id: 'r9', codigo: 'R-099' }],
    });

    expect(divergencia.temEscala).toBe(false);
    expect(houveDivergencia(divergencia)).toBe(false);
    expect(resumirDivergencia(divergencia)).toBe(null);
  });

  it('dia conforme o plano não gera aviso', () => {
    const divergencia = compararComEscala(ESCALA, {
      veiculoId: 'van-1',
      placa: 'ABC1234',
      rotasUsadas: [
        { id: 'r1', codigo: 'R-014' },
        { id: 'r2', codigo: 'R-022' },
      ],
    });

    expect(houveDivergencia(divergencia)).toBe(false);
  });

  it('aponta a van trocada, dizendo qual era a escalada', () => {
    const divergencia = compararComEscala(ESCALA, {
      veiculoId: 'van-2',
      placa: 'XYZ2B34',
      rotasUsadas: [{ id: 'r1', codigo: 'R-014' }],
    });

    expect(divergencia.veiculoDivergente).toBe(true);
    expect(resumirDivergencia(divergencia)).toContain('ABC-1234');
  });

  it('aponta a rota rodada fora da escala', () => {
    const divergencia = compararComEscala(ESCALA, {
      veiculoId: 'van-1',
      placa: 'ABC1234',
      rotasUsadas: [
        { id: 'r1', codigo: 'R-014' },
        { id: 'r9', codigo: 'R-099' },
      ],
    });

    expect(divergencia.rotasForaDaEscala).toEqual(['R-099']);
    expect(resumirDivergencia(divergencia)).toContain('R-099');
  });

  it('aponta a rota escalada em que ninguém rodou', () => {
    const divergencia = compararComEscala(ESCALA, {
      veiculoId: 'van-1',
      placa: 'ABC1234',
      rotasUsadas: [{ id: 'r1', codigo: 'R-014' }],
    });

    expect(divergencia.rotasNaoCumpridas).toEqual(['R-022']);
  });

  it('corrida avulsa não é divergência de rota', () => {
    // A avulsa é recurso previsto da operação (US018), não desvio do plano.
    // Marcá-la encheria o painel de alerta sobre o funcionamento normal.
    const divergencia = compararComEscala(
      { ...ESCALA, rotas: [{ id: 'r1', codigo: 'R-014' }] },
      { veiculoId: 'van-1', placa: 'ABC1234', rotasUsadas: [{ id: 'r1', codigo: 'R-014' }] },
    );

    expect(houveDivergencia(divergencia)).toBe(false);
  });

  it('junta os motivos numa frase só', () => {
    const divergencia = compararComEscala(ESCALA, {
      veiculoId: 'van-2',
      placa: 'XYZ2B34',
      rotasUsadas: [{ id: 'r9', codigo: 'R-099' }],
    });

    const resumo = resumirDivergencia(divergencia) ?? '';
    expect(resumo).toContain('van diferente');
    expect(resumo).toContain('R-099');
    expect(resumo).toContain('R-014');
  });
});
