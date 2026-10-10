import { describe, expect, it } from 'vitest';
import { CodigoErro, ehErroDaAplicacao } from '@/lib/erros';
import {
  LIMITE_DE_LINHAS,
  MODELOS,
  TAMANHO_MAXIMO_BYTES,
  analisarLinhas,
  ehCsv,
  ehLinhaDeExemplo,
  lerCsv,
  prepararValor,
  validarArquivo,
  validarCabecalho,
  validarQuantidadeDeLinhas,
} from '@/modulos/importacao/importacao.regras';

/** US015 — estrutura do arquivo (RN031) e validação linha a linha (RN032). */

const USUARIO = MODELOS.USUARIO;
const VEICULO = MODELOS.VEICULO;
const ROTA = MODELOS.ROTA;

const CABECALHO_DE_USUARIO = USUARIO.colunas.map((coluna) => coluna.cabecalho);

/** Uma linha de usuário válida, na ordem das colunas do modelo. */
function linhaDeUsuario(sobrescritas: Partial<Record<string, string>> = {}): string[] {
  const base: Record<string, string> = {
    nome: 'Ana Souza',
    cpf: '529.982.247-25',
    telefone: '(11) 99999-8888',
    perfil: 'MOTORISTA',
    email: '',
    matricula: '',
    cnhNumero: '',
    cnhCategoria: '',
    cnhValidade: '',
    ...sobrescritas,
  };

  return USUARIO.colunas.map((coluna) => base[coluna.chave] ?? '');
}

function codigoDoErro(executar: () => void): string | null {
  try {
    executar();
    return null;
  } catch (erro) {
    return ehErroDaAplicacao(erro) ? erro.codigo : 'DESCONHECIDO';
  }
}

describe('validarArquivo', () => {
  it('aceita .xlsx e .csv', () => {
    expect(codigoDoErro(() => validarArquivo({ nome: 'carga.xlsx', tamanhoBytes: 1000 }))).toBe(
      null,
    );
    expect(codigoDoErro(() => validarArquivo({ nome: 'CARGA.CSV', tamanhoBytes: 1000 }))).toBe(
      null,
    );
  });

  it('recusa outro formato, mesmo com nome parecido', () => {
    // `accept` no campo de arquivo é sugestão ao seletor, não validação: um
    // `.pdf` arrastado passa por ele sem reclamar.
    expect(codigoDoErro(() => validarArquivo({ nome: 'carga.pdf', tamanhoBytes: 1000 }))).toBe(
      CodigoErro.TIPO_ARQUIVO_NAO_PERMITIDO,
    );
    expect(codigoDoErro(() => validarArquivo({ nome: 'carga.xlsx.exe', tamanhoBytes: 1000 }))).toBe(
      CodigoErro.TIPO_ARQUIVO_NAO_PERMITIDO,
    );
  });

  it('recusa acima de 5 MB e recusa arquivo vazio', () => {
    expect(
      codigoDoErro(() =>
        validarArquivo({ nome: 'carga.xlsx', tamanhoBytes: TAMANHO_MAXIMO_BYTES + 1 }),
      ),
    ).toBe(CodigoErro.ARQUIVO_MUITO_GRANDE);

    expect(codigoDoErro(() => validarArquivo({ nome: 'carga.xlsx', tamanhoBytes: 0 }))).toBe(
      CodigoErro.DADOS_INVALIDOS,
    );
  });

  it('reconhece o csv pela extensão', () => {
    expect(ehCsv('carga.CSV')).toBe(true);
    expect(ehCsv('carga.xlsx')).toBe(false);
  });
});

describe('validarCabecalho', () => {
  it('aceita o cabeçalho do modelo', () => {
    expect(codigoDoErro(() => validarCabecalho(USUARIO, CABECALHO_DE_USUARIO))).toBe(null);
  });

  it('tolera caixa, acento e espaço sobrando', () => {
    // Quem digitou "cpf" em vez de "CPF" não errou o arquivo, errou a
    // formatação. Rejeitar por isso seria pedantismo.
    const bagunçado = CABECALHO_DE_USUARIO.map((cabecalho) => ` ${cabecalho.toUpperCase()} `).map(
      (cabecalho) => cabecalho.normalize('NFD').replace(/[̀-ͯ]/g, ''),
    );

    expect(codigoDoErro(() => validarCabecalho(USUARIO, bagunçado))).toBe(null);
  });

  it('ignora colunas vazias sobrando à direita', () => {
    expect(codigoDoErro(() => validarCabecalho(USUARIO, [...CABECALHO_DE_USUARIO, '', '']))).toBe(
      null,
    );
  });

  it('recusa o arquivo inteiro quando falta coluna (RN031)', () => {
    const semCpf = CABECALHO_DE_USUARIO.filter((cabecalho) => cabecalho !== 'CPF');
    let mensagem = '';

    try {
      validarCabecalho(USUARIO, semCpf);
    } catch (erro) {
      mensagem = ehErroDaAplicacao(erro) ? erro.message : '';
      expect(ehErroDaAplicacao(erro) && erro.codigo).toBe(CodigoErro.CABECALHO_INVALIDO);
    }

    expect(mensagem).toContain('faltando: CPF');
    expect(mensagem).toContain('Nenhuma linha foi importada');
  });

  it('aponta a coluna que não pertence ao modelo', () => {
    let mensagem = '';
    try {
      validarCabecalho(USUARIO, [...CABECALHO_DE_USUARIO, 'Salário']);
    } catch (erro) {
      mensagem = ehErroDaAplicacao(erro) ? erro.message : '';
    }

    expect(mensagem).toContain('não reconhecida: Salário');
  });

  it('recusa a planilha certa do tipo errado', () => {
    // Trocar "usuários" por "veículos" no seletor é o engano mais provável da
    // tela, e as duas planilhas existem lado a lado na mesma pasta.
    expect(
      codigoDoErro(() =>
        validarCabecalho(
          USUARIO,
          VEICULO.colunas.map((coluna) => coluna.cabecalho),
        ),
      ),
    ).toBe(CodigoErro.CABECALHO_INVALIDO);
  });

  it('recusa as colunas certas fora de ordem', () => {
    const invertido = [...CABECALHO_DE_USUARIO].reverse();
    expect(codigoDoErro(() => validarCabecalho(USUARIO, invertido))).toBe(
      CodigoErro.CABECALHO_INVALIDO,
    );
  });
});

describe('validarQuantidadeDeLinhas', () => {
  it('recusa planilha só com cabeçalho', () => {
    expect(codigoDoErro(() => validarQuantidadeDeLinhas(0))).toBe(CodigoErro.DADOS_INVALIDOS);
  });

  it('recusa acima do teto', () => {
    expect(codigoDoErro(() => validarQuantidadeDeLinhas(LIMITE_DE_LINHAS + 1))).toBe(
      CodigoErro.PERIODO_MUITO_LONGO,
    );
    expect(codigoDoErro(() => validarQuantidadeDeLinhas(LIMITE_DE_LINHAS))).toBe(null);
  });
});

describe('lerCsv', () => {
  it('lê o separador ponto e vírgula do Excel brasileiro', () => {
    expect(lerCsv('Nome;CPF\nAna;123')).toEqual([
      ['Nome', 'CPF'],
      ['Ana', '123'],
    ]);
  });

  it('lê o separador vírgula quando ele domina a primeira linha', () => {
    expect(lerCsv('Nome,CPF\nAna,123')).toEqual([
      ['Nome', 'CPF'],
      ['Ana', '123'],
    ]);
  });

  it('descarta o BOM que o Excel escreve no começo do arquivo', () => {
    // Sem isso o primeiro cabeçalho nunca casa, e o arquivo inteiro é recusado
    // por um caractere invisível.
    const [primeira] = lerCsv('﻿Nome;CPF\nAna;123');
    expect(primeira?.[0]).toBe('Nome');
  });

  it('respeita aspas, separador dentro do campo e aspas escapadas', () => {
    expect(lerCsv('Nome;Obs\n"Souza, Ana";"disse ""ok"""')).toEqual([
      ['Nome', 'Obs'],
      ['Souza, Ana', 'disse "ok"'],
    ]);
  });

  it('ignora linhas em branco e finais de linha do Windows', () => {
    expect(lerCsv('Nome;CPF\r\nAna;123\r\n\r\n')).toEqual([
      ['Nome', 'CPF'],
      ['Ana', '123'],
    ]);
  });
});

describe('prepararValor', () => {
  const turno = ROTA.colunas.find((coluna) => coluna.chave === 'turno')!;
  const distancia = ROTA.colunas.find((coluna) => coluna.chave === 'distanciaEstimadaKm')!;
  const validade = USUARIO.colunas.find((coluna) => coluna.chave === 'cnhValidade')!;

  it('normaliza enum com acento e espaço', () => {
    expect(prepararValor(turno, ' Manhã ')).toBe('MANHA');
    expect(prepararValor(turno, 'integral')).toBe('INTEGRAL');
  });

  it('aceita vírgula decimal e ponto de milhar', () => {
    expect(prepararValor(distancia, '32,5')).toBe('32.5');
    expect(prepararValor(distancia, '1.234,5')).toBe('1234.5');
  });

  it('aceita data brasileira e ISO', () => {
    expect(prepararValor(validade, '30/05/2029')).toBe('2029-05-30');
    expect(prepararValor(validade, '2029-05-30T00:00:00.000Z')).toBe('2029-05-30');
  });

  it('devolve vazio para célula em branco', () => {
    expect(prepararValor(validade, '   ')).toBe('');
  });
});

describe('analisarLinhas', () => {
  it('separa as boas das ruins sem uma atrapalhar a outra (RN032)', () => {
    const analise = analisarLinhas(USUARIO, [
      linhaDeUsuario(),
      linhaDeUsuario({ cpf: '111.111.111-11', nome: 'Bia Lima' }),
      linhaDeUsuario({ cpf: '168.995.350-09', nome: 'Caio Dias' }),
    ]);

    expect(analise.linhasTotal).toBe(3);
    expect(analise.validas).toHaveLength(2);
    expect(analise.invalidas).toHaveLength(1);
  });

  it('numera a linha como ela aparece no Excel', () => {
    // O cabeçalho é a linha 1; o primeiro registro é a 2. É esse número que a
    // pessoa vê na barra lateral ao ir corrigir.
    const analise = analisarLinhas(USUARIO, [
      linhaDeUsuario({ cpf: '111.111.111-11' }),
      linhaDeUsuario(),
    ]);

    expect(analise.invalidas[0]?.linha).toBe(2);
    expect(analise.validas[0]?.linha).toBe(3);
  });

  it('diz a coluna e o motivo, com o rótulo que está na planilha', () => {
    const analise = analisarLinhas(USUARIO, [linhaDeUsuario({ cpf: '111.111.111-11' })]);

    expect(analise.invalidas[0]?.coluna).toBe('CPF');
    expect(analise.invalidas[0]?.valor).toBe('111.111.111-11');
    expect(analise.invalidas[0]?.motivo).toContain('CPF inválido');
  });

  it('identifica a linha recusada pelo que ela é, não pelo campo que falhou', () => {
    // Sem isto, a linha recusada por telefone apareceria no relatório com o
    // telefone embaixo do cabeçalho "CPF".
    const analise = analisarLinhas(USUARIO, [
      linhaDeUsuario({ telefone: 'telefone ruim', nome: 'Diego Alves' }),
    ]);

    expect(analise.invalidas[0]?.coluna).toBe('Telefone');
    expect(analise.invalidas[0]?.identificacao).toBe('529.982.247-25');
    expect(analise.invalidas[0]?.descricao).toBe('Diego Alves');
  });

  it('recusa a repetição dentro do próprio arquivo, apontando a primeira linha', () => {
    // Sem esta verificação a constraint do banco derrubaria a transação inteira,
    // levando junto as linhas boas — o oposto da RN032.
    const analise = analisarLinhas(USUARIO, [linhaDeUsuario(), linhaDeUsuario()]);

    expect(analise.validas).toHaveLength(1);
    expect(analise.invalidas[0]?.linha).toBe(3);
    expect(analise.invalidas[0]?.motivo).toBe('Repetido: a linha 2 já usa este valor.');
  });

  it('normaliza como o formulário normaliza — mesmo esquema Zod', () => {
    const analise = analisarLinhas(USUARIO, [linhaDeUsuario()]);

    expect(analise.validas[0]?.dados.cpf).toBe('52998224725');
    expect(analise.validas[0]?.dados.telefone).toBe('+5511999998888');
  });

  it('guarda o valor bruto ao lado do normalizado, para o relatório', () => {
    const analise = analisarLinhas(USUARIO, [linhaDeUsuario()]);
    expect(analise.validas[0]?.bruto.cpf).toBe('529.982.247-25');
  });

  it('aceita a planilha de veículos com placa e números do Excel', () => {
    const analise = analisarLinhas(VEICULO, [
      ['abc1d23', 'Sprinter 415', 'Mercedes-Benz', '2021', '15', '160400', ''],
    ]);

    expect(analise.invalidas).toHaveLength(0);
    expect(analise.validas[0]?.dados.placa).toBe('ABC1D23');
    expect(analise.validas[0]?.dados.capacidadePassageiros).toBe(15);
  });

  it('aceita a planilha de rotas com turno em português', () => {
    const analise = analisarLinhas(ROTA, [
      ['r-014', 'Centro → Fábrica', 'Terminal', 'Portaria 2', 'Manhã', '32,5'],
    ]);

    expect(analise.invalidas).toHaveLength(0);
    expect(analise.validas[0]?.dados.codigo).toBe('R-014');
    expect(analise.validas[0]?.dados.turno).toBe('MANHA');
    expect(analise.validas[0]?.dados.distanciaEstimadaKm).toBe(32.5);
  });

  it('trata célula faltando no fim da linha como campo vazio', () => {
    // O Excel não escreve as células finais em branco: a linha chega curta.
    const analise = analisarLinhas(ROTA, [
      ['R-022', 'Bairro → Fábrica', 'Praça', 'Portaria 1', 'TARDE'],
    ]);

    expect(analise.invalidas).toHaveLength(0);
  });
});

describe('ehLinhaDeExemplo', () => {
  it('reconhece o exemplo que veio no modelo', () => {
    const exemplo = USUARIO.colunas.map((coluna) => coluna.exemplo);
    expect(ehLinhaDeExemplo(USUARIO, exemplo)).toBe(true);
  });

  it('reconhece a tarja de aviso abaixo do exemplo', () => {
    expect(ehLinhaDeExemplo(USUARIO, ['↑ linha de exemplo — apague antes de importar'])).toBe(true);
  });

  it('não confunde um registro de verdade com o exemplo', () => {
    expect(ehLinhaDeExemplo(USUARIO, linhaDeUsuario())).toBe(false);
  });
});
