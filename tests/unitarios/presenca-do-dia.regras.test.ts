import { describe, expect, it } from 'vitest';
import {
  avaliarSituacaoDoMotorista,
  separarPresencaDoDia,
  type DadosDoMotorista,
} from '@/modulos/acompanhamento/acompanhamento.regras';
import { VERSAO_AVISO_PRIVACIDADE } from '@/modulos/privacidade/aviso-privacidade';

/** Quem foi trabalhar no dia — o topo do painel (pedido do cliente de 07/10). */

// 09:30 em São Paulo.
const AGORA = new Date('2026-10-07T12:30:00Z');
const DIA = '2026-10-07';

function motorista(nome: string, alteracoes: Partial<DadosDoMotorista> = {}): DadosDoMotorista {
  return {
    id: `id-${nome}`,
    nome,
    status: 'ATIVO',
    ultimoLoginEm: new Date('2026-10-06T09:00:00Z'),
    deveTrocarSenha: false,
    senhaTemporariaExpiraEm: null,
    bloqueadoAte: null,
    versoesAceitas: [VERSAO_AVISO_PRIVACIDADE],
    escalado: false,
    deFolga: false,
    primeiraJornadaEm: new Date('2026-10-01T09:00:00Z'),
    possuiCorridaConcluida: true,
    jornadaDoDia: null,
    jornadaAnteriorAberta: null,
    ...alteracoes,
  };
}

function jornada(
  iniciadaEm: string,
  alteracoes: Partial<NonNullable<DadosDoMotorista['jornadaDoDia']>> = {},
) {
  return {
    id: `jornada-${iniciadaEm}`,
    data: DIA,
    status: 'ABERTA' as const,
    iniciadaEm: new Date(iniciadaEm),
    encerradaEm: null,
    veiculo: { placa: 'ABC1234' },
    corridas: [],
    ...alteracoes,
  };
}

const situacao = (dados: DadosDoMotorista) =>
  avaliarSituacaoDoMotorista(dados, DIA, AGORA, VERSAO_AVISO_PRIVACIDADE);

describe('separarPresencaDoDia', () => {
  const ana = situacao(
    motorista('Ana', { escalado: true, jornadaDoDia: jornada('2026-10-07T09:10:00Z') }),
  );
  const bruno = situacao(motorista('Bruno', { escalado: true }));
  const caio = situacao(
    motorista('Caio', {
      escalado: true,
      deveTrocarSenha: true,
      senhaTemporariaExpiraEm: new Date('2026-10-05T00:00:00Z'),
    }),
  );
  const dora = situacao(motorista('Dora', { deFolga: true }));
  const edu = situacao(motorista('Edu'));
  const inativo = situacao(motorista('Fabio', { status: 'INATIVO' }));

  const presenca = separarPresencaDoDia([edu, dora, caio, bruno, ana, inativo]);

  it('separa em começou, não começou, não consegue entrar e folga', () => {
    expect(presenca.comecaram.map((m) => m.nome)).toEqual(['Ana']);
    expect(presenca.naoComecaram.map((m) => m.nome)).toEqual(['Bruno', 'Edu']);
    expect(presenca.semAcesso.map((m) => m.nome)).toEqual(['Caio']);
    expect(presenca.deFolga.map((m) => m.nome)).toEqual(['Dora']);
  });

  it('conta inativa sem jornada não é esperada no trabalho', () => {
    const todos = [
      ...presenca.comecaram,
      ...presenca.naoComecaram,
      ...presenca.semAcesso,
      ...presenca.deFolga,
    ];
    expect(todos.map((m) => m.nome)).not.toContain('Fabio');
  });

  it('conta escalados ativos e reconhece que há escala', () => {
    // Ana, Bruno e Caio. Dora está de folga: não é esperada.
    expect(presenca.esperados).toBe(3);
    expect(presenca.temEscala).toBe(true);
  });

  it('quem não começou e estava escalado vem antes de quem está fora da escala', () => {
    const edu2 = situacao(motorista('Aaron'));
    const ordem = separarPresencaDoDia([edu2, bruno]).naoComecaram.map((m) => m.nome);
    expect(ordem).toEqual(['Bruno', 'Aaron']);
  });

  it('quem começou aparece na ordem em que começou, com hora e van', () => {
    const cedo = situacao(motorista('Zeca', { jornadaDoDia: jornada('2026-10-07T08:50:00Z') }));
    const comecaram = separarPresencaDoDia([ana, cedo]).comecaram;
    expect(comecaram.map((m) => m.nome)).toEqual(['Zeca', 'Ana']);
    expect(comecaram[0]?.iniciouEm).toEqual(new Date('2026-10-07T08:50:00Z'));
    expect(comecaram[0]?.placaDoDia).toBe('ABC1234');
  });

  it('dia encerrado continua contando como quem foi trabalhar', () => {
    const encerrou = situacao(
      motorista('Gil', {
        jornadaDoDia: jornada('2026-10-07T09:00:00Z', {
          status: 'ENCERRADA',
          encerradaEm: new Date('2026-10-07T20:00:00Z'),
        }),
      }),
    );
    expect(separarPresencaDoDia([encerrou]).comecaram.map((m) => m.nome)).toEqual(['Gil']);
  });

  it('jornada registrada vale mesmo com folga marcada', () => {
    // O registro existe; escondê-lo atrás da folga apagaria um dia trabalhado.
    const trabalhouNaFolga = situacao(
      motorista('Hugo', { deFolga: true, jornadaDoDia: jornada('2026-10-07T09:00:00Z') }),
    );
    const resultado = separarPresencaDoDia([trabalhouNaFolga]);
    expect(resultado.comecaram).toHaveLength(1);
    expect(resultado.deFolga).toHaveLength(0);
  });

  it('sem escala no dia, ninguém é esperado', () => {
    const resultado = separarPresencaDoDia([edu, situacao(motorista('Iris'))]);
    expect(resultado.temEscala).toBe(false);
    expect(resultado.esperados).toBe(0);
    expect(resultado.naoComecaram).toHaveLength(2);
  });
});

describe('entrouNoDia', () => {
  it('distingue quem entrou no app hoje de quem só tem login antigo', () => {
    // 05:58 em São Paulo do mesmo dia.
    const hoje = situacao(motorista('Joana', { ultimoLoginEm: new Date('2026-10-07T08:58:00Z') }));
    const ontem = situacao(motorista('Lia', { ultimoLoginEm: new Date('2026-10-06T22:00:00Z') }));
    expect(hoje.entrouNoDia).toBe(true);
    expect(ontem.entrouNoDia).toBe(false);
  });

  it('usa o fuso da operação: 23h30 de ontem em São Paulo não é hoje', () => {
    // 02:30 UTC do dia 7 = 23:30 do dia 6 em São Paulo.
    const tarde = situacao(motorista('Mario', { ultimoLoginEm: new Date('2026-10-07T02:30:00Z') }));
    expect(tarde.entrouNoDia).toBe(false);
  });

  it('sem nenhum login, não entrou', () => {
    expect(situacao(motorista('Nina', { ultimoLoginEm: null })).entrouNoDia).toBe(false);
  });
});
