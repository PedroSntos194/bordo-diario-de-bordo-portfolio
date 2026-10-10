import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import '@/estilos/globals.css';
import { COOKIE_DO_TEMA, COR_DA_BARRA, lerTema, type Tema } from '@/utilitarios/tema';

async function temaEscolhido(): Promise<Tema> {
  return lerTema((await cookies()).get(COOKIE_DO_TEMA)?.value);
}

export const metadata: Metadata = {
  title: {
    default: 'Bordo · Diário de Bordo Digital',
    template: '%s · Bordo',
  },
  description:
    'Registro digital de jornadas, rotas e corridas das vans de uma empresa de transporte. Substitui o diário de bordo em papel.',
  applicationName: 'Bordo',
  formatDetection: { telephone: false },

  /**
   * Instalação como aplicativo (US045 · RF044 · RNF021).
   *
   * O manifesto existia desde a Sprint 0 e **nunca foi declarado aqui** — sem
   * esta linha nenhum navegador chega a lê-lo, e o sistema jamais foi
   * instalável. Fica no layout raiz, e não no do motorista, porque a tag
   * precisa estar no `<head>` de todas as páginas: quem instala costuma fazer
   * isso a partir do login, antes de entrar em `/app`.
   */
  manifest: '/manifest.webmanifest',

  icons: {
    icon: [
      { url: '/icons/icone-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icone-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // O iOS ignora os ícones do manifesto e usa este; sem ele o atalho na tela
    // de início do iPhone sai com uma miniatura da página.
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },

  /**
   * `apple-mobile-web-app-capable`. É o que faz o iPhone abrir o atalho **sem a
   * barra de endereços** — o critério de "tela cheia" da US045. O Android
   * obtém o mesmo pelo `display: standalone` do manifesto; o iOS não lê o
   * manifesto para isso.
   */
  appleWebApp: {
    capable: true,
    title: 'Bordo',
    statusBarStyle: 'default',
  },

  /**
   * O Next emite `mobile-web-app-capable`, que é o nome padronizado e o que o
   * Chrome quer. O iPhone só passou a honrá-lo a partir do iOS 15.4; antes
   * disso, quem abre em tela cheia é a tag com prefixo `apple-`.
   *
   * Numa frota de vans ninguém troca de celular por causa de um sistema
   * interno, e é provável que haja aparelho antigo. Duas tags custam nada.
   */
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export async function generateViewport(): Promise<Viewport> {
  const tema = await temaEscolhido();
  return {
    width: 'device-width',
    initialScale: 1,
    // Sem `maximumScale`: impedir o zoom quebraria a acessibilidade (RNF022).
    // Acompanha `--color-fundo` do tema escolhido. O manifesto declara o claro,
    // que é o que o Android usa na tela de abertura e na barra de tarefas.
    themeColor:
      tema === 'sistema'
        ? [
            { media: '(prefers-color-scheme: light)', color: COR_DA_BARRA.claro },
            { media: '(prefers-color-scheme: dark)', color: COR_DA_BARRA.escuro },
          ]
        : COR_DA_BARRA[tema],
  };
}

export default async function LayoutRaiz({ children }: { children: React.ReactNode }) {
  // O tema vem do cookie e vai no `<html>` já na resposta do servidor: a tela
  // abre no tema certo, sem piscar (`src/utilitarios/tema.ts`).
  const tema = await temaEscolhido();

  return (
    <html lang="pt-BR" data-tema={tema}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
