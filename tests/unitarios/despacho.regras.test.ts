import { describe, expect, it } from 'vitest';
import {
  DIA_DO_EXPURGO,
  HORA_DO_EXPURGO,
  HORA_DO_FECHAMENTO,
  ROTINAS,
  ROTULO_DA_ROTINA,
  horaDoHorario,
  rotinasDevidas,
} from '@/servidor/despacho.regras';

/** US033 · AD-9 — o agendador fora de um processo residente. */

const HORARIOS = {
  horarioConsolidado: '23:00',
  horarioAlertaPendencia: '20:00',
  cicloDiaInicio: 16,
};

/** Uma segunda-feira qualquer, para os casos que não são de fim de semana. */
function segunda(hora: number) {
  return { hora, diaDaSemana: 1, diaDoMes: 5 };
}

describe('horaDoHorario', () => {
  it('extrai a hora de um HH:MM válido', () => {
    expect(horaDoHorario('23:00', 0)).toBe(23);
    expect(horaDoHorario('07:45', 0)).toBe(7);
    expect(horaDoHorario('00:30', 9)).toBe(0);
  });

  it('cai no padrão quando o valor é inválido', () => {
    // Configuração ruim não pode significar rotina que nunca roda — o mesmo
    // princípio do `cronDoHorario`, que isto substitui.
    expect(horaDoHorario('vinte e três', 23)).toBe(23);
    expect(horaDoHorario('25:00', 23)).toBe(23);
    expect(horaDoHorario('', 20)).toBe(20);
  });

  it('tolera espaço em volta', () => {
    expect(horaDoHorario('  22:00  ', 23)).toBe(22);
  });
});

describe('rotinasDevidas', () => {
  it('as duas filas rodam em toda passagem', () => {
    // Fila que não encontra nada é o resultado normal, não falha. Se elas
    // dependessem de horário, uma exportação pedida às 10h esperaria até a
    // noite.
    const devidas = rotinasDevidas(segunda(10), HORARIOS);

    expect(devidas).toContain('exportacoes');
    expect(devidas).toContain('notificacoes');
    expect(devidas).not.toContain('consolidado');
    expect(devidas).not.toContain('pendencias');
    expect(devidas).not.toContain('expurgo');
  });

  it('o consolidado vence na hora configurada', () => {
    expect(rotinasDevidas(segunda(23), HORARIOS)).toContain('consolidado');
    expect(rotinasDevidas(segunda(22), HORARIOS)).not.toContain('consolidado');
  });

  it('a cobrança de pendências vence na hora dela', () => {
    expect(rotinasDevidas(segunda(20), HORARIOS)).toContain('pendencias');
    expect(rotinasDevidas(segunda(23), HORARIOS)).not.toContain('pendencias');
  });

  it('segue o horário configurado, não o padrão', () => {
    // É o requisito RF040: o administrador muda o fechamento sem depender de
    // deploy. Uma expressão de cron no `vercel.json` não conseguiria isso.
    const outros = { ...HORARIOS, horarioConsolidado: '21:00', horarioAlertaPendencia: '18:00' };

    expect(rotinasDevidas(segunda(21), outros)).toContain('consolidado');
    expect(rotinasDevidas(segunda(23), outros)).not.toContain('consolidado');
    expect(rotinasDevidas(segunda(18), outros)).toContain('pendencias');
  });

  it('cobra as pendências antes de fechar o dia quando caem na mesma hora', () => {
    // Cobrar pendência de um dia já consolidado seria cobrar o que não tem
    // mais conserto.
    const juntos = { ...HORARIOS, horarioConsolidado: '22:00', horarioAlertaPendencia: '22:00' };
    const devidas = rotinasDevidas(segunda(22), juntos);

    expect(devidas.indexOf('pendencias')).toBeLessThan(devidas.indexOf('consolidado'));
  });

  it('o expurgo só vence domingo de madrugada', () => {
    expect(
      rotinasDevidas({ hora: HORA_DO_EXPURGO, diaDaSemana: DIA_DO_EXPURGO, diaDoMes: 5 }, HORARIOS),
    ).toContain('expurgo');
  });

  it('o expurgo não vence na mesma hora em outro dia', () => {
    // O dia importa tanto quanto a hora: apagar centenas de milhares de linhas
    // toda madrugada seria varrer a base sete vezes por semana.
    expect(
      rotinasDevidas({ hora: HORA_DO_EXPURGO, diaDaSemana: 3, diaDoMes: 5 }, HORARIOS),
    ).not.toContain('expurgo');
  });

  it('o expurgo não vence em outra hora do domingo', () => {
    expect(
      rotinasDevidas({ hora: 14, diaDaSemana: DIA_DO_EXPURGO, diaDoMes: 5 }, HORARIOS),
    ).not.toContain('expurgo');
  });

  it('nunca devolve a mesma rotina duas vezes', () => {
    // Uma rotina repetida na lista a executaria duas vezes na mesma passagem.
    for (let hora = 0; hora < 24; hora += 1) {
      for (let dia = 0; dia < 7; dia += 1) {
        const devidas = rotinasDevidas({ hora, diaDaSemana: dia, diaDoMes: 5 + dia }, HORARIOS);
        expect(new Set(devidas).size).toBe(devidas.length);
      }
    }
  });

  it('só devolve rotinas conhecidas', () => {
    for (let hora = 0; hora < 24; hora += 1) {
      for (const rotina of rotinasDevidas({ hora, diaDaSemana: 0, diaDoMes: 16 }, HORARIOS)) {
        expect(ROTINAS).toContain(rotina);
      }
    }
  });

  it('toda rotina tem rótulo em português', () => {
    for (const rotina of ROTINAS) {
      expect(ROTULO_DA_ROTINA[rotina]).toBeTruthy();
    }
  });

  it('ao longo de uma semana, cada rotina de horário vence o número certo de vezes', () => {
    // A verificação que pega o erro mais caro: uma rotina diária que virasse
    // horária geraria 24 planilhas por dia, e ninguém olharia a lista de
    // arquivos até o disco encher.
    const contagem: Record<string, number> = {};

    for (let dia = 0; dia < 7; dia += 1) {
      for (let hora = 0; hora < 24; hora += 1) {
        for (const rotina of rotinasDevidas(
          { hora, diaDaSemana: dia, diaDoMes: 5 + dia },
          HORARIOS,
        )) {
          contagem[rotina] = (contagem[rotina] ?? 0) + 1;
        }
      }
    }

    expect(contagem.consolidado).toBe(7);
    expect(contagem.pendencias).toBe(7);
    expect(contagem.expurgo).toBe(1);
    expect(contagem.exportacoes).toBe(168);
    expect(contagem.notificacoes).toBe(168);
    expect(contagem.fechamento).toBeUndefined();
  });
});

describe('fechamento do mês', () => {
  it('vence uma vez por mês, no dia em que o ciclo vira', () => {
    const vezes: string[] = [];
    for (let dia = 1; dia <= 31; dia += 1) {
      for (let hora = 0; hora < 24; hora += 1) {
        if (
          rotinasDevidas({ hora, diaDaSemana: dia % 7, diaDoMes: dia }, HORARIOS).includes(
            'fechamento',
          )
        ) {
          vezes.push(`${dia} ${hora}h`);
        }
      }
    }
    expect(vezes).toEqual([`16 ${HORA_DO_FECHAMENTO}h`]);
  });

  it('depois do fim do turno da noite, não à meia-noite', () => {
    // O turno da noite termina às 7h: gerar antes deixaria o dia 15 aberto.
    expect(HORA_DO_FECHAMENTO).toBeGreaterThan(7);
  });

  it('segue o dia de início configurado', () => {
    const dia1 = { ...HORARIOS, cicloDiaInicio: 1 };
    expect(
      rotinasDevidas({ hora: HORA_DO_FECHAMENTO, diaDaSemana: 2, diaDoMes: 1 }, dia1),
    ).toContain('fechamento');
    expect(
      rotinasDevidas({ hora: HORA_DO_FECHAMENTO, diaDaSemana: 2, diaDoMes: 16 }, dia1),
    ).not.toContain('fechamento');
  });
});
