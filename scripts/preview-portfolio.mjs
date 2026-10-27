import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const arquivoDoScript = fileURLToPath(import.meta.url);
const diretorioPadrao = resolve(dirname(arquivoDoScript), '..', 'output', 'portfolio-build', 'out');
const portaPadrao = 3001;
const tiposDeConteudo = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function estaDentroDoDiretorio(diretorio, caminho) {
  const diferenca = relative(diretorio, caminho);
  return (
    diferenca === '' ||
    (diferenca !== '..' && !diferenca.startsWith(`..${sep}`) && !isAbsolute(diferenca))
  );
}

function caminhoDaRequisicao(url) {
  // Inspecione o caminho original antes de qualquer normalização de URL:
  // new URL('/../arquivo', base) esconderia a tentativa de sair da pasta.
  const original = (url ?? '').split('?')[0];
  const invalido = (caminho) =>
    !caminho.startsWith('/') ||
    caminho.startsWith('//') ||
    /[\\\0:]/.test(caminho) ||
    caminho.split('/').some((parte) => parte === '.' || parte === '..');

  if (invalido(original)) throw new URIError('Caminho inválido.');
  const caminho = decodeURIComponent(original);
  if (invalido(caminho)) throw new URIError('Caminho inválido.');
  return caminho;
}

function responderTexto(requisicao, resposta, codigo, mensagem, cabecalhos = {}) {
  const corpo = `${mensagem}\n`;
  resposta.writeHead(codigo, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
    ...cabecalhos,
  });
  resposta.end(requisicao.method === 'HEAD' ? undefined : corpo);
}

/** Cria a prévia estática, sem carregar o aplicativo, o banco ou arquivos .env. */
export async function criarServidorPortfolio({ diretorio = diretorioPadrao } = {}) {
  let raiz;
  try {
    raiz = await realpath(resolve(diretorio));
    const indice = await realpath(join(raiz, 'index.html'));
    if (!estaDentroDoDiretorio(raiz, indice) || !(await stat(indice)).isFile()) {
      throw new Error('O índice da apresentação precisa ser um arquivo dentro da pasta de saída.');
    }
  } catch (erro) {
    if (erro.code === 'ENOENT' || erro.code === 'ENOTDIR') {
      throw new Error(
        'A apresentação ainda não foi gerada. Execute npm run build:portfolio antes de abrir a prévia.',
      );
    }
    throw erro;
  }

  return createServer(async (requisicao, resposta) => {
    resposta.setHeader('X-Content-Type-Options', 'nosniff');
    resposta.setHeader('X-Frame-Options', 'DENY');
    resposta.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    resposta.setHeader('Cache-Control', 'no-store');

    if (requisicao.method !== 'GET' && requisicao.method !== 'HEAD') {
      responderTexto(requisicao, resposta, 405, 'Método não permitido.', { Allow: 'GET, HEAD' });
      return;
    }

    try {
      const caminho = caminhoDaRequisicao(requisicao.url);
      if (caminho === '/login' || caminho === '/login/') {
        resposta.writeHead(307, { Location: '/apresentacao#demonstracao', 'Content-Length': '0' });
        resposta.end();
        return;
      }

      const arquivo =
        caminho === '/'
          ? 'index.html'
          : caminho === '/apresentacao' || caminho === '/apresentacao/'
            ? 'apresentacao.html'
            : `.${caminho}`;
      const candidato = resolve(raiz, arquivo);
      if (!estaDentroDoDiretorio(raiz, candidato)) {
        responderTexto(requisicao, resposta, 403, 'Acesso não permitido.');
        return;
      }

      const arquivoReal = await realpath(candidato);
      if (!estaDentroDoDiretorio(raiz, arquivoReal)) {
        responderTexto(requisicao, resposta, 403, 'Acesso não permitido.');
        return;
      }

      const informacoes = await stat(arquivoReal);
      if (!informacoes.isFile()) {
        responderTexto(requisicao, resposta, 404, 'Página ou arquivo não encontrado.');
        return;
      }

      resposta.writeHead(200, {
        'Content-Type':
          tiposDeConteudo.get(extname(arquivoReal).toLowerCase()) ?? 'application/octet-stream',
        'Content-Length': informacoes.size,
      });
      if (requisicao.method === 'HEAD') {
        resposta.end();
        return;
      }
      await pipeline(createReadStream(arquivoReal), resposta);
    } catch (erro) {
      if (resposta.headersSent) {
        resposta.destroy();
      } else if (erro instanceof URIError) {
        responderTexto(requisicao, resposta, 400, 'Caminho inválido.');
      } else if (erro.code === 'ENOENT' || erro.code === 'ENOTDIR') {
        responderTexto(requisicao, resposta, 404, 'Página ou arquivo não encontrado.');
      } else if (erro.code === 'EACCES' || erro.code === 'EPERM') {
        responderTexto(requisicao, resposta, 403, 'Acesso não permitido.');
      } else {
        responderTexto(requisicao, resposta, 500, 'Não foi possível carregar a apresentação.');
      }
    }
  });
}

function lerPorta(argumentos) {
  if (argumentos.length === 0) return portaPadrao;
  const valor =
    argumentos.length === 2 && argumentos[0] === '--port'
      ? argumentos[1]
      : argumentos.length === 1 && argumentos[0].startsWith('--port=')
        ? argumentos[0].slice('--port='.length)
        : undefined;
  const porta = Number(valor);
  if (!valor || !/^\d+$/.test(valor) || !Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error('Use --port seguido de uma porta inteira entre 1 e 65535.');
  }
  return porta;
}

if (process.argv[1] && resolve(process.argv[1]) === arquivoDoScript) {
  try {
    const porta = lerPorta(process.argv.slice(2));
    const servidor = await criarServidorPortfolio();
    await new Promise((concluir, rejeitar) => {
      servidor.once('error', rejeitar);
      servidor.listen(porta, '127.0.0.1', () => {
        servidor.off('error', rejeitar);
        concluir();
      });
    });
    process.stdout.write(`Apresentação e demonstração disponíveis em http://127.0.0.1:${porta}\n`);
    for (const sinal of ['SIGINT', 'SIGTERM']) {
      process.once(sinal, () => servidor.close());
    }
  } catch (erro) {
    process.stderr.write(
      erro.code === 'EADDRINUSE'
        ? 'A porta já está em uso. Escolha outra com --port 3002.\n'
        : `${erro.message}\n`,
    );
    process.exitCode = 1;
  }
}
