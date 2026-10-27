import { spawn } from 'node:child_process';
import { access, cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projeto = join(raiz, 'output', 'portfolio-build');
const aplicativo = join(projeto, 'app');
const apresentacao = join(aplicativo, 'apresentacao');

function caminhoRelativo(origem, destino) {
  const caminho = relative(origem, destino).split(sep).join('/');
  return caminho.startsWith('.') ? caminho : `./${caminho}`;
}

async function escrever(caminho, conteudo) {
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, conteudo, 'utf8');
}

async function copiarSeExistir(origem, destino) {
  try {
    await access(origem);
  } catch (erro) {
    if (erro.code === 'ENOENT') return;
    throw erro;
  }
  await cp(origem, destino, { recursive: true });
}

// A aplicação gerada contém somente a apresentação pública. O layout original,
// middleware, APIs, banco, cookies e arquivos .env não fazem parte deste app.
// Sobrescrevemos apenas os arquivos conhecidos, sem apagar pastas do projeto.
const paginaOriginal = join(raiz, 'src', 'app', '(publico)', 'apresentacao', 'page');
for (const pasta of [aplicativo, apresentacao]) {
  await escrever(
    join(pasta, 'page.tsx'),
    `export { default, metadata } from ${JSON.stringify(caminhoRelativo(pasta, paginaOriginal))};\n`,
  );
}

await escrever(
  join(aplicativo, 'layout.tsx'),
  `import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Bordo · Diário de Bordo Digital', template: '%s · Bordo' },
  description: 'Conheça o Bordo: diário de bordo digital para frotas de vans, com demonstração interativa e dados fictícios.',
  applicationName: 'Bordo',
  formatDetection: { telephone: false },
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fbf8ff',
};

export default function LayoutPortfolio({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-tema="claro">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
`,
);

const cssOriginal = caminhoRelativo(aplicativo, join(raiz, 'src', 'estilos', 'globals.css'));
const fontesDeEstilo = [
  join(raiz, 'src', 'app', '(publico)', 'apresentacao'),
  join(raiz, 'src', 'modulos', 'apresentacao'),
  join(raiz, 'src', 'componentes', 'marca'),
];
await escrever(
  join(aplicativo, 'globals.css'),
  [
    `@import ${JSON.stringify(cssOriginal)};`,
    ...fontesDeEstilo.map(
      (pasta) => `@source ${JSON.stringify(caminhoRelativo(aplicativo, pasta))};`,
    ),
    '',
  ].join('\n'),
);

await escrever(
  join(projeto, 'next.config.mjs'),
  `import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  images: { unoptimized: true },
  outputFileTracingRoot: raiz,
  experimental: { externalDir: true },
};
`,
);
await escrever(
  join(projeto, 'postcss.config.mjs'),
  `export default { plugins: { '@tailwindcss/postcss': {} } };\n`,
);
await escrever(
  join(projeto, 'package.json'),
  `${JSON.stringify({ name: 'bordo-apresentacao-publica', private: true, type: 'module' }, null, 2)}\n`,
);
await escrever(
  join(projeto, 'tsconfig.json'),
  `${JSON.stringify(
    {
      extends: caminhoRelativo(projeto, join(raiz, 'tsconfig.json')),
      compilerOptions: {
        baseUrl: raiz,
        paths: { '@/*': ['src/*'] },
      },
      include: ['next-env.d.ts', 'app/**/*.ts', 'app/**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    },
    null,
    2,
  )}\n`,
);
await escrever(
  join(projeto, 'next-env.d.ts'),
  '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
);

await mkdir(join(projeto, 'public'), { recursive: true });
await cp(join(raiz, 'public', 'apresentacao'), join(projeto, 'public', 'apresentacao'), {
  recursive: true,
});
for (const nome of ['favicon.ico', 'icons']) {
  await copiarSeExistir(join(raiz, 'public', nome), join(projeto, 'public', nome));
}

// Somente o subprocesso recebe a flag de apresentação. Credenciais e opções
// Node herdadas do terminal não são necessárias para gerar arquivos estáticos.
const ambiente = Object.fromEntries(
  Object.entries(process.env).filter(([chave]) =>
    /^(path|systemroot|windir|comspec|pathext|temp|tmp|home|userprofile|localappdata|ci|term|force_color|no_color)$/i.test(
      chave,
    ),
  ),
);
Object.assign(ambiente, {
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  BORDO_APRESENTACAO_PUBLICA: 'true',
});

process.stdout.write('Construindo a apresentação pública e a demonstração estática…\n');
await new Promise((concluir, rejeitar) => {
  const processo = spawn(
    process.execPath,
    [join(raiz, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build', projeto],
    { cwd: projeto, env: ambiente, stdio: 'inherit', windowsHide: true },
  );
  processo.once('error', rejeitar);
  processo.once('exit', (codigo, sinal) => {
    if (codigo === 0) concluir();
    else rejeitar(new Error(`O build da apresentação falhou (${sinal ?? codigo}).`));
  });
});
process.stdout.write(`Apresentação pronta em ${join(projeto, 'out')}\n`);
