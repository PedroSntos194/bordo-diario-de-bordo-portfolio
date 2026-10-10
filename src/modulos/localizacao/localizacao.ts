/**
 * Captura de localização no aparelho (US020 · RF016). ⚠️ V-06
 *
 * **Captura pontual**, não rastreamento contínuo: a posição é lida nos marcos
 * da corrida — início e encerramento — e nunca em segundo plano. É a premissa
 * adotada no doc 01 enquanto o V-06 não é respondido, e é o que permite o
 * sistema ser um PWA em vez de um aplicativo nativo.
 *
 * A regra que atravessa este módulo inteiro: **falta de GPS nunca bloqueia o
 * registro** (RN022). Um motorista que negou a permissão, está num subsolo ou
 * tem um aparelho velho continua conseguindo registrar o dia — o registro sai
 * marcado como "sem localização", e essa condição aparece no relatório.
 * Bloquear por falta de GPS empurraria o motorista de volta para o papel, que é
 * o problema que o sistema existe para resolver.
 */

export interface LocalizacaoCapturada {
  latitude: number;
  longitude: number;
  precisaoMetros: number | null;
  /** Relógio do aparelho, em ISO 8601. */
  capturadoEm: string;
}

export type ResultadoDaCaptura =
  | { situacao: 'CAPTURADA'; localizacao: LocalizacaoCapturada }
  | { situacao: 'PERMISSAO_NEGADA' }
  | { situacao: 'INDISPONIVEL' }
  | { situacao: 'TEMPO_ESGOTADO' };

/**
 * Tempo máximo de espera pelo GPS.
 *
 * Dez segundos é o limite do que uma pessoa em pé na porta da van tolera antes
 * de achar que o aplicativo travou. Esgotado o prazo, a corrida começa sem
 * coordenada em vez de deixar o motorista esperando.
 */
const TEMPO_LIMITE_MS = 10_000;

/** Aceita posição de até 1 minuto do cache do aparelho — evita esperar um novo fixo. */
const IDADE_MAXIMA_MS = 60_000;

interface OpcoesDaCaptura {
  tempoLimiteMs?: number;
  idadeMaximaMs?: number;
}

export async function capturarLocalizacao({
  tempoLimiteMs = TEMPO_LIMITE_MS,
  idadeMaximaMs = IDADE_MAXIMA_MS,
}: OpcoesDaCaptura = {}): Promise<ResultadoDaCaptura> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { situacao: 'INDISPONIVEL' };
  }

  return new Promise<ResultadoDaCaptura>((resolver) => {
    let finalizada = false;

    function concluir(resultado: ResultadoDaCaptura): void {
      if (finalizada) return;
      finalizada = true;
      clearTimeout(prazo);
      resolver(resultado);
    }

    // O timeout da API não conta a espera pela permissão ou pela aba visível.
    // Este prazo limita a espera inteira, mesmo quando o navegador não responde.
    // https://www.w3.org/TR/geolocation/#timeout-member
    const prazo = setTimeout(() => concluir({ situacao: 'TEMPO_ESGOTADO' }), tempoLimiteMs);

    try {
      navigator.geolocation.getCurrentPosition(
        (posicao) => {
          // getCurrentPosition não permite cancelar: ignore uma resposta tardia.
          if (finalizada) return;

          try {
            concluir({
              situacao: 'CAPTURADA',
              localizacao: {
                latitude: Number(posicao.coords.latitude.toFixed(7)),
                longitude: Number(posicao.coords.longitude.toFixed(7)),
                precisaoMetros:
                  typeof posicao.coords.accuracy === 'number'
                    ? Number(posicao.coords.accuracy.toFixed(2))
                    : null,
                capturadoEm: new Date(posicao.timestamp).toISOString(),
              },
            });
          } catch {
            concluir({ situacao: 'INDISPONIVEL' });
          }
        },
        (erro) => {
          if (finalizada) return;
          if (erro.code === erro.PERMISSION_DENIED) concluir({ situacao: 'PERMISSAO_NEGADA' });
          else if (erro.code === erro.TIMEOUT) concluir({ situacao: 'TEMPO_ESGOTADO' });
          else concluir({ situacao: 'INDISPONIVEL' });
        },
        {
          enableHighAccuracy: true,
          timeout: tempoLimiteMs,
          maximumAge: idadeMaximaMs,
        },
      );
    } catch {
      concluir({ situacao: 'INDISPONIVEL' });
    }
  });
}

/** Mensagem exibida ao motorista quando não houve captura. Nunca é um erro. */
export function explicarFalha(
  situacao: Exclude<ResultadoDaCaptura['situacao'], 'CAPTURADA'>,
): string {
  switch (situacao) {
    case 'PERMISSAO_NEGADA':
      return 'Localização desativada. O registro segue normalmente, sem a posição.';
    case 'TEMPO_ESGOTADO':
      return 'Não foi possível obter o sinal de GPS a tempo. O registro segue sem a posição.';
    case 'INDISPONIVEL':
      return 'Este aparelho não informou a localização. O registro segue sem a posição.';
  }
}
