import { describe, expect, it } from 'vitest';
import {
  LIMITE_LINHAS_EM_SEGUNDO_PLANO,
  LIMITE_LINHAS_SINCRONO,
  MAXIMO_DE_TENTATIVAS,
  ROTULO_DO_STATUS_DA_TAREFA,
  STATUS_DA_TAREFA,
  TAMANHO_DA_PAGINA,
  decidirModoDeGeracao,
  mensagemDeExportacaoFalhada,
  mensagemDeExportacaoPronta,
  podeTentarDeNovo,
  tarefaEmAndamento,
} from '@/modulos/exportacao/exportacao.regras';

/** US031 — admissão da exportação grande e ciclo de vida da tarefa. */

describe('decidirModoDeGeracao', () => {
  it('gera na hora até o limite síncrono, inclusive', () => {
    expect(decidirModoDeGeracao(1)).toBe('sincrono');
    expect(decidirModoDeGeracao(LIMITE_LINHAS_SINCRONO)).toBe('sincrono');
  });

  it('manda para segundo plano a partir da primeira linha acima', () => {
    // A fronteira é o defeito clássico deste tipo de regra: um `>=` no lugar do
    // `>` mandaria para a fila exatamente o recorte que ainda cabe na
    // requisição, e o usuário esperaria um minuto por uma planilha que sairia
    // na hora.
    expect(decidirModoDeGeracao(LIMITE_LINHAS_SINCRONO + 1)).toBe('segundo-plano');
    expect(decidirModoDeGeracao(50_000)).toBe('segundo-plano');
    expect(decidirModoDeGeracao(LIMITE_LINHAS_EM_SEGUNDO_PLANO)).toBe('segundo-plano');
  });

  it('recusa acima do teto absoluto', () => {
    // Segundo plano não é "sem limite": passar disso não é pedido, é engano de
    // filtro, e uma planilha assim o Excel abre com dificuldade.
    expect(decidirModoDeGeracao(LIMITE_LINHAS_EM_SEGUNDO_PLANO + 1)).toBe('recusado');
  });

  it('o teto do segundo plano é maior que o da geração imediata', () => {
    // Invertê-los tornaria a faixa de segundo plano vazia, e toda exportação
    // grande passaria a ser recusada de novo — que é exatamente a dívida que
    // esta funcionalidade fecha.
    expect(LIMITE_LINHAS_EM_SEGUNDO_PLANO).toBeGreaterThan(LIMITE_LINHAS_SINCRONO);
  });
});

describe('paginação da leitura', () => {
  it('a página é menor que o limite síncrono', () => {
    // Se a página fosse maior, o caminho em segundo plano leria de uma vez mais
    // do que o síncrono inteiro — e o ponto dele é justamente não carregar tudo.
    expect(TAMANHO_DA_PAGINA).toBeLessThan(LIMITE_LINHAS_SINCRONO);
  });
});

describe('ciclo de vida da tarefa', () => {
  it('pendente e processando ainda estão em andamento', () => {
    expect(tarefaEmAndamento('PENDENTE')).toBe(true);
    expect(tarefaEmAndamento('PROCESSANDO')).toBe(true);
  });

  it('concluída e falha são desfechos, não espera', () => {
    // É o que decide a tela parar de perguntar: tratar `FALHA` como andamento
    // deixaria o botão consultando para sempre uma planilha que não vem.
    expect(tarefaEmAndamento('CONCLUIDA')).toBe(false);
    expect(tarefaEmAndamento('FALHA')).toBe(false);
  });

  it('todo status tem rótulo em português', () => {
    for (const status of STATUS_DA_TAREFA) {
      expect(ROTULO_DO_STATUS_DA_TAREFA[status]).toBeTruthy();
    }
  });
});

describe('podeTentarDeNovo', () => {
  it('permite novas tentativas até o máximo', () => {
    expect(podeTentarDeNovo(1)).toBe(true);
    expect(podeTentarDeNovo(MAXIMO_DE_TENTATIVAS - 1)).toBe(true);
  });

  it('desiste ao alcançar o máximo', () => {
    // A contagem é incrementada **na reclamação**, antes da geração: na
    // terceira falha o valor lido já é 3, e insistir deixaria a tela dizendo
    // "gerando" indefinidamente.
    expect(podeTentarDeNovo(MAXIMO_DE_TENTATIVAS)).toBe(false);
    expect(podeTentarDeNovo(MAXIMO_DE_TENTATIVAS + 1)).toBe(false);
  });
});

describe('mensagens ao solicitante', () => {
  it('a de pronta diz o tamanho e o nome do arquivo', () => {
    const mensagem = mensagemDeExportacaoPronta({
      tipo: 'CORRIDAS',
      linhas: 12_450,
      nome: 'bordo_corridas_2026-08-28.xlsx',
    });

    // O número é o que distingue a planilha certa da gerada com o filtro pela
    // metade: quem pediu o ano inteiro precisa saber se recebeu o ano inteiro.
    expect(mensagem).toContain('12.450');
    expect(mensagem).toContain('bordo_corridas_2026-08-28.xlsx');
    expect(mensagem).toContain('corridas');
  });

  it('a de falha carrega o motivo', () => {
    const mensagem = mensagemDeExportacaoFalhada({
      tipo: 'JORNADAS',
      motivo: 'Sem espaço em disco.',
    });

    expect(mensagem).toContain('Sem espaço em disco.');
    expect(mensagem).toContain('jornadas');
  });
});
