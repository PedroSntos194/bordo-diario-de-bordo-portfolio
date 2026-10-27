import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { criarServidorPortfolio } from '../../scripts/preview-portfolio.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'output', 'testes-preview');
let pasta;
let servidor;
let porta;

function consultar(caminho, method = 'GET') {
  return new Promise((concluir, rejeitar) => {
    const requisicao = request(
      { hostname: '127.0.0.1', port: porta, path: caminho, method },
      (resposta) => {
        let corpo = '';
        resposta.setEncoding('utf8');
        resposta.on('data', (parte) => {
          corpo += parte;
        });
        resposta.on('end', () =>
          concluir({ status: resposta.statusCode, headers: resposta.headers, corpo }),
        );
        resposta.on('error', rejeitar);
      },
    );
    requisicao.on('error', rejeitar);
    requisicao.end();
  });
}

before(async () => {
  await mkdir(raiz, { recursive: true });
  pasta = await mkdtemp(join(raiz, 'caso-'));
  const publico = join(pasta, 'publico');
  await mkdir(join(publico, '_next'), { recursive: true });
  await writeFile(join(publico, 'index.html'), '<h1>Apresentação</h1>');
  await writeFile(join(publico, 'apresentacao.html'), '<h1>Demonstração</h1>');
  await writeFile(join(publico, '_next', 'estilos.css'), 'body { color: purple; }');
  await writeFile(join(pasta, 'segredo.txt'), 'fora-da-pasta-publica');
  servidor = await criarServidorPortfolio({ diretorio: publico });
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  porta = servidor.address().port;
});

after(async () => {
  if (servidor?.listening) {
    await new Promise((concluir, rejeitar) =>
      servidor.close((erro) => (erro ? rejeitar(erro) : concluir())),
    );
  }
  if (pasta) {
    const diferenca = relative(raiz, resolve(pasta));
    assert.ok(
      diferenca &&
        diferenca !== '..' &&
        !diferenca.startsWith(`..${sep}`) &&
        !isAbsolute(diferenca),
    );
    await rm(pasta, { recursive: true, force: true });
  }
});

test('serve a apresentação e os recursos estáticos sem ambiente ou banco', async () => {
  const inicio = await consultar('/');
  assert.equal(inicio.status, 200);
  assert.match(inicio.corpo, /Apresentação/);
  assert.match(inicio.headers['content-type'], /^text\/html/);
  assert.equal((await consultar('/apresentacao')).corpo, '<h1>Demonstração</h1>');
  const estilo = await consultar('/_next/estilos.css');
  assert.equal(estilo.status, 200);
  assert.match(estilo.headers['content-type'], /^text\/css/);
  assert.equal(estilo.headers['x-content-type-options'], 'nosniff');
});

test('o login antigo abre a demonstração em vez do aplicativo completo', async () => {
  for (const caminho of ['/login', '/login/', '/login?retorno=%2Fadmin']) {
    const resposta = await consultar(caminho);
    assert.equal(resposta.status, 307);
    assert.equal(resposta.headers.location, '/apresentacao#demonstracao');
    assert.equal(resposta.corpo, '');
  }
});

test('não transforma páginas ou APIs inexistentes em uma apresentação', async () => {
  for (const caminho of ['/admin', '/api/auth/login', '/nao-existe', '/.env']) {
    assert.equal((await consultar(caminho)).status, 404);
  }
});

test('recusa caminhos que tentam sair da pasta pública', async () => {
  for (const caminho of [
    '/../segredo.txt',
    '/%2e%2e/segredo.txt',
    '/..%2fsegredo.txt',
    '/%5c..%5csegredo.txt',
    '/%00',
  ]) {
    const resposta = await consultar(caminho);
    assert.equal(resposta.status, 400);
    assert.doesNotMatch(resposta.corpo, /fora-da-pasta-publica/);
  }
});

test('aceita HEAD e rejeita métodos de gravação', async () => {
  const head = await consultar('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.corpo, '');
  assert.ok(Number(head.headers['content-length']) > 0);
  const post = await consultar('/', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});
