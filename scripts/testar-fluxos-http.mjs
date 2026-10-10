import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { appendFile, cp, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarAmbienteDaSuite } from '../tests/integracao/ambiente-seguro.mjs';
import {
  CPF_ADMIN_DESCARTAVEL,
  SENHA_ADMIN_DESCARTAVEL,
  CRON_SECRET_DESCARTAVEL,
} from '../tests/integracao/credenciais-descartaveis.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portaBanco = process.env.TESTE_POSTGRES_PORTA ?? '55433';
const portaApp = process.env.TESTE_HTTP_PORTA ?? '3107';
for (const porta of [portaBanco, portaApp]) {
  if (!/^\d{4,5}$/.test(porta) || Number(porta) > 65535 || Number(porta) < 1024) {
    throw new Error('As portas de testes precisam estar entre 1024 e 65535.');
  }
}
const schema = `ci_fluxos_${randomBytes(6).toString('hex')}`;
const banco = `postgresql://bordo_ci:bordo_ci_apenas_testes@127.0.0.1:${portaBanco}/bordo_ci?schema=${schema}`;
const saida = join(raiz, 'output', 'testes-http');
await mkdir(saida, { recursive: true });
await rm(join(saida, 'junit.xml'), { force: true });
const log = createWriteStream(join(saida, 'execucao.log'));
const copia = await mkdtemp(join(tmpdir(), 'bordo-http-'));

// Lista explícita de variáveis de processo: não herda DATABASE_URL, tokens,
// NODE_OPTIONS ou credenciais do terminal. Next e Prisma rodam numa cópia
// temporária sem .env, pois ambos carregariam o arquivo automaticamente.
const ambiente = Object.fromEntries(
  Object.entries(process.env).filter(([chave]) =>
    /^(path|systemroot|windir|comspec|pathext|temp|tmp|home|userprofile|localappdata)$/i.test(
      chave,
    ),
  ),
);
Object.assign(ambiente, {
  NODE_ENV: 'production',
  APP_AMBIENTE: 'local',
  APP_URL: `http://127.0.0.1:${portaApp}`,
  DATABASE_URL: banco,
  DIRECT_URL: banco,
  SESSAO_SECRET: 'segredo-descartavel-da-suite-http-com-mais-de-32-chars',
  STORAGE_DRIVER: 'local',
  STORAGE_PATH: join(copia, 'storage'),
  WHATSAPP_CANAL: 'link',
  GEOCODIFICACAO_URL: 'http://127.0.0.1:1/reverse',
  MAPA_TILES_URL: 'http://127.0.0.1:1/{z}/{x}/{y}.png',
  LOG_NIVEL: 'error',
  TZ: 'America/Sao_Paulo',
  NEXT_TELEMETRY_DISABLED: '1',
  CI_HTTP_ISOLADO: 'sim',
  CI_HTTP_RAIZ_COPIA: copia,
  E2E_BASE_URL: `http://127.0.0.1:${portaApp}`,
  E2E_ADMIN_CPF: CPF_ADMIN_DESCARTAVEL,
  E2E_ADMIN_SENHA: SENHA_ADMIN_DESCARTAVEL,
  CRON_SECRET: CRON_SECRET_DESCARTAVEL,
});
validarAmbienteDaSuite(ambiente);

let servidor;
let servidorPronto = false;
let schemaCriado = false;

function escrever(texto) {
  process.stdout.write(texto);
  log.write(texto);
}

function iniciar(argumentos, opcoes = {}) {
  const processo = spawn(process.execPath, argumentos, {
    cwd: copia,
    env: ambiente,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...opcoes,
  });
  processo.stdout.on('data', (dados) => escrever(dados));
  processo.stderr.on('data', (dados) => escrever(dados));
  // Registrada imediatamente: esperar exit só no finally pode perder um
  // encerramento por sinal que já aconteceu (exitCode continuaria null).
  processo.encerrado = new Promise((concluir) => {
    processo.once('exit', (codigo, sinal) => concluir({ codigo, sinal }));
    processo.once('error', () => {
      processo.erroDeInicio = true;
      concluir({ codigo: null, sinal: 'ERRO_PROCESSO' });
    });
  });
  return processo;
}

async function executar(argumentos, limiteMs = 300_000) {
  const processo = iniciar(argumentos);
  const limite = setTimeout(() => processo.kill(), limiteMs);
  try {
    const { codigo } = await processo.encerrado;
    if (codigo !== 0) throw new Error(`Etapa de teste falhou (saída ${codigo}).`);
  } finally {
    clearTimeout(limite);
  }
}

async function aguardarServidor() {
  const fim = Date.now() + 60_000;
  while (Date.now() < fim) {
    if (servidor.exitCode !== null || servidor.signalCode !== null || servidor.erroDeInicio) {
      throw new Error('Servidor de testes encerrou antes de subir.');
    }
    // O health de um processo antigo na mesma porta não autoriza os testes.
    // Só fazemos a primeira requisição depois de ESTE Next confirmar o listen.
    if (servidorPronto) {
      try {
        const resposta = await fetch(`${ambiente.APP_URL}/api/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (resposta.ok && (await resposta.json()).banco === 'ok') return;
      } catch {
        // A inicialização ainda pode estar em andamento.
      }
    }
    await new Promise((concluir) => setTimeout(concluir, 300));
  }
  throw new Error('Servidor de testes não ficou saudável em 60 segundos.');
}

async function copiarDependenciasIsoladas() {
  const origem = join(raiz, 'node_modules');
  const destino = join(copia, 'node_modules');
  await mkdir(destino);
  for (const item of await readdir(origem, { withFileTypes: true })) {
    const de = join(origem, item.name);
    const para = join(destino, item.name);
    if (item.name === '.prisma') {
      // O client gerado resolve .env pelo próprio __dirname. Precisamos de
      // uma cópia física, não de uma junction que aponte ao projeto original.
      await cp(de, para, { recursive: true });
    } else if (item.name === '@prisma') {
      await mkdir(para);
      for (const pacote of await readdir(de, { withFileTypes: true })) {
        if (pacote.name === 'client') {
          await cp(join(de, pacote.name), join(para, pacote.name), { recursive: true });
        } else {
          await symlink(join(de, pacote.name), join(para, pacote.name), 'junction');
        }
      }
    } else if (item.isDirectory()) {
      await symlink(de, para, 'junction');
    } else {
      await cp(de, para);
    }
  }
}

try {
  for (const item of [
    'src',
    'public',
    'prisma',
    'tests/integracao',
    'tests/ponta-a-ponta',
    'package.json',
    'package-lock.json',
    'next.config.ts',
    'tsconfig.json',
    'postcss.config.mjs',
    'eslint.config.mjs',
  ]) {
    await cp(join(raiz, item), join(copia, item), { recursive: true });
  }
  await copiarDependenciasIsoladas();
  // Nenhum PrismaClient é importado pelo processo pai. O helper usa o client
  // físico copiado e encerra antes da limpeza: Windows mantém a DLL de engine
  // bloqueada enquanto o processo que a importou ainda estiver vivo.
  // O pacote standalone é específico do deploy; a suíte usa next start.
  // Desabilitá-lo só na cópia evita que o tracing siga a junction de
  // node_modules para fora do diretório temporário, especialmente no Windows.
  await appendFile(join(copia, 'next.config.ts'), '\nnextConfig.output = undefined;\n');
  await executar(['--test', join(copia, 'tests/integracao/protecoes.test.mjs')]);
  escrever('\nPreparando schema PostgreSQL exclusivo dos testes.\n');
  const helperBanco = join(copia, 'tests/integracao/banco-descartavel.mjs');
  await executar([helperBanco, 'criar'], 30_000);
  schemaCriado = true;
  await executar([
    join(raiz, 'node_modules/prisma/build/index.js'),
    'migrate',
    'deploy',
    '--schema',
    join(copia, 'prisma/schema.prisma'),
  ]);
  escrever('\nCompilando e iniciando a aplicação isolada.\n');
  const next = join(raiz, 'node_modules/next/dist/bin/next');
  await executar([next, 'build']);
  servidor = iniciar([next, 'start', '--hostname', '127.0.0.1', '--port', portaApp]);
  let mensagemDeInicio = '';
  servidor.stdout.on('data', (dados) => {
    mensagemDeInicio += dados.toString();
    servidorPronto ||= mensagemDeInicio.includes('Ready in');
  });
  await aguardarServidor();
  await executar(
    [
      '--test',
      '--test-reporter=spec',
      '--test-reporter-destination=stdout',
      '--test-reporter=junit',
      `--test-reporter-destination=${join(saida, 'junit.xml')}`,
      join(copia, 'tests/integracao/fluxos-http.test.mjs'),
    ],
    240_000,
  );
  // O volume sintético da suíte complementar fica na data anterior. Os
  // roteiros originais exportam somente hoje e criam seus próprios cadastros.
  // Node 22 atualizado trata o import do aviso .ts. Usar o próprio runtime
  // evita o helper userInfo do tsx, indisponível no sandbox do Windows.
  escrever('\nExecutando os roteiros originais recuperados do outro PC.\n');
  await executar(
    ['--experimental-strip-types', join(copia, 'tests/ponta-a-ponta/todos.mjs')],
    180_000,
  );
  escrever('\nTodos os fluxos HTTP passaram.\n');
} catch (erro) {
  escrever(`\n${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exitCode = 1;
} finally {
  const limpar = async (nome, operacao) => {
    try {
      await operacao();
    } catch {
      escrever(`Falha na limpeza: ${nome}.\n`);
      process.exitCode = 1;
    }
  };
  await limpar('servidor', async () => {
    if (servidor && servidor.exitCode === null && servidor.signalCode === null) {
      servidor.kill();
      let limite;
      try {
        await Promise.race([
          servidor.encerrado,
          new Promise((_, rejeitar) => {
            limite = setTimeout(
              () => rejeitar(new Error('Tempo de encerramento excedido.')),
              10_000,
            );
          }),
        ]);
      } finally {
        clearTimeout(limite);
      }
    }
  });
  if (schemaCriado) {
    await limpar('schema PostgreSQL', async () => {
      // Nunca remove public ou outro banco: apenas o schema desta execução.
      await executar([join(copia, 'tests/integracao/banco-descartavel.mjs'), 'remover'], 30_000);
    });
  }
  await limpar('cópia temporária', () => rm(copia, { recursive: true, force: true }));
  await limpar('log', () => new Promise((concluir) => log.end(concluir)));
}
