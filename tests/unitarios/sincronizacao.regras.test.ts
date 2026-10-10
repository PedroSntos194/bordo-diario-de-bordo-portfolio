import { describe, expect, it } from 'vitest';
import { CodigoErro } from '@/lib/erros';
import {
  classificarFalha,
  estadoLocal,
  ordenarOperacoes,
  podeSairDaFila,
  textoDaSincronizacao,
  type OperacaoOffline,
  type RetratoDoDia,
} from '@/modulos/sincronizacao/sincronizacao.regras';

/** US025 — ordem, conflito e o estado do dia visto pelo aparelho. */

function operacao(
  tipo: OperacaoOffline['tipo'],
  ocorridoEm: string,
  dados: Record<string, unknown> = {},
  clientUuid = `${tipo}-${ocorridoEm}`,
): OperacaoOffline {
  return { clientUuid, tipo, ocorridoEm, dados };
}

const RETRATO: RetratoDoDia = {
  data: '2026-08-28',
  atualizadoEm: '2026-08-28T10:00:00.000Z',
  jornadaAberta: null,
  corridaEmAndamento: null,
  veiculos: [{ id: 'v1', placa: 'ABC1234', modelo: 'Sprinter', odometroAtual: 160400 }],
  rotas: [{ id: 'r1', codigo: 'R-014', nome: 'Centro → Fábrica' }],
};

describe('ordenarOperacoes', () => {
  it('aplica pelo relógio do aparelho, não pela ordem de chegada', () => {
    // Sem rede tudo chega junto: ordenar por chegada encerraria a corrida antes
    // de iniciá-la.
    const emOrdem = ordenarOperacoes([
      operacao('ENCERRAR_CORRIDA', '2026-08-28T12:00:00.000Z'),
      operacao('ABRIR_JORNADA', '2026-08-28T10:00:00.000Z'),
      operacao('INICIAR_CORRIDA', '2026-08-28T11:00:00.000Z'),
    ]);

    expect(emOrdem.map((item) => item.tipo)).toEqual([
      'ABRIR_JORNADA',
      'INICIAR_CORRIDA',
      'ENCERRAR_CORRIDA',
    ]);
  });

  it('é estável quando duas operações caem no mesmo instante', () => {
    // Parada e fim de corrida em sequência acontecem dentro do mesmo segundo.
    const mesmo = '2026-08-28T11:00:00.000Z';
    const emOrdem = ordenarOperacoes([
      operacao('REGISTRAR_EVENTO', mesmo, {}, 'primeira'),
      operacao('ENCERRAR_CORRIDA', mesmo, {}, 'segunda'),
    ]);

    expect(emOrdem.map((item) => item.clientUuid)).toEqual(['primeira', 'segunda']);
  });

  it('não altera a lista recebida', () => {
    const original = [
      operacao('ENCERRAR_CORRIDA', '2026-08-28T12:00:00.000Z'),
      operacao('ABRIR_JORNADA', '2026-08-28T10:00:00.000Z'),
    ];
    ordenarOperacoes(original);

    expect(original[0]?.tipo).toBe('ENCERRAR_CORRIDA');
  });
});

describe('classificarFalha', () => {
  it('trata recusa de regra como conflito para o motorista decidir', () => {
    // Repetir sozinho só produziria a mesma recusa, para sempre.
    expect(classificarFalha(CodigoErro.CORRIDA_JA_ENCERRADA)).toBe('CONFLITO');
    expect(classificarFalha(CodigoErro.JORNADA_JA_ABERTA)).toBe('CONFLITO');
    expect(classificarFalha(CodigoErro.ODOMETRO_MENOR_QUE_INICIAL)).toBe('CONFLITO');
    expect(classificarFalha(CodigoErro.NAO_ENCONTRADO)).toBe('CONFLITO');
  });

  it('trata falha de ambiente como algo a repetir', () => {
    expect(classificarFalha(CodigoErro.ERRO_INTERNO)).toBe('FALHA');
    expect(classificarFalha(CodigoErro.SERVICO_INDISPONIVEL)).toBe('FALHA');
    expect(classificarFalha(CodigoErro.LIMITE_EXCEDIDO)).toBe('FALHA');
    // O motorista entra de novo e a fila segue de onde parou.
    expect(classificarFalha(CodigoErro.SESSAO_EXPIRADA)).toBe('FALHA');
  });
});

describe('podeSairDaFila', () => {
  it('some da fila o que o servidor aceitou ou já conhecia', () => {
    expect(podeSairDaFila('APLICADA')).toBe(true);
    expect(podeSairDaFila('JA_PROCESSADA')).toBe(true);
  });

  it('conflito e falha continuam guardados', () => {
    // "Nunca descartado silenciosamente" é critério de aceitação.
    expect(podeSairDaFila('CONFLITO')).toBe(false);
    expect(podeSairDaFila('FALHA')).toBe(false);
  });
});

describe('estadoLocal', () => {
  it('sem retrato e sem fila, o dia não começou', () => {
    const estado = estadoLocal(null, []);
    expect(estado.temJornada).toBe(false);
    expect(estado.corrida).toBe(null);
    expect(estado.pendentes).toBe(0);
  });

  it('reconhece o dia aberto sem rede que o servidor ainda desconhece', () => {
    // Sem isto o motorista veria "você ainda não iniciou seu dia" e abriria de
    // novo, criando duas jornadas das quais uma seria recusada.
    const estado = estadoLocal(RETRATO, [
      { ...operacao('ABRIR_JORNADA', '2026-08-28T10:30:00.000Z', { placa: 'ABC1234' }) },
    ]);

    expect(estado.temJornada).toBe(true);
    expect(estado.placaDaJornada).toBe('ABC1234');
    expect(estado.pendentes).toBe(1);
  });

  it('aponta a corrida iniciada sem rede pelo identificador do aparelho', () => {
    // Ela não tem id do servidor até subir: encerrá-la exige apontar pelo
    // `clientUuid` (RN025).
    const estado = estadoLocal(RETRATO, [
      operacao('ABRIR_JORNADA', '2026-08-28T10:30:00.000Z'),
      operacao(
        'INICIAR_CORRIDA',
        '2026-08-28T11:00:00.000Z',
        { descricao: 'Centro → Fábrica' },
        'corrida-local',
      ),
    ]);

    expect(estado.corrida).toEqual({
      id: null,
      clientUuid: 'corrida-local',
      descricao: 'Centro → Fábrica',
    });
  });

  it('usa a corrida do servidor quando ela veio no retrato', () => {
    const estado = estadoLocal(
      {
        ...RETRATO,
        jornadaAberta: { id: 'j1', placa: 'ABC1234' },
        corridaEmAndamento: { id: 'c1', descricao: 'Bairro → Fábrica' },
      },
      [],
    );

    expect(estado.temJornada).toBe(true);
    expect(estado.corrida?.id).toBe('c1');
    expect(estado.corrida?.clientUuid).toBe(null);
  });

  it('o encerramento pendente fecha a corrida no estado local', () => {
    const estado = estadoLocal({ ...RETRATO, jornadaAberta: { id: 'j1', placa: 'ABC1234' } }, [
      operacao('INICIAR_CORRIDA', '2026-08-28T11:00:00.000Z', {}, 'corrida-local'),
      operacao('ENCERRAR_CORRIDA', '2026-08-28T11:40:00.000Z'),
    ]);

    expect(estado.corrida).toBe(null);
    expect(estado.temJornada).toBe(true);
  });

  it('o fim do dia pendente fecha jornada e corrida', () => {
    const estado = estadoLocal({ ...RETRATO, jornadaAberta: { id: 'j1', placa: 'ABC1234' } }, [
      operacao('ENCERRAR_JORNADA', '2026-08-28T20:00:00.000Z'),
    ]);

    expect(estado.temJornada).toBe(false);
    expect(estado.corrida).toBe(null);
  });

  it('aplica a fila em ordem cronológica, não na ordem de gravação', () => {
    const estado = estadoLocal(RETRATO, [
      operacao('ENCERRAR_CORRIDA', '2026-08-28T11:40:00.000Z'),
      operacao('ABRIR_JORNADA', '2026-08-28T10:30:00.000Z'),
      operacao('INICIAR_CORRIDA', '2026-08-28T11:00:00.000Z', {}, 'corrida-local'),
    ]);

    expect(estado.temJornada).toBe(true);
    expect(estado.corrida).toBe(null);
  });

  it('operação em conflito não conta para o estado', () => {
    // Ela já foi recusada pelo servidor; tratá-la como válida manteria a tela
    // mostrando uma corrida que não existe em lugar nenhum.
    const estado = estadoLocal(RETRATO, [
      {
        ...operacao('ABRIR_JORNADA', '2026-08-28T10:30:00.000Z'),
        conflito: { codigo: 'JORNADA_JA_ABERTA', mensagem: 'Já existe jornada.' },
      },
    ]);

    expect(estado.temJornada).toBe(false);
    expect(estado.pendentes).toBe(0);
    expect(estado.emConflito).toBe(1);
  });
});

describe('textoDaSincronizacao', () => {
  const base = { online: true, pendentes: 0, emConflito: 0, sincronizando: false };

  it('diz "Sincronizado" quando não há nada a enviar', () => {
    expect(textoDaSincronizacao(base)).toEqual({ rotulo: 'Sincronizado', tom: 'sucesso' });
  });

  it('conta os pendentes, no singular e no plural', () => {
    expect(textoDaSincronizacao({ ...base, pendentes: 1 }).rotulo).toBe('1 registro pendente');
    expect(textoDaSincronizacao({ ...base, pendentes: 4 }).rotulo).toBe('4 registros pendentes');
  });

  it('sem rede e sem fila, avisa da conexão em vez de mentir "sincronizado"', () => {
    expect(textoDaSincronizacao({ ...base, online: false })).toEqual({
      rotulo: 'Sem conexão',
      tom: 'atencao',
    });
  });

  it('conflito vence tudo — é o único estado que exige uma pessoa', () => {
    const texto = textoDaSincronizacao({
      online: true,
      pendentes: 3,
      emConflito: 2,
      sincronizando: true,
    });

    expect(texto.rotulo).toBe('2 registros precisam de você');
    expect(texto.tom).toBe('erro');
  });
});
