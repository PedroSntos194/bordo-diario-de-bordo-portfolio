import { describe, expect, it } from 'vitest';
import {
  escolherDestinatarios,
  montarLinkDaJornada,
  montarLinkWaMe,
  montarMensagemDoResumo,
  type JornadaDoResumoEnviado,
} from '@/modulos/notificacao/notificacao.regras';

/** US036 — o texto e o link do resumo do dia (V-05a). */

const JORNADA: JornadaDoResumoEnviado = {
  data: '2026-08-23',
  motorista: { nome: 'Carlos Pereira' },
  veiculo: { placa: 'ABC1234' },
  // 18:35 em São Paulo.
  iniciadaEm: new Date('2026-08-23T21:35:00Z'),
  encerradaEm: new Date('2026-08-24T01:10:00Z'),
  odometroInicial: 160400,
  odometroFinal: 160445,
  kmTotal: '32.5',
  totalCorridas: 2,
  totalPassageiros: 25,
  duracaoMinutos: 215,
  observacoes: null,
  corridas: [
    {
      status: 'ENCERRADA',
      iniciadaEm: new Date('2026-08-23T21:35:00Z'),
      encerradaEm: new Date('2026-08-23T22:40:00Z'),
      kmPercorrido: '20',
      quantidadePassageiros: 15,
      rota: { codigo: 'R-014', nome: 'Centro → Fábrica' },
      origemDescricao: null,
      destinoDescricao: null,
    },
    {
      status: 'CANCELADA',
      iniciadaEm: new Date('2026-08-23T23:00:00Z'),
      encerradaEm: null,
      kmPercorrido: null,
      quantidadePassageiros: null,
      rota: null,
      origemDescricao: 'Terminal',
      destinoDescricao: 'Portaria 2',
    },
  ],
};

const LINK = 'https://bordo.exemplo.com.br/admin/jornadas/abc-123';

describe('montarMensagemDoResumo', () => {
  const mensagem = montarMensagemDoResumo(JORNADA, LINK);

  it('traz tudo o que o critério de aceitação exige', () => {
    expect(mensagem).toContain('*Data:* 23/08/2026');
    expect(mensagem).toContain('*Motorista:* Carlos Pereira');
    expect(mensagem).toContain('*Veículo:* ABC-1234');
    expect(mensagem).toContain('*Corridas:* 2');
    expect(mensagem).toContain('*Km rodado:* 32,5 km');
    expect(mensagem).toContain('*Jornada:* 18:35 às 22:10');
    expect(mensagem).toContain(LINK);
  });

  it('lista apenas as corridas encerradas', () => {
    // RN017 — corrida cancelada não compõe o resumo; incluí-la faria o
    // administrador somar km que não existiram.
    //
    // A linha traz o **nome** da rota, não o código: quem lê é uma pessoa no
    // WhatsApp, e "R-014" não diz para onde a van foi.
    expect(mensagem).toContain('• 18:35 · Centro → Fábrica · 20,0 km');
    expect(mensagem).not.toContain('Portaria 2');
  });

  it('omite a seção de observações quando não há', () => {
    expect(mensagem).not.toContain('*Observações:*');
    expect(montarMensagemDoResumo({ ...JORNADA, observacoes: '  ' }, LINK)).not.toContain(
      '*Observações:*',
    );
    expect(montarMensagemDoResumo({ ...JORNADA, observacoes: 'Pneu furado' }, LINK)).toContain(
      '*Observações:* Pneu furado',
    );
  });

  it('termina no link, que é a última coisa em que se toca', () => {
    expect(mensagem.trimEnd().endsWith(LINK)).toBe(true);
  });
});

describe('montarLinkWaMe', () => {
  it('usa o número sem pontuação, como o wa.me exige', () => {
    const link = montarLinkWaMe('+55 (11) 98888-7777', 'oi');

    expect(link.startsWith('https://wa.me/5511988887777?text=')).toBe(true);
  });

  it('codifica espaço como %20, e não como +', () => {
    // `URLSearchParams` converteria em `+`, e o WhatsApp mostraria os sinais
    // literais dentro do texto da mensagem.
    const link = montarLinkWaMe('+5511988887777', 'Resumo do dia');

    expect(link).toContain('Resumo%20do%20dia');
    expect(link).not.toContain('+Resumo');
  });

  it('preserva as quebras de linha da mensagem', () => {
    expect(montarLinkWaMe('+5511988887777', 'a\nb')).toContain('a%0Ab');
  });
});

describe('montarLinkDaJornada', () => {
  it('não duplica a barra quando a APP_URL termina em barra', () => {
    expect(montarLinkDaJornada('https://bordo.exemplo.com.br/', 'abc')).toBe(
      'https://bordo.exemplo.com.br/admin/jornadas/abc',
    );
  });
});

describe('escolherDestinatarios', () => {
  const admins = [
    { id: 'u1', nome: 'Ana', telefone: '+5511988887777' },
    { id: 'u2', nome: 'Bruno', telefone: '(21) 97777-6666' },
  ];

  it('prefere os telefones configurados', () => {
    const escolhidos = escolherDestinatarios(['11 98888-7777'], admins);

    expect(escolhidos).toHaveLength(1);
    expect(escolhidos[0]?.telefone).toBe('+5511988887777');
    expect(escolhidos[0]?.usuarioId).toBeNull();
  });

  it('cai para os administradores quando não há configuração', () => {
    const escolhidos = escolherDestinatarios([], admins);

    expect(escolhidos.map((item) => item.nome)).toEqual(['Ana', 'Bruno']);
    expect(escolhidos[1]?.telefone).toBe('+5521977776666');
  });

  it('descarta número inválido sem derrubar os demais', () => {
    // Um cadastro ruim entre cinco não pode impedir os outros quatro de
    // receberem — é o mesmo espírito do RN028.
    const escolhidos = escolherDestinatarios(
      [],
      [{ id: 'u0', nome: 'Placeholder', telefone: '+5500000000000' }, ...admins],
    );

    expect(escolhidos.map((item) => item.nome)).toEqual(['Ana', 'Bruno']);
  });

  it('devolve vazio quando ninguém tem telefone discável', () => {
    expect(escolherDestinatarios([], [{ id: 'u0', nome: 'X', telefone: '000' }])).toEqual([]);
  });
});
