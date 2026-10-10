import type { ClientePrisma } from '@/lib/prisma';

/**
 * Acesso a dados do expurgo por retenção (US044 · RNF007).
 *
 * O que este arquivo **não** faz é tão importante quanto o que faz: ele não
 * toca em `corrida`, `jornada` nem `log_auditoria`. Os totais já publicados não
 * podem mudar por causa de uma limpeza, e a trilha é imutável por regra (RN027)
 * — ver a nota em `retencao.servico.ts` sobre por que a auditoria fica fora do
 * alcance da aplicação.
 */

export async function contarLocalizacoesVencidas(
  cliente: ClientePrisma,
  corte: Date,
): Promise<number> {
  return cliente.pontoLocalizacao.count({ where: { capturadoEm: { lt: corte } } });
}

/**
 * Apaga um lote de pontos vencidos e devolve quantos saíram.
 *
 * SQL bruto porque o `deleteMany` do Prisma **não aceita limite**, e apagar um
 * ano de pontos numa tacada seguraria bloqueios no banco que também atende os
 * motoristas em campo. A subconsulta com `LIMIT` é o jeito padrão de recortar
 * um `DELETE` no PostgreSQL.
 *
 * Escrito por extenso, com parâmetros ligados pelo template do Prisma: nome de
 * tabela ou valor interpolado por concatenação é o caminho curto para injeção
 * (mesma disciplina de `periodo.repositorio.ts`).
 */
export async function removerLoteDeLocalizacoes(
  cliente: ClientePrisma,
  corte: Date,
  lote: number,
): Promise<number> {
  return cliente.$executeRaw`
    DELETE FROM ponto_localizacao
    WHERE id IN (
      SELECT id
      FROM ponto_localizacao
      WHERE capturado_em < ${corte}
      ORDER BY capturado_em
      LIMIT ${lote}
    )
  `;
}

/**
 * Arquivos cujo conteúdo já pode sair do disco.
 *
 * Duas origens de vencimento, e elas convivem:
 *
 * - `expira_em` preenchido e no passado — prazo **próprio** do arquivo, mais
 *   curto que a política geral. É o caso do relatório de importação de
 *   usuários, que carrega senhas temporárias (US015).
 * - `expira_em` nulo e criado antes do corte — cai na política geral de
 *   retenção de planilhas (RNF007).
 *
 * A chave de armazenamento é lida aqui porque é o expurgo que precisa dela
 * para apagar o binário; ela não sai deste módulo em direção a nenhuma tela
 * (RN030 · doc 17).
 */
export async function arquivosVencidos(
  cliente: ClientePrisma,
  corte: Date,
  agora: Date,
  limite: number,
) {
  return cliente.arquivo.findMany({
    where: {
      OR: [{ expiraEm: { lt: agora } }, { expiraEm: null, criadoEm: { lt: corte } }],
    },
    select: { id: true, chaveArmazenamento: true, expiraEm: true, tipo: true },
    orderBy: { criadoEm: 'asc' },
    take: limite,
  });
}

export async function contarArquivosVencidos(
  cliente: ClientePrisma,
  corte: Date,
  agora: Date,
): Promise<number> {
  return cliente.arquivo.count({
    where: {
      OR: [{ expiraEm: { lt: agora } }, { expiraEm: null, criadoEm: { lt: corte } }],
    },
  });
}

/**
 * Carimba o vencimento no registro cujo binário acabou de sair do disco.
 *
 * O **registro permanece** — quem gerou, quando, com que filtros (RN030). O que
 * some é o conteúdo. Sem este carimbo, um arquivo vencido pela política geral
 * continuaria com `expira_em` nulo e a listagem diria "disponível" para algo
 * que não está mais lá; com ele, a tela mostra "expirado" e o download responde
 * 410 em vez de um erro de leitura.
 */
export async function marcarArquivoExpurgado(
  cliente: ClientePrisma,
  id: string,
  expiraEm: Date,
): Promise<void> {
  await cliente.arquivo.update({ where: { id }, data: { expiraEm } });
}

/**
 * Sessões vencidas (RN007 · doc 13 — tarefa diária).
 *
 * Não é RNF007, mas é a mesma família e o mesmo processo: linha guardada além
 * do prazo, sem servir a nada. Fica aqui porque `removerSessoesExpiradas`, em
 * `lib/sessao.ts`, escreve pelo cliente global — e esta rotina precisa do
 * cliente que o `definirAcao` entrega.
 */
export async function removerSessoesVencidas(cliente: ClientePrisma, agora: Date): Promise<number> {
  const resultado = await cliente.sessao.deleteMany({ where: { expiraEm: { lt: agora } } });
  return resultado.count;
}

export async function contarSessoesVencidas(cliente: ClientePrisma, agora: Date): Promise<number> {
  return cliente.sessao.count({ where: { expiraEm: { lt: agora } } });
}
