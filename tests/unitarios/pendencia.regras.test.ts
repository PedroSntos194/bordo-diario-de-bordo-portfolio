import { describe, expect, it } from 'vitest';
import {
  MAXIMO_DE_ITENS_NA_MENSAGEM,
  houvePendencia,
  montarLinkDasPendencias,
  montarLinkDoAplicativo,
  montarMensagemConsolidada,
  montarMensagemDeJornadaEmAberto,
  montarMensagemDeSemRegistro,
  type JornadaEmAberto,
  type PendenciasDoDia,
} from '@/modulos/pendencia/pendencia.regras';

/** US038 — o texto das cobranças e o corte da lista consolidada. */

const APP = 'https://bordo.exemplo.com.br/';
const LINK_APP = montarLinkDoAplicativo(APP);

function jornada(sobrescritas: Partial<JornadaEmAberto> = {}): JornadaEmAberto {
  return {
    id: 'j1',
    data: '2026-08-28',
    // 07:15 em São Paulo.
    iniciadaEm: new Date('2026-08-28T10:15:00Z'),
    motorista: { id: 'm1', nome: 'Carlos Pereira', telefone: '+5511999998888' },
    veiculo: { placa: 'ABC1234' },
    temCorridaEmAndamento: false,
    ...sobrescritas,
  };
}

function pendencias(sobrescritas: Partial<PendenciasDoDia> = {}): PendenciasDoDia {
  return {
    data: '2026-08-28',
    jornadasEmAberto: [],
    motoristasSemRegistro: [],
    ...sobrescritas,
  };
}

describe('houvePendencia', () => {
  it('é falso quando não há nada a cobrar', () => {
    expect(houvePendencia(pendencias())).toBe(false);
  });

  it('basta uma jornada aberta', () => {
    expect(houvePendencia(pendencias({ jornadasEmAberto: [jornada()] }))).toBe(true);
  });

  it('basta um motorista sem registro', () => {
    expect(
      houvePendencia(
        pendencias({
          motoristasSemRegistro: [{ id: 'm2', nome: 'Ana Souza', telefone: '+5511988887777' }],
        }),
      ),
    ).toBe(true);
  });
});

describe('montarMensagemDeJornadaEmAberto', () => {
  it('identifica o dia, a van e a hora de início', () => {
    const mensagem = montarMensagemDeJornadaEmAberto(jornada(), LINK_APP);

    expect(mensagem).toContain('28/08/2026');
    expect(mensagem).toContain('ABC-1234');
    expect(mensagem).toContain('07:15');
    expect(mensagem.endsWith('https://bordo.exemplo.com.br/app')).toBe(true);
  });

  it('manda encerrar a corrida antes quando ainda há uma rodando', () => {
    const mensagem = montarMensagemDeJornadaEmAberto(
      jornada({ temCorridaEmAndamento: true }),
      LINK_APP,
    );

    expect(mensagem).toContain('Encerre a corrida em andamento');
  });

  it('sem corrida rodando, pede só o encerramento do dia', () => {
    const mensagem = montarMensagemDeJornadaEmAberto(jornada(), LINK_APP);

    expect(mensagem).not.toContain('corrida em andamento');
    expect(mensagem).toContain('Encerre o dia no aplicativo');
  });
});

describe('montarMensagemDeSemRegistro', () => {
  const mensagem = montarMensagemDeSemRegistro(
    { id: 'm2', nome: 'Ana Souza', telefone: '+5511988887777' },
    '2026-08-28',
    LINK_APP,
  );

  it('chama a pessoa pelo nome e diz de que dia se trata', () => {
    expect(mensagem).toContain('Ana Souza');
    expect(mensagem).toContain('28/08/2026');
  });

  it('abre saída para quem estava de folga', () => {
    // Sem esta frase, o motorista de folga entende que o sistema está errado —
    // e sistema que cobra sem motivo é sistema que se aprende a ignorar.
    expect(mensagem).toContain('pode ignorar esta mensagem');
  });
});

describe('montarMensagemConsolidada', () => {
  const LINK_PAINEL = montarLinkDasPendencias(APP, '2026-08-28');

  it('traz as duas listas com as respectivas contagens', () => {
    const mensagem = montarMensagemConsolidada(
      pendencias({
        jornadasEmAberto: [
          jornada(),
          jornada({
            id: 'j2',
            motorista: { id: 'm3', nome: 'Bia Lima', telefone: '+5511977776666' },
          }),
        ],
        motoristasSemRegistro: [{ id: 'm2', nome: 'Ana Souza', telefone: '+5511988887777' }],
      }),
      LINK_PAINEL,
    );

    expect(mensagem).toContain('*Dias não encerrados:* 2');
    expect(mensagem).toContain('• Carlos Pereira · van ABC-1234 · desde 07:15');
    expect(mensagem).toContain('*Sem registro no dia:* 1');
    expect(mensagem).toContain('• Ana Souza');
    expect(mensagem).toContain('/admin/pendencias?data=2026-08-28');
  });

  it('omite a seção que está vazia', () => {
    const mensagem = montarMensagemConsolidada(
      pendencias({ motoristasSemRegistro: [{ id: 'm2', nome: 'Ana Souza', telefone: '+55119' }] }),
      LINK_PAINEL,
    );

    expect(mensagem).not.toContain('Dias não encerrados');
    expect(mensagem).toContain('Sem registro no dia');
  });

  it('marca a jornada arrastada de outro dia pela data, não pela hora', () => {
    const mensagem = montarMensagemConsolidada(
      pendencias({
        jornadasEmAberto: [
          jornada({ data: '2026-08-26', iniciadaEm: new Date('2026-08-26T10:15:00Z') }),
        ],
      }),
      LINK_PAINEL,
    );

    // "desde 07:15" seria enganoso três dias depois.
    expect(mensagem).toContain('aberto desde 26/08/2026');
    expect(mensagem).not.toContain('desde 07:15');
  });

  it('sinaliza a corrida em andamento na lista da administração', () => {
    const mensagem = montarMensagemConsolidada(
      pendencias({ jornadasEmAberto: [jornada({ temCorridaEmAndamento: true })] }),
      LINK_PAINEL,
    );

    expect(mensagem).toContain('· corrida em andamento');
  });

  it('corta a lista longa e diz quantos ficaram de fora', () => {
    // Uma frota inteira num dia ruim produziria uma mensagem que ninguém lê e
    // que o provedor pode recusar por tamanho.
    const excedente = 5;
    const muitos = Array.from({ length: MAXIMO_DE_ITENS_NA_MENSAGEM + excedente }, (_, indice) => ({
      id: `m${indice}`,
      nome: `Motorista ${indice}`,
      telefone: '+5511988887777',
    }));

    const mensagem = montarMensagemConsolidada(
      pendencias({ motoristasSemRegistro: muitos }),
      LINK_PAINEL,
    );

    expect(mensagem).toContain(`*Sem registro no dia:* ${muitos.length}`);
    expect(mensagem).toContain('Motorista 0');
    expect(mensagem).toContain(`• … e mais ${excedente}.`);
    expect(mensagem).not.toContain(`Motorista ${MAXIMO_DE_ITENS_NA_MENSAGEM}`);
  });
});

describe('montagem dos links', () => {
  it('não duplica a barra final da APP_URL', () => {
    expect(montarLinkDoAplicativo('https://exemplo.com/')).toBe('https://exemplo.com/app');
    expect(montarLinkDasPendencias('https://exemplo.com//', '2026-08-28')).toBe(
      'https://exemplo.com/admin/pendencias?data=2026-08-28',
    );
  });
});
