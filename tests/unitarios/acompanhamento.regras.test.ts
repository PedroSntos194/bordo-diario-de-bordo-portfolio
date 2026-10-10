import { describe, expect, it } from 'vitest';
import {
  avaliarSituacaoDoMotorista,
  filtrarSituacoes,
  resumirSituacoes,
  type DadosDoMotorista,
} from '@/modulos/acompanhamento/acompanhamento.regras';
import { VERSAO_AVISO_PRIVACIDADE } from '@/modulos/privacidade/aviso-privacidade';

// Já é dia 5 em UTC, mas ainda é dia 4 na operação em São Paulo.
const AGORA = new Date('2026-10-05T02:30:00Z');
const DIA = '2026-10-04';

function motorista(alteracoes: Partial<DadosDoMotorista> = {}): DadosDoMotorista {
  return {
    id: 'motorista-1',
    nome: 'José da Silva',
    status: 'ATIVO',
    ultimoLoginEm: new Date('2026-10-04T10:00:00Z'),
    deveTrocarSenha: false,
    senhaTemporariaExpiraEm: null,
    bloqueadoAte: null,
    versoesAceitas: [VERSAO_AVISO_PRIVACIDADE],
    escalado: false,
    deFolga: false,
    primeiraJornadaEm: new Date('2026-10-01T10:00:00Z'),
    possuiCorridaConcluida: true,
    jornadaDoDia: null,
    jornadaAnteriorAberta: null,
    ...alteracoes,
  };
}

function avaliar(dados: Partial<DadosDoMotorista> = {}, data = DIA, agora = AGORA) {
  return avaliarSituacaoDoMotorista(motorista(dados), data, agora, VERSAO_AVISO_PRIVACIDADE);
}

function jornada(alteracoes: Partial<NonNullable<DadosDoMotorista['jornadaDoDia']>> = {}) {
  return {
    id: 'jornada-hoje',
    data: DIA,
    status: 'ABERTA' as const,
    iniciadaEm: new Date('2026-10-04T10:00:00Z'),
    encerradaEm: null,
    corridas: [],
    ...alteracoes,
  };
}

describe('acompanhamento: precedência e fronteiras do acesso atual', () => {
  it.each([
    ['BLOQUEADO', 'CONTA_BLOQUEADA'],
    ['INATIVO', 'CONTA_INATIVA'],
    ['EXCLUIDO', 'CONTA_INATIVA'],
  ] as const)('o status %s prevalece sobre bloqueio e senha vencida', (status, acesso) => {
    expect(
      avaliar({
        status,
        bloqueadoAte: new Date(AGORA.getTime() + 60_000),
        deveTrocarSenha: true,
        senhaTemporariaExpiraEm: new Date(AGORA.getTime() - 1),
        ultimoLoginEm: null,
      }).acesso,
    ).toBe(acesso);
  });

  it('bloqueio vigente prevalece sobre senha vencida e ausência do primeiro login', () => {
    const situacao = avaliar({
      bloqueadoAte: new Date(AGORA.getTime() + 1),
      deveTrocarSenha: true,
      senhaTemporariaExpiraEm: new Date(AGORA.getTime() - 1),
      ultimoLoginEm: null,
    });
    expect(situacao.acesso).toBe('BLOQUEIO_TEMPORARIO');
    expect(situacao.acessoDescricao).toContain('04/10/2026 23:30');
  });

  it.each([0, -1])('não mantém o bloqueio quando ele venceu há %i ms', (milissegundos) => {
    expect(avaliar({ bloqueadoAte: new Date(AGORA.getTime() + milissegundos) }).acesso).toBe(
      'PRONTO',
    );
  });

  it('senha vencida prevalece sobre ausência de login e aceite pendente', () => {
    expect(
      avaliar({
        deveTrocarSenha: true,
        senhaTemporariaExpiraEm: new Date(AGORA.getTime() - 1),
        ultimoLoginEm: null,
        versoesAceitas: [],
      }).acesso,
    ).toBe('SENHA_EXPIRADA');
  });

  it('a senha temporária ainda vale no instante exato do vencimento', () => {
    expect(avaliar({ deveTrocarSenha: true, senhaTemporariaExpiraEm: AGORA }).acesso).toBe(
      'TROCA_PENDENTE',
    );
  });

  it('não confunde data antiga da senha temporária com senha atual já trocada', () => {
    expect(avaliar({ senhaTemporariaExpiraEm: new Date(AGORA.getTime() - 1) }).acesso).toBe(
      'PRONTO',
    );
  });

  it('ausência do primeiro login precede troca e privacidade pendentes', () => {
    expect(
      avaliar({
        ultimoLoginEm: null,
        deveTrocarSenha: true,
        senhaTemporariaExpiraEm: new Date(AGORA.getTime() + 60_000),
        versoesAceitas: [],
      }).acesso,
    ).toBe('NUNCA_ENTROU');
  });

  it('troca de senha precede privacidade quando já houve login', () => {
    const situacao = avaliar({ deveTrocarSenha: true, versoesAceitas: [] });
    expect(situacao.acesso).toBe('TROCA_PENDENTE');
    expect(situacao.adocao.find((etapa) => etapa.chave === 'login')?.concluida).toBe(true);
    expect(situacao.adocao.find((etapa) => etapa.chave === 'senha')?.concluida).toBe(false);
  });

  it('aceite de outra versão não libera a privacidade atual', () => {
    expect(avaliar({ versoesAceitas: ['versao-anterior'] }).acesso).toBe('PRIVACIDADE_PENDENTE');
    expect(avaliar().acesso).toBe('PRONTO');
  });
});

describe('acompanhamento: operação do dia e adoção', () => {
  it('folga dispensa cobrança mesmo quando o motorista está escalado', () => {
    const situacao = avaliar({ escalado: true, deFolga: true });
    expect(situacao).toMatchObject({ operacao: 'FOLGA', escalado: false, precisaAtencao: false });
  });

  it('folga não esconde um problema de acesso', () => {
    expect(avaliar({ escalado: true, deFolga: true, ultimoLoginEm: null })).toMatchObject({
      operacao: 'FOLGA',
      acesso: 'NUNCA_ENTROU',
      precisaAtencao: true,
    });
  });

  it.each([
    ['ABERTA', 'DIA_INICIADO'],
    ['ENCERRADA', 'DIA_ENCERRADO'],
  ] as const)('folga não esconde jornada %s já registrada', (status, operacao) => {
    expect(
      avaliar({
        escalado: true,
        deFolga: true,
        jornadaDoDia: jornada({ status }),
      }),
    ).toMatchObject({ operacao, jornadaId: 'jornada-hoje', deFolga: true, escalado: false });
  });

  it('jornada anterior aberta permanece separada e não conta como início do dia escolhido', () => {
    const anterior = { id: 'jornada-anterior', data: '2026-10-03' };
    const situacao = avaliar({ escalado: true, jornadaAnteriorAberta: anterior });
    expect(situacao).toMatchObject({
      operacao: 'AGUARDANDO_INICIAR',
      jornadaId: null,
      jornadaAnteriorAberta: anterior,
      precisaAtencao: true,
    });
    expect(situacao.proximoPasso).toContain('03/10/2026');
  });

  it('desativar a conta não esconde uma jornada anterior no filtro de atenção', () => {
    const situacao = avaliar({
      status: 'INATIVO',
      jornadaAnteriorAberta: { id: 'jornada-anterior', data: '2026-10-03' },
    });
    expect(situacao.acesso).toBe('CONTA_INATIVA');
    expect(situacao.precisaAtencao).toBe(true);
    expect(filtrarSituacoes([situacao], undefined, true)).toEqual([situacao]);
  });

  it('conta inativa sem registro aberto não gera cobrança de operação ou acesso', () => {
    const situacao = avaliar({ status: 'INATIVO', escalado: true });
    expect(situacao.precisaAtencao).toBe(false);
    expect(filtrarSituacoes([situacao], undefined, true)).toEqual([]);
  });

  it('jornada aberta na data histórica precisa de atenção mesmo em conta inativa', () => {
    const situacao = avaliar(
      { status: 'INATIVO', jornadaDoDia: jornada({ data: '2026-10-03' }) },
      '2026-10-03',
    );
    expect(situacao.operacao).toBe('DIA_INICIADO');
    expect(situacao.precisaAtencao).toBe(true);
  });

  it('só conta corridas encerradas com horário de encerramento e mostra a que está em andamento', () => {
    const situacao = avaliar({
      jornadaDoDia: jornada({
        corridas: [
          { status: 'ENCERRADA', encerradaEm: AGORA },
          { status: 'ENCERRADA', encerradaEm: null },
          { status: 'CANCELADA', encerradaEm: AGORA },
          { status: 'EM_ANDAMENTO', encerradaEm: null },
        ],
      }),
    });
    expect(situacao.operacao).toBe('CORRIDA_EM_ANDAMENTO');
    expect(situacao.corridasConcluidasNoDia).toBe(1);
  });

  it('primeira jornada sem corrida concluída não completa a primeira utilização', () => {
    const situacao = avaliar({ possuiCorridaConcluida: false });
    expect(situacao.adocao.find((etapa) => etapa.chave === 'jornada')?.concluida).toBe(true);
    expect(situacao.adocao.find((etapa) => etapa.chave === 'corrida')?.concluida).toBe(false);
    expect(situacao.adocaoConcluida).toBe(false);
    expect(situacao.precisaAtencao).toBe(true);
    expect(avaliar().adocaoConcluida).toBe(true);
  });

  it('uma corrida histórica não substitui a evidência da primeira jornada', () => {
    expect(avaliar({ primeiraJornadaEm: null }).adocaoConcluida).toBe(false);
  });

  it('cobrança muda para conferência histórica somente depois da meia-noite em São Paulo', () => {
    const antes = avaliar({ escalado: true }, DIA, new Date('2026-10-05T02:59:59Z'));
    const depois = avaliar({ escalado: true }, DIA, new Date('2026-10-05T03:00:00Z'));
    expect(antes.proximoPasso).toContain('abertura do dia');
    expect(depois.proximoPasso).toContain('trabalhou neste dia');
  });
});

describe('acompanhamento: busca e indicadores', () => {
  it('busca nomes sem acentos e sem diferenciar maiúsculas e espaços externos', () => {
    const situacoes = [avaliar(), avaliar({ id: 'outra', nome: 'Maria' })];
    expect(filtrarSituacoes(situacoes, '  JOSE DA  ', false).map((item) => item.id)).toEqual([
      'motorista-1',
    ]);
    expect(filtrarSituacoes(situacoes, 'inexistente', false)).toEqual([]);
  });

  it('combina busca com atenção sem incluir motorista pronto que tem nome correspondente', () => {
    const situacoes = [
      avaliar(),
      avaliar({ id: 'precisa-ajuda', nome: 'José Pereira', ultimoLoginEm: null }),
    ];
    expect(filtrarSituacoes(situacoes, 'jose', true).map((item) => item.id)).toEqual([
      'precisa-ajuda',
    ]);
  });

  it('indicadores de cobrança excluem folga e contas inativas sem esconder operação registrada', () => {
    const resumo = resumirSituacoes([
      avaliar({ id: 'escalado', escalado: true }),
      avaliar({ id: 'folga', escalado: true, deFolga: true }),
      avaliar({ id: 'inativo', status: 'INATIVO', escalado: true }),
      avaliar({ id: 'operacao', jornadaDoDia: jornada() }),
      avaliar({ id: 'encerrado', jornadaDoDia: jornada({ status: 'ENCERRADA' }) }),
    ]);
    expect(resumo).toMatchObject({
      total: 5,
      escaladosSemJornada: 1,
      emOperacao: 1,
      diaEncerrado: 1,
    });
  });
});

describe('acompanhamento: orientação ao motorista respeita o planejamento e a data', () => {
  it('não orienta abrir o dia durante a folga', () => {
    const situacao = avaliar({ escalado: true, deFolga: true });
    expect(situacao.acesso).toBe('PRONTO');
    expect(situacao.orientacao).toMatch(/folga/i);
    expect(situacao.orientacao).not.toMatch(/inicie o dia/i);
  });

  it('pede conferir a previsão de trabalho quando não há escala', () => {
    const situacao = avaliar({ escalado: false });
    expect(situacao.orientacao).toMatch(/escala|previsão/i);
    expect(situacao.orientacao).not.toMatch(/inicie o dia/i);
  });

  it('conferir um dia anterior não orienta criar uma jornada hoje', () => {
    const situacao = avaliar({ escalado: true }, '2026-10-03');
    expect(situacao.orientacao).toContain('03/10/2026');
    expect(situacao.orientacao).not.toMatch(/inicie o dia/i);
  });

  it('dia encerrado orienta consultar o histórico e não abrir novamente', () => {
    const situacao = avaliar({ jornadaDoDia: jornada({ status: 'ENCERRADA' }) });
    expect(situacao.orientacao).toMatch(/histórico/i);
    expect(situacao.orientacao).not.toMatch(/inicie o dia/i);
  });
});
