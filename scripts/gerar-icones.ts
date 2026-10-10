import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Gera os ícones do aplicativo instalável a partir da marca do Bordo
 * (US045 · RF044 · RNF021).
 *
 *   npx tsx scripts/gerar-icones.ts
 *
 * Os PNGs são **versionados** no repositório; este script existe para que eles
 * tenham uma fonte, e não sejam binários que ninguém sabe de onde vieram nem
 * como refazer. A geometria é a de `src/componentes/marca/marca-bordo.tsx`
 * (a van de frente) — mudar lá é mudar aqui também. Até 48 px vale um desenho
 * simplificado, sem faróis nem grade, que no tamanho da aba virariam borrão.
 *
 * O `maskable` não tem cantos arredondados — é o sistema que recorta, em
 * círculo no Android — e a arte cabe no círculo central de 80%, a zona segura
 * desse formato. O `any` traz os cantos porque ninguém os aplica por ele.
 */

const RAIZ = process.cwd();
const DESTINO_ICONES = join(RAIZ, 'public', 'icons');

const ROXO = '#7c3aed';
const ROXO_CLARO = '#c4b5fd';
const BRANCO = '#ffffff';

/** Tamanho a partir do qual os detalhes da van aparecem. */
const TAMANHO_COM_DETALHES = 64;

interface Icone {
  arquivo: string;
  tamanho: number;
  /** Raio dos cantos no quadro de 512; zero quando o sistema recorta. */
  cantos: number;
  /** Escala da van dentro do quadro; menor que 1 afasta a arte das bordas. */
  escala: number;
}

const ICONES: Icone[] = [
  { arquivo: 'icone-192.png', tamanho: 192, cantos: 112, escala: 1 },
  { arquivo: 'icone-512.png', tamanho: 512, cantos: 112, escala: 1 },
  { arquivo: 'icone-mascara.png', tamanho: 512, cantos: 0, escala: 0.8 },
  /**
   * O iOS **não lê os ícones do manifesto** para a tela de início: ele usa
   * `apple-touch-icon`, em 180 px. Sem este arquivo, o atalho do iPhone sai com
   * uma miniatura da página — que é como o motorista percebe que "não é um
   * aplicativo de verdade".
   */
  { arquivo: 'apple-touch-icon.png', tamanho: 180, cantos: 0, escala: 0.9 },
];

/** A van no quadro de 64 de `marca-bordo.tsx`, completa ou simplificada. */
function desenhoDaVan(simplificada: boolean): string {
  if (simplificada) {
    return (
      `<rect x="11" y="10" width="42" height="38" rx="9" fill="${BRANCO}"/>` +
      `<rect x="16" y="15" width="32" height="14" rx="4" fill="${ROXO}"/>` +
      `<rect x="13" y="46" width="11" height="8" rx="3" fill="${BRANCO}"/>` +
      `<rect x="40" y="46" width="11" height="8" rx="3" fill="${BRANCO}"/>`
    );
  }
  return (
    `<rect x="14" y="13" width="36" height="33" rx="8" fill="${BRANCO}"/>` +
    `<rect x="18" y="17" width="28" height="12" rx="3" fill="${ROXO}"/>` +
    `<circle cx="21" cy="38" r="3" fill="${ROXO}"/>` +
    `<circle cx="43" cy="38" r="3" fill="${ROXO}"/>` +
    `<rect x="28" y="36" width="8" height="4" rx="2" fill="${ROXO_CLARO}"/>` +
    `<rect x="16" y="46" width="8" height="6" rx="2" fill="${BRANCO}"/>` +
    `<rect x="40" y="46" width="8" height="6" rx="2" fill="${BRANCO}"/>`
  );
}

/** A marca no tamanho pedido, com a van escalada a partir do centro. */
function svgDaMarca({ tamanho, cantos, escala }: Omit<Icone, 'arquivo'>): Buffer {
  const deslocamento = 32 * (1 - escala);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="${cantos / 8}" fill="${ROXO}"/>` +
      `<g transform="translate(${deslocamento} ${deslocamento}) scale(${escala})">` +
      desenhoDaVan(tamanho < TAMANHO_COM_DETALHES) +
      `</g></svg>`,
  );
}

async function montarIcone(icone: Omit<Icone, 'arquivo'>): Promise<Buffer> {
  return sharp(svgDaMarca(icone), { density: 72 * 4 })
    .resize(icone.tamanho, icone.tamanho, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Contêiner `.ico` com PNGs dentro — o formato que todo navegador atual lê. */
function montarIco(imagens: { tamanho: number; png: Buffer }[]): Buffer {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(imagens.length, 4);

  let deslocamento = 6 + 16 * imagens.length;
  const entradas = imagens.map(({ tamanho, png }) => {
    const entrada = Buffer.alloc(16);
    entrada.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0);
    entrada.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1);
    entrada.writeUInt16LE(1, 4);
    entrada.writeUInt16LE(32, 6);
    entrada.writeUInt32LE(png.byteLength, 8);
    entrada.writeUInt32LE(deslocamento, 12);
    deslocamento += png.byteLength;
    return entrada;
  });

  return Buffer.concat([cabecalho, ...entradas, ...imagens.map((i) => i.png)]);
}

const kb = (b: Buffer) => `${(b.byteLength / 1024).toFixed(1)} kB`;

await mkdir(DESTINO_ICONES, { recursive: true });
for (const icone of ICONES) {
  const png = await montarIcone(icone);
  await writeFile(join(DESTINO_ICONES, icone.arquivo), png);
  console.log(`  ${icone.arquivo} · ${icone.tamanho}px · ${kb(png)}`);
}

/**
 * O favicon fica em `/favicon.ico`, que é onde o navegador o procura sem
 * ninguém mandar. Três tamanhos: a aba usa 16 ou 32, e o Windows, 48.
 */
const favicon = montarIco(
  await Promise.all(
    [16, 32, 48].map(async (tamanho) => ({
      tamanho,
      png: await montarIcone({ tamanho, cantos: 112, escala: 1 }),
    })),
  ),
);
await writeFile(join(RAIZ, 'public', 'favicon.ico'), favicon);
console.log(`  favicon.ico · 16/32/48px · ${kb(favicon)}`);
