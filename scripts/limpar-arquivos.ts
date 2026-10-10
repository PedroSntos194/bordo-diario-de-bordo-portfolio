import { readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Remove os arquivos gerados e as notificações — apenas para desenvolvimento.
 *
 * Companheiro do `limpar-jornadas.ts`. Exportar e gerar consolidado deixam
 * rastro em dois lugares — a tabela `arquivo` e o disco —, e uma demonstração
 * com dez planilhas de teste repetidas na tela conta a história errada.
 *
 * Apaga o **registro e o binário juntos**: limpar só a tabela deixaria os
 * arquivos órfãos ocupando espaço, e limpar só o disco deixaria a tela cheia de
 * downloads quebrados.
 *
 * NÃO deve ser executado em produção — planilha gerada é registro rastreável
 * (RN030), e o expurgo real é pela política de retenção (RNF007).
 */

const RAIZ_STORAGE = process.env.STORAGE_PATH ?? './storage';

/** Remove os subdiretórios do storage, preservando o `.gitkeep`. */
async function limparDisco(): Promise<number> {
  const raiz = resolve(RAIZ_STORAGE);
  let removidos = 0;

  let entradas;
  try {
    entradas = await readdir(raiz, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entrada of entradas) {
    if (entrada.name === '.gitkeep') continue;

    const caminho = join(raiz, entrada.name);
    const info = await stat(caminho);
    if (info.isDirectory()) {
      await rm(caminho, { recursive: true, force: true });
      removidos += 1;
    }
  }

  return removidos;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  const antes = await prisma.arquivo.findMany({
    select: { nomeOriginal: true, criadoEm: true },
    orderBy: { criadoEm: 'desc' },
  });

  if (antes.length > 0) {
    console.log('Arquivos que serão removidos:');
    for (const arquivo of antes) {
      console.log(`  · ${arquivo.nomeOriginal}`);
    }
  }

  // Notificações primeiro: elas referenciam arquivo por chave estrangeira.
  const notificacoes = await prisma.notificacao.deleteMany({});
  // As tarefas de exportação também. A chave estrangeira delas é `SET NULL`, e
  // sem isto sobrariam linhas dizendo "pronta" com o download já apagado.
  const tarefas = await prisma.tarefaExportacao.deleteMany({});
  const arquivos = await prisma.arquivo.deleteMany({});
  const pastas = await limparDisco();

  console.log(
    `\narquivos removidos: ${arquivos.count} · notificações removidas: ${notificacoes.count} · ` +
      `tarefas de exportação removidas: ${tarefas.count} · pastas do storage: ${pastas}`,
  );

  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
