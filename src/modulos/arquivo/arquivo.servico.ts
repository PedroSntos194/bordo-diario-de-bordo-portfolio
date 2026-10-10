import type { Prisma, TipoArquivo } from '@prisma/client';
import { definirAcao } from '@/lib/acao-segura';
import type { ClientePrisma } from '@/lib/prisma';
import { armazenamento, montarChave } from '@/lib/armazenamento';
import { CodigoErro, ErroDeNegocio, ErroNaoEncontrado } from '@/lib/erros';
import { montarPagina, paraIntervalo, type DadosPaginados } from '@/lib/paginacao';
import { fimDoDia, inicioDoDia } from '@/utilitarios/data';
import { ehAdministrador } from '@/lib/autorizacao';
import {
  buscarParaDownload,
  listarArquivos,
  registrarArquivo,
  type ArquivoDaListagem,
} from '@/modulos/arquivo/arquivo.repositorio';
import {
  esquemaBaixarArquivo,
  esquemaListarArquivos,
  type EntradaBaixarArquivo,
  type EntradaListarArquivos,
} from '@/modulos/arquivo/arquivo.schema';

/** Consulta, gravação e download dos arquivos gerados (RF036 · RN030). */

export interface PlanilhaParaGuardar {
  tipo: TipoArquivo;
  nome: string;
  mimeType: string;
  conteudo: Buffer;
  parametros: Prisma.InputJsonValue;
  /** Nulo quando quem gerou foi a rotina agendada, não uma pessoa. */
  geradoPor: string | null;
  geradoEm: Date;
  /**
   * Extensão da chave no storage. O padrão cobre tudo o que o sistema **gera**;
   * o que ele **recebe** pode ser outra coisa — a importação aceita `.csv`
   * (US015), e guardar um CSV com nome de `.xlsx` confundiria quem for
   * investigar o storage depois.
   */
  extensao?: string;
  /**
   * Quando o arquivo deixa de estar disponível. Omitir é "não expira", que é o
   * certo para relatório operacional. A exceção é o relatório da importação de
   * usuários, que carrega senhas temporárias e por isso tem prazo (US015).
   */
  expiraEm?: Date | null;
}

/**
 * Grava o binário e registra o arquivo — o passo final comum à exportação
 * manual (US032) e ao consolidado automático (US033).
 *
 * Não é uma ação: é chamado **de dentro** de uma, com o cliente da transação
 * em mãos, para que o registro participe do mesmo `commit` da auditoria.
 *
 * A ordem importa. O binário vai para o disco **antes** do registro porque a
 * falha que sobra é a inofensiva: arquivo no disco sem linha no banco é
 * invisível e some no expurgo, enquanto linha no banco sem arquivo vira um
 * download quebrado na cara do administrador.
 */
export async function armazenarERegistrar(
  cliente: ClientePrisma,
  planilha: PlanilhaParaGuardar,
): Promise<{ id: string; tamanhoBytes: number }> {
  const gravado = await armazenamento.gravar(
    montarChave(planilha.tipo, planilha.extensao ?? 'xlsx', planilha.geradoEm),
    planilha.conteudo,
  );

  const arquivo = await registrarArquivo(cliente, {
    tipo: planilha.tipo,
    nomeOriginal: planilha.nome,
    chaveArmazenamento: gravado.chave,
    mimeType: planilha.mimeType,
    tamanhoBytes: gravado.tamanhoBytes,
    hashSha256: gravado.hashSha256,
    parametros: planilha.parametros,
    geradoPor: planilha.geradoPor,
    expiraEm: planilha.expiraEm ?? null,
  });

  return { id: arquivo.id, tamanhoBytes: gravado.tamanhoBytes };
}

/**
 * Um arquivo como a tela o vê: sem a chave de armazenamento, e sabendo se o
 * binário ainda está lá.
 */
export type ArquivoListado = Omit<ArquivoDaListagem, 'chaveArmazenamento'> & {
  disponivel: boolean;
};

export const listar = definirAcao<EntradaListarArquivos, DadosPaginados<ArquivoListado>>({
  nome: 'arquivo.listar',
  perfis: ['ADMIN'],
  semTransacao: true,
  esquema: esquemaListarArquivos,
  executar: async (filtros, contexto) => {
    const { skip, take } = paraIntervalo(filtros);
    const { arquivos, total } = await listarArquivos(contexto.tx, {
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.dataInicio ? { dataInicio: inicioDoDia(filtros.dataInicio) } : {}),
      ...(filtros.dataFim ? { dataFim: fimDoDia(filtros.dataFim) } : {}),
      skip,
      take,
    });

    // US034 — "arquivo expirado ou removido exibe mensagem em vez de link
    // quebrado". A verificação acontece aqui, e a chave é descartada em
    // seguida: a tela recebe um booleano, nunca o caminho no disco.
    const listados = await Promise.all(
      arquivos.map(async ({ chaveArmazenamento, ...arquivo }) => ({
        ...arquivo,
        disponivel:
          !(arquivo.expiraEm && arquivo.expiraEm.getTime() <= Date.now()) &&
          (await armazenamento.existe(chaveArmazenamento)),
      })),
    );

    return montarPagina(listados, total, filtros);
  },
});

export interface ArquivoParaDownload {
  nome: string;
  mimeType: string;
  conteudo: Buffer;
}

/**
 * Download do binário (RN030).
 *
 * O caminho no storage nunca chega ao cliente: a rota recebe apenas o
 * identificador do registro, e é **aqui** que se verifica se quem pede tem
 * direito ao conteúdo antes de ler um único byte do disco.
 *
 * Não é `semTransacao`: o download é auditado (RN030 — "o download fica
 * restrito a quem tem permissão", e saber quem levou a planilha para fora do
 * sistema é justamente o ponto).
 */
export const baixar = definirAcao<EntradaBaixarArquivo, ArquivoParaDownload>({
  nome: 'arquivo.baixar',
  esquema: esquemaBaixarArquivo,
  executar: async ({ id }, contexto) => {
    const arquivo = await buscarParaDownload(contexto.tx, id);
    if (!arquivo) throw new ErroNaoEncontrado('Arquivo não encontrado.');

    // RN008 e RN009 — o administrador enxerga tudo; qualquer outro perfil só
    // baixa o que ele mesmo gerou. Um arquivo do sistema (`geradoPor` nulo)
    // nunca é de um motorista, e a comparação com `null` já cobre isso.
    if (!ehAdministrador(contexto.usuario) && arquivo.geradoPor !== contexto.usuario.id) {
      throw new ErroNaoEncontrado('Arquivo não encontrado.');
    }

    // Fechamento traz pagamento e cobrança: é só da administração, mesmo que um
    // dia alguém de outro perfil apareça como autor (pedido do cliente, 07/10).
    if (arquivo.tipo === 'FECHAMENTO_MENSAL' && !ehAdministrador(contexto.usuario)) {
      throw new ErroNaoEncontrado('Arquivo não encontrado.');
    }

    if (arquivo.expiraEm && arquivo.expiraEm.getTime() <= Date.now()) {
      throw new ErroDeNegocio(
        CodigoErro.ARQUIVO_EXPIRADO,
        'Este arquivo passou do prazo de retenção e foi removido. Gere o relatório novamente.',
      );
    }

    const conteudo = await armazenamento.ler(arquivo.chaveArmazenamento);

    // Registro no banco sem binário no disco: acontece após limpeza manual ou
    // restauração parcial. É a mesma resposta do expirado — o que o usuário
    // precisa saber é que o arquivo não existe mais, não por qual motivo.
    if (!conteudo) {
      throw new ErroDeNegocio(
        CodigoErro.ARQUIVO_EXPIRADO,
        'O conteúdo deste arquivo não está mais disponível. Gere o relatório novamente.',
      );
    }

    contexto.auditar({
      acao: 'EXPORTAR',
      entidade: 'arquivo',
      entidadeId: arquivo.id,
      valorNovo: { download: arquivo.nomeOriginal, tipo: arquivo.tipo },
    });

    return { nome: arquivo.nomeOriginal, mimeType: arquivo.mimeType, conteudo };
  },
});
