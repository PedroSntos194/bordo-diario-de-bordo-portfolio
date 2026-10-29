import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arquivoEnv = join(raiz, '.env.demo.local');
const arquivoCompose = join(raiz, 'compose.demo.yml');
const armazenamento = join(raiz, 'output', 'demo-local', 'storage');
const urlApp = 'http://127.0.0.1:3001';
const informar = (mensagem) => process.stdout.write(`${mensagem}\n`);

const chavesPermitidas = new Set([
  'APP_AMBIENTE',
  'APP_URL',
  'DATABASE_URL',
  'DIRECT_URL',
  'SESSAO_SECRET',
  'DEMO_DB_SENHA',
  'DEMO_SENHA',
]);

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch (erro) {
    if (erro.code === 'ENOENT') return false;
    throw erro;
  }
}

async function validarArquivosDeAmbiente() {
  // Next e Prisma carregam estes arquivos automaticamente. Recusar o conflito
  // impede que uma instalação real seja misturada à demonstração.
  for (const nome of [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local',
    'prisma/.env',
  ]) {
    if (await existe(join(raiz, nome))) {
      throw new Error(
        `Existe ${nome}. A demonstração usa somente .env.demo.local; ` +
          'guarde a configuração da outra instalação em outro checkout antes de iniciar.',
      );
    }
  }
}

async function carregarConfiguracao() {
  if (!(await existe(arquivoEnv))) {
    const senhaBanco = randomBytes(24).toString('hex');
    const banco = `postgresql://bordo_demo:${senhaBanco}@127.0.0.1:55434/bordo_demo?schema=public`;
    const valores = {
      APP_AMBIENTE: 'local',
      APP_URL: urlApp,
      DATABASE_URL: banco,
      DIRECT_URL: banco,
      SESSAO_SECRET: randomBytes(48).toString('hex'),
      DEMO_DB_SENHA: senhaBanco,
      DEMO_SENHA: `Bordo${randomBytes(6).toString('hex')}7`,
    };
    try {
      await writeFile(
        arquivoEnv,
        '# Configuração exclusiva da demonstração local. Não versionar nem compartilhar.\n' +
          Object.entries(valores)
            .map(([chave, valor]) => `${chave}=${valor}`)
            .join('\n') +
          '\n',
        { encoding: 'utf8', flag: 'wx', mode: 0o600 },
      );
      informar('Configuração criada em .env.demo.local (ignorada pelo Git).');
    } catch (erro) {
      if (erro.code !== 'EEXIST') throw erro;
    }
  }

  const valores = parseEnv(await readFile(arquivoEnv, 'utf8'));
  if (Object.keys(valores).some((chave) => !chavesPermitidas.has(chave))) {
    throw new Error('.env.demo.local contém uma chave desconhecida. Nenhum serviço foi alterado.');
  }
  if (valores.APP_AMBIENTE !== 'local' || valores.APP_URL !== urlApp) {
    throw new Error('A demonstração exige APP_AMBIENTE=local e APP_URL=http://127.0.0.1:3001.');
  }
  if (
    !/^[a-zA-Z0-9]{32,128}$/.test(valores.DEMO_DB_SENHA ?? '') ||
    (valores.SESSAO_SECRET?.length ?? 0) < 32 ||
    !/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{8,128}$/.test(valores.DEMO_SENHA ?? '')
  ) {
    throw new Error('Os segredos de .env.demo.local estão ausentes ou inválidos.');
  }
  let banco;
  try {
    banco = new URL(valores.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL inválida em .env.demo.local.');
  }
  if (
    banco.protocol !== 'postgresql:' ||
    !['127.0.0.1', 'localhost'].includes(banco.hostname) ||
    banco.port !== '55434' ||
    banco.pathname !== '/bordo_demo' ||
    banco.username !== 'bordo_demo' ||
    decodeURIComponent(banco.password) !== valores.DEMO_DB_SENHA ||
    banco.search !== '?schema=public' ||
    banco.hash !== '' ||
    valores.DIRECT_URL !== valores.DATABASE_URL
  ) {
    throw new Error(
      'Recusado: o banco precisa ser bordo_demo, usuário bordo_demo, ' +
        'em 127.0.0.1 ou localhost:55434, com DIRECT_URL igual à DATABASE_URL.',
    );
  }
  return valores;
}

function executar(comando, argumentos, ambiente, { capturar = false } = {}) {
  return new Promise((concluir, rejeitar) => {
    const processo = spawn(comando, argumentos, {
      cwd: raiz,
      env: ambiente,
      windowsHide: true,
      stdio: capturar ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let saida = '';
    if (capturar) processo.stdout.on('data', (dados) => (saida += dados.toString()));
    // Não propagar erros de conexão, pois podem conter a URL com credencial.
    if (capturar) processo.stderr.resume();
    processo.once('error', () => rejeitar(new Error(`Não foi possível executar ${comando}.`)));
    processo.once('exit', (codigo) => {
      if (codigo === 0) concluir(saida);
      else rejeitar(new Error(`${comando} encerrou com código ${codigo ?? 'indefinido'}.`));
    });
  });
}

async function exigirPortaLivre() {
  await new Promise((concluir, rejeitar) => {
    const teste = createServer();
    teste.once('error', () =>
      rejeitar(
        new Error('A porta 3001 está ocupada. Encerre a prévia anterior e tente novamente.'),
      ),
    );
    teste.listen(3001, '127.0.0.1', () => teste.close(concluir));
  });
}

async function main() {
  await validarArquivosDeAmbiente();
  const configuracao = await carregarConfiguracao();
  await exigirPortaLivre();

  // Somente variáveis do sistema operacional são herdadas. Credenciais e
  // opções Node de outro projeto não entram nos subprocessos da demonstração.
  const ambiente = Object.fromEntries(
    Object.entries(process.env).filter(([chave]) =>
      /^(path|systemroot|windir|comspec|pathext|temp|tmp|home|userprofile|localappdata|appdata|programdata|programfiles|programfiles\(x86\)|programw6432|commonprogramfiles|commonprogramfiles\(x86\)|commonprogramw6432|allusersprofile|public|os|processor_architecture|processor_architew6432|term|force_color|no_color)$/i.test(
        chave,
      ),
    ),
  );
  Object.assign(ambiente, configuracao, {
    NODE_ENV: 'development',
    TZ: 'America/Sao_Paulo',
    STORAGE_DRIVER: 'local',
    STORAGE_PATH: armazenamento,
    WHATSAPP_CANAL: 'link',
    LOG_NIVEL: 'info',
    BORDO_APRESENTACAO_PUBLICA: 'false',
    NEXT_TELEMETRY_DISABLED: '1',
  });

  try {
    await executar('docker', ['info', '--format', '{{.ServerVersion}}'], ambiente, {
      capturar: true,
    });
  } catch {
    throw new Error(
      'Abra o Docker Desktop e aguarde o mecanismo iniciar. Depois rode npm run dev:demo.',
    );
  }

  try {
    await executar('docker', ['compose', 'version', '--short'], ambiente, { capturar: true });
  } catch {
    throw new Error(
      'Docker Compose não foi encontrado. Ative o Docker Compose no Docker Desktop e tente novamente.',
    );
  }

  informar('Preparando o PostgreSQL exclusivo da demonstração (porta 55434)…');
  await executar(
    'docker',
    [
      'compose',
      '--project-name',
      'bordo-portfolio-demo',
      '--project-directory',
      raiz,
      '--env-file',
      arquivoEnv,
      '-f',
      arquivoCompose,
      'up',
      '-d',
      '--wait',
      '--wait-timeout',
      '90',
      'banco',
    ],
    ambiente,
  );
  const prismaCli = join(raiz, 'node_modules', 'prisma', 'build', 'index.js');
  await executar(process.execPath, [prismaCli, 'generate'], ambiente);
  await executar(process.execPath, [prismaCli, 'migrate', 'deploy'], ambiente);

  const contagem = JSON.parse(
    await executar(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const contagens = await Promise.all(Object.values(Prisma.ModelName).map((nome) => {
    const modelo = nome[0].toLowerCase() + nome.slice(1);
    return prisma[modelo].count();
  }));
  console.log(JSON.stringify({ total: contagens.reduce((soma, quantidade) => soma + quantidade, 0) }));
} finally { await prisma.$disconnect(); }`,
      ],
      ambiente,
      { capturar: true },
    ),
  );
  if (Object.values(contagem).every((quantidade) => quantidade === 0)) {
    informar('Banco novo: criando os dados fictícios e as contas de demonstração…');
    await executar(
      process.execPath,
      [join(raiz, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(raiz, 'prisma', 'seed-demo.ts')],
      ambiente,
    );
  } else {
    informar('Banco existente: os dados e as contas foram preservados; o seed não será repetido.');
  }

  await mkdir(armazenamento, { recursive: true });
  informar(`\nSistema completo: ${urlApp}/login`);
  informar('Administração: CPF 52998224725');
  informar('Motorista (Bruno): CPF 10000000361');
  informar(`Senha inicial das contas de demonstração: ${configuracao.DEMO_SENHA}`);
  informar('Se você alterou uma senha pelo sistema, use a senha atual dessa conta.');
  informar(
    'Os registros e o banco serão mantidos ao encerrar. Use Ctrl+C para parar o servidor.\n',
  );
  await executar(
    process.execPath,
    [
      join(raiz, 'node_modules', 'next', 'dist', 'bin', 'next'),
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3001',
    ],
    ambiente,
  );
}

main().catch((erro) => {
  console.error(`\nNão foi possível iniciar a demonstração: ${erro.message}`);
  process.exitCode = 1;
});
