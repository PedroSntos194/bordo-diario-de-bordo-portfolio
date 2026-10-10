/**
 * Regras do convite de instalação (US045 · RF044 · RNF021).
 *
 * Funções puras, testáveis sem navegador. Ficam em `src/offline/` porque é onde
 * o doc 15 coloca o PWA, e não em `src/modulos/`: instalar o aplicativo não é
 * regra de negócio — é característica da plataforma. O sufixo `.regras.ts` é
 * mantido pelo mesmo motivo de sempre: sinaliza "puro, sem efeito, testado".
 *
 * O que há de real para decidir aqui é **quando** e **como** convidar, e as
 * duas perguntas têm respostas diferentes por plataforma.
 */

export type Plataforma = 'android' | 'ios' | 'desktop' | 'desconhecida';

/**
 * Identifica a plataforma pelo *user agent*.
 *
 * Farejar o navegador é normalmente má prática — e aqui é inevitável. O Chrome
 * avisa que a instalação é possível pelo evento `beforeinstallprompt`; o Safari
 * do iPhone **não tem esse evento e nunca terá**: lá a instalação é um gesto
 * manual no menu Compartilhar. Sem distinguir os dois, ou o motorista de iPhone
 * nunca fica sabendo que dá para instalar, ou o de Android recebe uma instrução
 * que não corresponde ao aparelho dele.
 *
 * O iPad moderno se anuncia como Macintosh; o `maxTouchPoints` é o que o
 * separa de um Mac de verdade.
 */
export function identificarPlataforma(userAgent: string, pontosDeToque = 0): Plataforma {
  const ua = userAgent.toLowerCase();

  if (/android/.test(ua)) return 'android';
  if (/iphone|ipod|ipad/.test(ua)) return 'ios';
  if (/macintosh/.test(ua) && pontosDeToque > 1) return 'ios';
  if (/windows|macintosh|linux|cros/.test(ua)) return 'desktop';

  return 'desconhecida';
}

export type ModoDoConvite =
  /** O navegador ofereceu o evento: um toque instala. */
  | 'BOTAO'
  /** Sem evento, mas dá para instalar à mão — mostra o passo a passo. */
  | 'INSTRUCOES_IOS'
  /** Nada a convidar: já instalado, dispensado, ou plataforma sem instalação. */
  | 'NENHUM';

export interface EstadoDaInstalacao {
  /** O aplicativo já está rodando instalado, em tela cheia. */
  jaInstalado: boolean;
  /** O navegador disponibilizou `beforeinstallprompt`. */
  temEventoDeInstalacao: boolean;
  plataforma: Plataforma;
  /** O usuário já dispensou o convite antes. */
  dispensado: boolean;
}

/**
 * Decide o que mostrar.
 *
 * A ordem das recusas importa. `jaInstalado` vem primeiro porque convidar quem
 * já instalou é o erro mais visível — o motorista abre pelo ícone e o próprio
 * aplicativo pede para ser instalado. `dispensado` vem em seguida: quem disse
 * não uma vez não pode ser perguntado de novo a cada tela, que é como um
 * convite se transforma em incômodo e o incômodo em desinstalação.
 */
export function modoDoConvite(estado: EstadoDaInstalacao): ModoDoConvite {
  if (estado.jaInstalado) return 'NENHUM';
  if (estado.dispensado) return 'NENHUM';
  if (estado.temEventoDeInstalacao) return 'BOTAO';
  if (estado.plataforma === 'ios') return 'INSTRUCOES_IOS';

  return 'NENHUM';
}

/**
 * Passos da instalação manual no iPhone.
 *
 * Escritos com os nomes que aparecem na tela do aparelho, em português: quem
 * está de pé na porta da van não traduz "Add to Home Screen".
 */
export const PASSOS_NO_IPHONE = [
  'Toque no botão Compartilhar, embaixo na barra do Safari.',
  'Role a lista e escolha "Adicionar à Tela de Início".',
  'Confirme em "Adicionar". O ícone do Bordo aparece junto com os outros aplicativos.',
] as const;

/** Chave usada para lembrar a dispensa entre visitas. */
export const CHAVE_DE_DISPENSA = 'bordo:convite-instalacao-dispensado';
