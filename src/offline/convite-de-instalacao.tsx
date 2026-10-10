'use client';

import { useEffect, useState } from 'react';
import { Share, Smartphone, X } from 'lucide-react';
import { Botao } from '@/componentes/ui/botao';
import {
  CHAVE_DE_DISPENSA,
  PASSOS_NO_IPHONE,
  identificarPlataforma,
  modoDoConvite,
  type ModoDoConvite,
} from '@/offline/instalacao.regras';

/**
 * Convite para instalar o aplicativo na tela inicial (US045 · RF044).
 *
 * O convite fica na área do motorista, e é uma faixa discreta no rodapé da
 * tela — não um modal. O motivo é o mesmo que orienta o projeto inteiro: quem
 * abre o Bordo está de pé na porta da van, com pressa, e um modal entre ele e o
 * botão "iniciar meu dia" atrapalha a tarefa para vender uma conveniência.
 *
 * A conveniência, ainda assim, é real: aberto pelo ícone o sistema roda em tela
 * cheia, sem barra de endereços, e o motorista deixa de precisar digitar o
 * endereço — que é uma das razões pelas quais o papel ganhava do digital.
 */

/** O evento do Chrome não está nos tipos padrão do DOM. */
interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Lê a dispensa **na hora de decidir**, e não uma vez na montagem.
 *
 * O Chrome dispara `beforeinstallprompt` de novo a cada navegação dentro do
 * aplicativo. Guardar a resposta numa variável lida só na montagem fazia o
 * convite reaparecer logo depois de o motorista fechá-lo — que é exatamente o
 * incômodo que a regra de não insistir existe para evitar. Ler a cada avaliação
 * também acerta o caso de duas abas abertas.
 */
function foiDispensado(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_DE_DISPENSA) === '1';
  } catch {
    // Janela anônima com armazenamento bloqueado: pior caso, o convite
    // reaparece na próxima visita. Não é motivo para deixar de convidar.
    return false;
  }
}

export function ConviteDeInstalacao() {
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);
  const [modo, setModo] = useState<ModoDoConvite>('NENHUM');
  const [mostrandoPassos, setMostrandoPassos] = useState(false);

  useEffect(() => {
    // `display-mode: standalone` é como o navegador responde "estou rodando
    // instalado". No iOS antigo a resposta vem por `navigator.standalone`.
    const instalado =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    const plataforma = identificarPlataforma(navigator.userAgent, navigator.maxTouchPoints);

    const avaliar = (comEvento: boolean): void =>
      setModo(
        modoDoConvite({
          jaInstalado: instalado,
          temEventoDeInstalacao: comEvento,
          plataforma,
          dispensado: foiDispensado(),
        }),
      );

    avaliar(false);

    const aoPoderInstalar = (bruto: Event): void => {
      // Sem isto o Chrome mostra a própria barra de instalação, e o motorista
      // vê dois convites diferentes para a mesma coisa.
      bruto.preventDefault();
      setEvento(bruto as EventoDeInstalacao);
      avaliar(true);
    };

    const aoInstalar = (): void => setModo('NENHUM');

    window.addEventListener('beforeinstallprompt', aoPoderInstalar);
    window.addEventListener('appinstalled', aoInstalar);

    return () => {
      window.removeEventListener('beforeinstallprompt', aoPoderInstalar);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  function dispensar(): void {
    try {
      window.localStorage.setItem(CHAVE_DE_DISPENSA, '1');
    } catch {
      /* sem armazenamento: o convite volta na próxima visita */
    }
    setModo('NENHUM');
  }

  async function instalar(): Promise<void> {
    if (!evento) return;

    await evento.prompt();
    const escolha = await evento.userChoice;

    // Recusar no diálogo do navegador conta como dispensa: insistir depois de
    // um "não" explícito é o caminho para o motorista desinstalar.
    if (escolha.outcome === 'dismissed') dispensar();
    else setModo('NENHUM');

    setEvento(null);
  }

  if (modo === 'NENHUM') return null;

  return (
    <div className="border-borda bg-superficie rounded-[--radius-padrao] border p-3">
      <div className="flex items-start gap-3">
        <Smartphone aria-hidden className="text-primaria mt-0.5 size-5 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="text-texto text-sm font-medium">Instale o Bordo no seu celular</p>
          <p className="text-texto-suave text-sm">
            Fica um ícone junto com os outros aplicativos. Abre em tela cheia, sem digitar endereço,
            e funciona mesmo quando o sinal cai.
          </p>

          {modo === 'BOTAO' ? (
            <Botao
              type="button"
              tamanho="compacto"
              className="mt-2"
              onClick={() => void instalar()}
            >
              Instalar
            </Botao>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMostrandoPassos((atual) => !atual)}
                aria-expanded={mostrandoPassos}
                className="text-primaria mt-2 flex min-h-9 items-center gap-1.5 text-sm font-medium underline"
              >
                <Share aria-hidden className="size-4" />
                Como instalar no iPhone
              </button>

              {mostrandoPassos ? (
                <ol className="text-texto-suave mt-1 list-decimal space-y-1 pl-5 text-sm">
                  {PASSOS_NO_IPHONE.map((passo) => (
                    <li key={passo}>{passo}</li>
                  ))}
                </ol>
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={dispensar}
          aria-label="Dispensar o convite de instalação"
          className="text-texto-suave hover:bg-borda/40 flex size-9 shrink-0 items-center justify-center rounded-[--radius-padrao]"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
