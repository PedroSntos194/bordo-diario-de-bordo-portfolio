import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { consultarMotoristas } from '../src/modulos/acompanhamento/acompanhamento.repositorio';
import {
  avaliarSituacaoDoMotorista,
  resumirSituacoes,
} from '../src/modulos/acompanhamento/acompanhamento.regras';
import {
  conferirImplantacao,
  assinaturaDaConferencia,
} from '../src/modulos/acompanhamento/conferencia.regras';
import { VERSAO_AVISO_PRIVACIDADE } from '../src/modulos/privacidade/aviso-privacidade';
import { dataOperacional } from '../src/utilitarios/data';

// Não importa o ambiente do aplicativo nem executa seeds/migrações/ações administrativas.
const raiz = fileURLToPath(new URL('../', import.meta.url));
const configuracao = parseEnv(await readFile(resolve(raiz, '.env.producao'), 'utf8'));
const urlDoAplicativo = configuracao.APP_URL ?? 'https://bordo.exemplo.com.br';
if (!configuracao.DATABASE_URL || !urlDoAplicativo.startsWith('https://'))
  throw new Error('A conferência exige DATABASE_URL e endereço HTTPS do aplicativo.');
const prisma = new PrismaClient({ datasources: { db: { url: configuracao.DATABASE_URL } } });
const pasta = resolve(raiz, 'output/acompanhamento-implantacao');
const arquivoAtual = resolve(pasta, 'ultima-conferencia.json');

async function disponibilidade() {
  try {
    const resposta = await fetch(new URL('/api/health', urlDoAplicativo), {
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    const dados = await resposta.json();
    return {
      disponivel: resposta.ok && dados.status === 'ok' && dados.banco === 'ok',
      http: resposta.status,
    };
  } catch {
    return { disponivel: false, http: null };
  }
}

try {
  const [consulta, saude] = await Promise.all([
    prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const [relogio] = await tx.$queryRaw<{ agora: Date }[]>`SELECT CURRENT_TIMESTAMP AS agora`;
        if (!relogio) throw new Error('Não foi possível consultar o horário do banco.');
        const agora = relogio.agora;
        const data = dataOperacional(agora);
        const retratos = await consultarMotoristas(tx, data);
        const motoristas = retratos.map((motorista) =>
          avaliarSituacaoDoMotorista(motorista, data, agora, VERSAO_AVISO_PRIVACIDADE),
        );
        return { agora, data, motoristas };
      },
      { maxWait: 15_000, timeout: 45_000 },
    ),
    disponibilidade(),
  ]);
  const pendencias = conferirImplantacao(consulta.motoristas, consulta.agora);
  const assinatura = assinaturaDaConferencia({ ...consulta, ...saude, pendencias });
  let anterior: { assinatura: string; pendencias: unknown[]; disponivel: boolean } | null = null;
  try {
    anterior = JSON.parse(await readFile(arquivoAtual, 'utf8'));
  } catch (erro) {
    if (!(erro instanceof Error && 'code' in erro && erro.code === 'ENOENT')) throw erro;
  }
  const resultado = {
    consultadoEm: consulta.agora.toISOString(),
    data: consulta.data,
    fuso: 'America/Sao_Paulo',
    modoBanco: 'READ ONLY',
    ...saude,
    resumo: resumirSituacoes(consulta.motoristas),
    pendencias,
    assinatura,
    mudou: anterior?.assinatura !== assinatura,
    requerAtencao: !saude.disponivel || pendencias.length > 0,
    pendenciasResolvidas:
      anterior !== null && anterior.pendencias.length > 0 && pendencias.length === 0,
  };
  await mkdir(pasta, { recursive: true });
  const conteudo = JSON.stringify(resultado, null, 2);
  // Só substitui a última consulta após obter um retrato completo, nunca em uma falha de banco.
  await writeFile(`${arquivoAtual}.tmp`, conteudo);
  await rename(`${arquivoAtual}.tmp`, arquivoAtual);
  await writeFile(resolve(pasta, `${consulta.data}.json`), conteudo);
  console.log(JSON.stringify({ ...resultado, assinatura: undefined }, null, 2));
  if (!saude.disponivel) process.exitCode = 2;
} catch {
  // Erros do Prisma podem incluir a conexão: não os imprime nem salva.
  console.error(
    'Conferência incompleta: falha ao consultar ou salvar o retrato. A última consulta válida foi preservada.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
