import type { Prisma, TipoDestinoImportacao } from '@prisma/client';
import { definirAcao, type ContextoDaAcao } from '@/lib/acao-segura';
import { armazenamento } from '@/lib/armazenamento';
import { CodigoErro, ErroDeConflito, ErroDeNegocio, ErroNaoEncontrado } from '@/lib/erros';
import { consumirLimite, LIMITES } from '@/lib/limite-requisicao';
import { logger } from '@/lib/logger';
import { montarPagina, paraIntervalo, type DadosPaginados } from '@/lib/paginacao';
import { gerarHashDeSenha, gerarSenhaTemporaria } from '@/lib/senha';
import { armazenarERegistrar } from '@/modulos/arquivo/arquivo.servico';
import { gerarPlanilha, gerarPlanilhaDeModelo, lerPlanilha } from '@/modulos/exportacao/planilha';
import { montarIdentificacao } from '@/modulos/exportacao/exportacao.regras';
import {
  buscarParaConfirmar,
  concluirImportacao,
  criarImportacao,
  listarImportacoes,
  type ImportacaoDaListagem,
} from '@/modulos/importacao/importacao.repositorio';
import {
  DIAS_DE_RETENCAO_DO_RELATORIO,
  MIME_XLSX,
  analisarLinhas,
  colunasDoRelatorio,
  ehCsv,
  ehLinhaDeExemplo,
  lerCsv,
  modeloDe,
  nomeDoModelo,
  nomeDoRelatorio,
  validarArquivo,
  validarCabecalho,
  validarQuantidadeDeLinhas,
  type LinhaComErro,
  type LinhaDoRelatorio,
  type ModeloDeImportacao,
  type TipoDeImportacao,
} from '@/modulos/importacao/importacao.regras';
import {
  esquemaAnalisarImportacao,
  esquemaConfirmarImportacao,
  esquemaListarImportacoes,
  esquemaTipoDeImportacao,
  type EntradaAnalisarImportacao,
  type EntradaConfirmarImportacao,
  type EntradaListarImportacoes,
  type EntradaTipoDeImportacao,
} from '@/modulos/importacao/importacao.schema';
import { chavesJaCadastradas, criarUsuario } from '@/modulos/usuario/usuario.repositorio';
import { criarVeiculo, placasJaCadastradas } from '@/modulos/veiculo/veiculo.repositorio';
import { codigosJaCadastrados, criarRota } from '@/modulos/rota/rota.repositorio';
import { expiracaoDaSenhaTemporaria } from '@/modulos/usuario/usuario.regras';
import { dataOperacional } from '@/utilitarios/data';

/**
 * Importação de cadastros por planilha (US015 · RF035 · RN031, RN032).
 *
 * O fluxo tem **duas etapas**, como o doc 16 especifica: analisar e confirmar.
 * Não é cerimônia — é o que permite a pessoa ver "52 entram, 8 têm problema"
 * *antes* de mexer no cadastro. Uma importação de mão única obrigaria a
 * descobrir os oito problemas depois de já ter criado os 52.
 *
 * A confirmação **revalida o arquivo inteiro** em vez de confiar na análise: um
 * CPF pode ter sido cadastrado à mão entre uma etapa e outra, e importar com
 * base numa foto antiga é como validar odômetro contra um valor em cache.
 */

// -------------------------------------------------------------- modelo

export interface ModeloParaDownload {
  nome: string;
  mimeType: string;
  conteudo: Buffer;
}

export const baixarModelo = definirAcao<EntradaTipoDeImportacao, ModeloParaDownload>({
  nome: 'importacao.modelo',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaTipoDeImportacao,
  executar: async ({ tipoDestino }) => {
    const modelo = modeloDe(tipoDestino);

    const conteudo = await gerarPlanilhaDeModelo({
      aba: modelo.aba,
      titulo: `Bordo · modelo de importação — ${modelo.rotulo}`,
      colunas: modelo.colunas.map((coluna) => ({
        cabecalho: coluna.cabecalho,
        largura: coluna.largura,
        exemplo: coluna.exemplo,
        obrigatoria: coluna.obrigatoria,
        ajuda: coluna.ajuda,
      })),
      observacoes: [
        'Preencha a primeira aba, uma linha por registro. Não mude, não renomeie e não reordene as colunas: ' +
          'o arquivo é reconhecido pelo cabeçalho, e um cabeçalho diferente faz o sistema recusar a planilha inteira.',
        'Apague a linha de exemplo antes de importar. Se ela ficar, o sistema a reconhece e a ignora — mas ' +
          'não conte com isso se você alterar algum valor dela.',
        'Linha com problema não impede as demais: as boas entram e as ruins voltam num relatório com o número ' +
          'da linha e o motivo, para você corrigir e reenviar só o que faltou.',
        'Também aceitamos .csv com as mesmas colunas, separado por ponto e vírgula.',
      ],
    });

    return { nome: nomeDoModelo(tipoDestino), mimeType: MIME_XLSX, conteudo };
  },
});

// -------------------------------------------------------------- análise

/** Quantos erros a tela mostra antes de mandar para o relatório. */
const ERROS_EXIBIDOS = 50;

export interface PreviaDaImportacao {
  importacaoId: string;
  tipoDestino: TipoDeImportacao;
  nomeArquivo: string;
  linhasTotal: number;
  linhasOk: number;
  linhasErro: number;
  erros: LinhaComErro[];
  /** Erros que não couberam na tela e estão só no relatório. */
  errosOmitidos: number;
  /** Linhas de exemplo do modelo que foram reconhecidas e descartadas. */
  exemplosIgnorados: number;
}

/**
 * Abre o arquivo e devolve as linhas como texto.
 *
 * O `.xlsx` procura a aba do modelo e cai na primeira; o `.csv` é lido por
 * `lerCsv`, que trata o separador `;` do Excel brasileiro e o BOM — dois
 * detalhes que, sozinhos, fariam todo arquivo exportado do Excel ser recusado
 * por "cabeçalho inválido".
 */
async function abrir(
  modelo: ModeloDeImportacao,
  nomeArquivo: string,
  conteudo: Buffer,
): Promise<string[][]> {
  if (ehCsv(nomeArquivo)) return lerCsv(conteudo.toString('utf8'));
  return lerPlanilha(conteudo, modelo.aba);
}

interface ArquivoAnalisado {
  linhasTotal: number;
  exemplosIgnorados: number;
  validas: { linha: number; dados: Record<string, unknown>; bruto: Record<string, string> }[];
  invalidas: LinhaComErro[];
}

/** Conferência estrutural e análise linha a linha — sem tocar no cadastro. */
async function conferir(
  modelo: ModeloDeImportacao,
  nomeArquivo: string,
  conteudo: Buffer,
): Promise<ArquivoAnalisado> {
  const linhas = await abrir(modelo, nomeArquivo, conteudo);

  if (linhas.length === 0) {
    throw new ErroDeNegocio(
      CodigoErro.CABECALHO_INVALIDO,
      'O arquivo está vazio ou não pôde ser lido como planilha. Baixe o modelo e preencha nele.',
      { arquivo: 'Arquivo ilegível.' },
    );
  }

  // RN031 — cabeçalho fora do modelo rejeita **antes** de qualquer gravação.
  validarCabecalho(modelo, linhas[0] ?? []);

  const corpoBruto = linhas.slice(1);
  const corpo = corpoBruto.filter((celulas) => !ehLinhaDeExemplo(modelo, celulas));
  const exemplosIgnorados = corpoBruto.length - corpo.length;

  validarQuantidadeDeLinhas(corpo.length);

  const analise = analisarLinhas(modelo, corpo);

  return {
    linhasTotal: analise.linhasTotal,
    exemplosIgnorados,
    validas: analise.validas,
    invalidas: analise.invalidas,
  };
}

export const analisar = definirAcao<EntradaAnalisarImportacao, PreviaDaImportacao>({
  nome: 'importacao.analisar',
  perfis: ['ADMIN'],
  esquema: esquemaAnalisarImportacao,
  executar: async (entrada, contexto) => {
    // Mesmo teto da exportação: abrir e validar planilha é caro, e uma tela
    // recarregada em laço derrubaria o processo que também atende o campo.
    consumirLimite(`importacao:${contexto.usuario.id}`, LIMITES.exportacao);

    const conteudo = Buffer.from(entrada.conteudo);

    validarArquivo({ nome: entrada.nomeArquivo, tamanhoBytes: conteudo.byteLength });

    const modelo = modeloDe(entrada.tipoDestino);
    const analise = await conferir(modelo, entrada.nomeArquivo, conteudo);

    // O arquivo enviado é guardado: a confirmação o relê para revalidar, e o
    // histórico precisa poder mostrar de onde a carga veio (RF036 · RN030).
    const arquivo = await armazenarERegistrar(contexto.tx, {
      tipo: 'IMPORTACAO',
      nome: entrada.nomeArquivo,
      mimeType: ehCsv(entrada.nomeArquivo) ? 'text/csv' : MIME_XLSX,
      extensao: ehCsv(entrada.nomeArquivo) ? 'csv' : 'xlsx',
      conteudo,
      parametros: {
        tipoDestino: entrada.tipoDestino,
        linhas: analise.linhasTotal,
      } as Prisma.InputJsonValue,
      geradoPor: contexto.usuario.id,
      geradoEm: new Date(),
    });

    const importacao = await criarImportacao(contexto.tx, {
      arquivoId: arquivo.id,
      tipoDestino: entrada.tipoDestino as TipoDestinoImportacao,
      linhasTotal: analise.linhasTotal,
      linhasOk: analise.validas.length,
      linhasErro: analise.invalidas.length,
      // RN032 — os erros ficam gravados por linha, e não só exibidos: quem
      // reabrir a importação amanhã precisa ver o mesmo que viu hoje.
      resultado: { erros: analise.invalidas } as unknown as Prisma.InputJsonValue,
      executadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'importacao',
      entidadeId: importacao.id,
      valorNovo: {
        tipoDestino: entrada.tipoDestino,
        arquivo: entrada.nomeArquivo,
        linhasTotal: analise.linhasTotal,
        linhasOk: analise.validas.length,
        linhasErro: analise.invalidas.length,
      },
    });

    return {
      importacaoId: importacao.id,
      tipoDestino: entrada.tipoDestino,
      nomeArquivo: entrada.nomeArquivo,
      linhasTotal: analise.linhasTotal,
      linhasOk: analise.validas.length,
      linhasErro: analise.invalidas.length,
      erros: analise.invalidas.slice(0, ERROS_EXIBIDOS),
      errosOmitidos: Math.max(0, analise.invalidas.length - ERROS_EXIBIDOS),
      exemplosIgnorados: analise.exemplosIgnorados,
    };
  },
});

// ----------------------------------------------------------- confirmação

/**
 * Grava as linhas válidas, separando as que colidem com o cadastro atual.
 *
 * A verificação de duplicidade vem **antes** das inserções, nunca em torno
 * delas: no PostgreSQL um erro deixa a transação abortada, e capturar a
 * violação de constraint levaria junto as linhas boas — o oposto da RN032.
 */
async function gravar(
  contexto: ContextoDaAcao,
  tipo: TipoDeImportacao,
  validas: ArquivoAnalisado['validas'],
): Promise<LinhaDoRelatorio[]> {
  const relatorio: LinhaDoRelatorio[] = [];

  if (tipo === 'USUARIO') {
    const cpfs = validas.map((item) => String(item.dados.cpf));
    const matriculas = validas
      .map((item) => String(item.dados.matricula ?? '').trim())
      .filter((matricula) => matricula !== '');

    const existentes = await chavesJaCadastradas(contexto.tx, cpfs, matriculas);

    const aCriar = validas.filter((item) => {
      const cpf = String(item.dados.cpf);
      const matricula = String(item.dados.matricula ?? '').trim();

      if (existentes.cpfs.has(cpf)) {
        relatorio.push({
          linha: item.linha,
          situacao: 'RECUSADA',
          identificacao: item.bruto.cpf ?? '',
          descricao: item.bruto.nome ?? '',
          detalhe: 'Já existe um usuário com este CPF.',
          senhaTemporaria: null,
        });
        return false;
      }

      if (matricula !== '' && existentes.matriculas.has(matricula)) {
        relatorio.push({
          linha: item.linha,
          situacao: 'RECUSADA',
          identificacao: item.bruto.cpf ?? '',
          descricao: item.bruto.nome ?? '',
          detalhe: 'Já existe um usuário com esta matrícula.',
          senhaTemporaria: null,
        });
        return false;
      }

      return true;
    });

    // Os hashes saem todos de uma vez: Argon2 é lento de propósito (RNF001), e
    // em série sessenta usuários passariam do tempo limite da transação.
    const senhas = aCriar.map(() => gerarSenhaTemporaria(10));
    const hashes = await Promise.all(senhas.map((senha) => gerarHashDeSenha(senha)));

    const agora = new Date();

    for (const [indice, item] of aCriar.entries()) {
      const dados = item.dados as Record<string, string | undefined>;
      const ehMotorista = dados.perfil === 'MOTORISTA';

      const usuario = await criarUsuario(contexto.tx, {
        nome: String(dados.nome),
        cpf: String(dados.cpf),
        telefone: String(dados.telefone),
        perfil: dados.perfil === 'ADMIN' ? 'ADMIN' : 'MOTORISTA',
        matricula: ouNulo(dados.matricula),
        email: ouNulo(dados.email),
        cnhNumero: ehMotorista ? ouNulo(dados.cnhNumero) : null,
        cnhCategoria: ehMotorista ? ouNulo(dados.cnhCategoria) : null,
        cnhValidade: ehMotorista ? dataOuNulo(dados.cnhValidade) : null,
        senhaHash: hashes[indice] ?? '',
        senhaTemporariaExpiraEm: expiracaoDaSenhaTemporaria(agora),
        criadoPor: contexto.usuario.id,
      });

      // A auditoria registra o usuário criado, como na criação pela tela — e
      // **sem** a senha: campo sensível nunca entra na trilha (RN026 · doc 17).
      contexto.auditar({
        acao: 'CRIAR',
        entidade: 'usuario',
        entidadeId: usuario.id,
        valorNovo: {
          nome: usuario.nome,
          cpf: usuario.cpf,
          perfil: usuario.perfil,
          origem: 'importacao',
        },
      });

      relatorio.push({
        linha: item.linha,
        situacao: 'IMPORTADA',
        identificacao: item.bruto.cpf ?? '',
        descricao: usuario.nome,
        detalhe: '',
        senhaTemporaria: senhas[indice] ?? null,
      });
    }

    return relatorio;
  }

  if (tipo === 'VEICULO') {
    const existentes = await placasJaCadastradas(
      contexto.tx,
      validas.map((item) => String(item.dados.placa)),
    );

    for (const item of validas) {
      const dados = item.dados as Record<string, string | number | undefined>;
      const placa = String(dados.placa);

      if (existentes.has(placa)) {
        relatorio.push({
          linha: item.linha,
          situacao: 'RECUSADA',
          identificacao: item.bruto.placa ?? '',
          descricao: item.bruto.modelo ?? '',
          detalhe: 'Já existe um veículo com esta placa.',
          senhaTemporaria: null,
        });
        continue;
      }

      const veiculo = await criarVeiculo(contexto.tx, {
        placa,
        modelo: String(dados.modelo),
        marca: ouNulo(dados.marca as string | undefined),
        ano: dados.ano === undefined ? null : Number(dados.ano),
        capacidadePassageiros: Number(dados.capacidadePassageiros),
        observacoes: ouNulo(dados.observacoes as string | undefined),
        odometroAtual: Number(dados.odometroAtual),
        criadoPor: contexto.usuario.id,
      });

      contexto.auditar({
        acao: 'CRIAR',
        entidade: 'veiculo',
        entidadeId: veiculo.id,
        valorNovo: { placa: veiculo.placa, modelo: veiculo.modelo, origem: 'importacao' },
      });

      relatorio.push({
        linha: item.linha,
        situacao: 'IMPORTADA',
        identificacao: item.bruto.placa ?? '',
        descricao: veiculo.modelo,
        detalhe: '',
        senhaTemporaria: null,
      });
    }

    return relatorio;
  }

  const existentes = await codigosJaCadastrados(
    contexto.tx,
    validas.map((item) => String(item.dados.codigo)),
  );

  for (const item of validas) {
    const dados = item.dados as Record<string, string | number | undefined>;
    const codigo = String(dados.codigo);

    if (existentes.has(codigo)) {
      relatorio.push({
        linha: item.linha,
        situacao: 'RECUSADA',
        identificacao: item.bruto.codigo ?? '',
        descricao: item.bruto.nome ?? '',
        detalhe: 'Já existe uma rota com este código.',
        senhaTemporaria: null,
      });
      continue;
    }

    const rota = await criarRota(contexto.tx, {
      codigo,
      nome: String(dados.nome),
      origem: String(dados.origem),
      destino: String(dados.destino),
      turno: dados.turno as 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL',
      distanciaEstimadaKm:
        dados.distanciaEstimadaKm === undefined ? null : Number(dados.distanciaEstimadaKm),
      criadoPor: contexto.usuario.id,
    });

    contexto.auditar({
      acao: 'CRIAR',
      entidade: 'rota',
      entidadeId: rota.id,
      valorNovo: { codigo: rota.codigo, nome: rota.nome, origem: 'importacao' },
    });

    relatorio.push({
      linha: item.linha,
      situacao: 'IMPORTADA',
      identificacao: item.bruto.codigo ?? '',
      descricao: rota.nome,
      detalhe: '',
      senhaTemporaria: null,
    });
  }

  return relatorio;
}

function ouNulo(valor: string | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

function dataOuNulo(valor: string | undefined): Date | null {
  const limpo = valor?.trim();
  if (!limpo) return null;
  const data = new Date(`${limpo}T00:00:00Z`);
  return Number.isNaN(data.getTime()) ? null : data;
}

export interface ResultadoDaImportacao {
  importados: number;
  recusados: number;
  arquivoId: string;
  nome: string;
  url: string;
  /** Só na importação de usuários: o relatório carrega as senhas temporárias. */
  contemSenhas: boolean;
}

export const confirmar = definirAcao<EntradaConfirmarImportacao, ResultadoDaImportacao>({
  nome: 'importacao.confirmar',
  perfis: ['ADMIN'],
  esquema: esquemaConfirmarImportacao,
  // Sessenta hashes Argon2 e sessenta inserções contra um banco em outra região
  // não cabem nos 5 s padrão do Prisma. Ver a nota em `acao-segura.ts`.
  tempoLimiteMs: 120_000,
  executar: async ({ id }, contexto) => {
    const importacao = await buscarParaConfirmar(contexto.tx, id);
    if (!importacao) throw new ErroNaoEncontrado('Importação não encontrada.');

    if (importacao.status !== 'PROCESSANDO') {
      throw new ErroDeConflito(
        CodigoErro.CONFLITO,
        'Esta importação já foi finalizada. Envie a planilha de novo para importar mais linhas.',
      );
    }

    const conteudo = await armazenamento.ler(importacao.arquivo.chaveArmazenamento);
    if (!conteudo) {
      throw new ErroDeNegocio(
        CodigoErro.ARQUIVO_EXPIRADO,
        'O arquivo enviado não está mais disponível. Envie a planilha novamente.',
      );
    }

    const tipo = importacao.tipoDestino as TipoDeImportacao;
    const modelo = modeloDe(tipo);

    // Revalidação completa: entre a análise e a confirmação o cadastro pode ter
    // mudado, e gravar com base na foto antiga é o mesmo erro de validar
    // odômetro contra um valor em cache.
    const analise = await conferir(modelo, importacao.arquivo.nomeOriginal, conteudo);

    const gravadas = await gravar(contexto, tipo, analise.validas);

    const recusadasNaLeitura: LinhaDoRelatorio[] = analise.invalidas.map((erro) => ({
      linha: erro.linha,
      situacao: 'RECUSADA',
      // A linha é identificada pelo que ela **é** — o CPF, a placa —, não pelo
      // campo que deu errado; o valor recusado vai dentro do motivo.
      identificacao: erro.identificacao,
      descricao: erro.descricao,
      detalhe: `${erro.coluna} “${erro.valor || '(vazio)'}”: ${erro.motivo}`,
      senhaTemporaria: null,
    }));

    const linhasDoRelatorio = [...gravadas, ...recusadasNaLeitura].sort(
      (uma, outra) => uma.linha - outra.linha,
    );

    const importados = linhasDoRelatorio.filter((linha) => linha.situacao === 'IMPORTADA').length;
    const recusados = linhasDoRelatorio.length - importados;

    const agora = new Date();

    const planilha = await gerarPlanilha({
      identificacao: montarIdentificacao({
        tipo: 'JORNADAS',
        filtros: {},
        totalDeLinhas: linhasDoRelatorio.length,
        geradoEm: agora,
        geradoPor: contexto.usuario.nome,
      })
        // A identificação padrão fala de "relatório de jornadas"; aqui o assunto
        // é outro, e a primeira aba é justamente o que dá sentido ao arquivo
        // solto numa pasta seis meses depois (RN030).
        .filter((par) => par.rotulo !== 'Relatório' && par.rotulo !== 'Filtros aplicados')
        .concat([
          { rotulo: 'Relatório', valor: `Importação de ${modelo.rotulo.toLowerCase()}` },
          { rotulo: 'Arquivo enviado', valor: importacao.arquivo.nomeOriginal },
          { rotulo: 'Importadas', valor: String(importados) },
          { rotulo: 'Recusadas', valor: String(recusados) },
        ]),
      aba: {
        nome: 'Resultado',
        colunas: colunasDoRelatorio(tipo),
        registros: linhasDoRelatorio,
      },
      avisoQuandoVazio: 'Nenhuma linha para relatar.',
    });

    const nome = nomeDoRelatorio(tipo, dataOperacional(agora));

    const arquivo = await armazenarERegistrar(contexto.tx, {
      tipo: 'RELATORIO_ERROS',
      nome,
      mimeType: MIME_XLSX,
      conteudo: planilha,
      parametros: {
        tipoDestino: tipo,
        importacaoId: id,
        importados,
        recusados,
      } as Prisma.InputJsonValue,
      geradoPor: contexto.usuario.id,
      geradoEm: agora,
      // O relatório de usuários carrega senhas temporárias; nenhuma planilha
      // com senha fica guardada para sempre no histórico de arquivos.
      expiraEm:
        tipo === 'USUARIO'
          ? new Date(agora.getTime() + DIAS_DE_RETENCAO_DO_RELATORIO * 86_400_000)
          : null,
    });

    await concluirImportacao(contexto.tx, id, {
      // Zero linhas importadas não é "concluída": foi rejeitada, e o histórico
      // precisa distinguir as duas para quem for conferir a carga depois.
      status: importados === 0 ? 'REJEITADA' : 'CONCLUIDA',
      linhasOk: importados,
      linhasErro: recusados,
      resultado: {
        erros: linhasDoRelatorio
          .filter((linha) => linha.situacao === 'RECUSADA')
          .map((linha) => ({ linha: linha.linha, motivo: linha.detalhe })),
        relatorioArquivoId: arquivo.id,
      } as Prisma.InputJsonValue,
    });

    // Critério de aceitação: a importação é auditada com o nome do arquivo e a
    // quantidade de registros afetados (RN026).
    contexto.auditar({
      acao: 'IMPORTAR',
      entidade: 'importacao',
      entidadeId: id,
      valorNovo: {
        tipoDestino: tipo,
        arquivo: importacao.arquivo.nomeOriginal,
        importados,
        recusados,
        relatorio: nome,
      },
    });

    logger.info('importacao.concluida', { tipo, importados, recusados });

    return {
      importados,
      recusados,
      arquivoId: arquivo.id,
      nome,
      url: `/api/arquivos/${arquivo.id}/download`,
      contemSenhas: tipo === 'USUARIO' && importados > 0,
    };
  },
});

// -------------------------------------------------------------- histórico

export const listar = definirAcao<EntradaListarImportacoes, DadosPaginados<ImportacaoDaListagem>>({
  nome: 'importacao.listar',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaListarImportacoes,
  executar: async (filtros, contexto) => {
    const { skip, take } = paraIntervalo(filtros);
    const { importacoes, total } = await listarImportacoes(contexto.tx, { skip, take });
    return montarPagina(importacoes, total, filtros);
  },
});
