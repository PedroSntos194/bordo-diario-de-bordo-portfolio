import { describe, expect, it } from 'vitest';
import {
  PASSOS_NO_IPHONE,
  identificarPlataforma,
  modoDoConvite,
  type EstadoDaInstalacao,
} from '@/offline/instalacao.regras';

/** US045 — quando e como convidar a instalar o aplicativo. */

const ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

function estado(sobrescritas: Partial<EstadoDaInstalacao> = {}): EstadoDaInstalacao {
  return {
    jaInstalado: false,
    temEventoDeInstalacao: false,
    plataforma: 'android',
    dispensado: false,
    ...sobrescritas,
  };
}

describe('identificarPlataforma', () => {
  it('reconhece Android e iPhone', () => {
    expect(identificarPlataforma(ANDROID)).toBe('android');
    expect(identificarPlataforma(IPHONE)).toBe('ios');
  });

  it('reconhece o iPad, que se anuncia como Macintosh', () => {
    // Sem os pontos de toque, um iPad é indistinguível de um Mac — e o
    // motorista de iPad nunca receberia o passo a passo do Compartilhar.
    expect(identificarPlataforma(IPAD, 5)).toBe('ios');
    expect(identificarPlataforma(IPAD, 0)).toBe('desktop');
  });

  it('reconhece o computador', () => {
    expect(identificarPlataforma(WINDOWS)).toBe('desktop');
  });

  it('não chuta diante de um user agent que não conhece', () => {
    expect(identificarPlataforma('curl/8.4.0')).toBe('desconhecida');
  });
});

describe('modoDoConvite', () => {
  it('oferece o botão quando o navegador avisa que dá para instalar', () => {
    expect(modoDoConvite(estado({ temEventoDeInstalacao: true }))).toBe('BOTAO');
  });

  it('no iPhone, mostra o passo a passo — lá não existe evento', () => {
    expect(modoDoConvite(estado({ plataforma: 'ios' }))).toBe('INSTRUCOES_IOS');
  });

  it('não convida quem já instalou', () => {
    // O erro mais visível possível: abrir pelo ícone e o aplicativo pedir para
    // ser instalado.
    expect(modoDoConvite(estado({ jaInstalado: true, temEventoDeInstalacao: true }))).toBe(
      'NENHUM',
    );
    expect(modoDoConvite(estado({ jaInstalado: true, plataforma: 'ios' }))).toBe('NENHUM');
  });

  it('não insiste com quem já dispensou', () => {
    expect(modoDoConvite(estado({ dispensado: true, temEventoDeInstalacao: true }))).toBe('NENHUM');
    expect(modoDoConvite(estado({ dispensado: true, plataforma: 'ios' }))).toBe('NENHUM');
  });

  it('fica calado no computador e no desconhecido, sem o evento', () => {
    expect(modoDoConvite(estado({ plataforma: 'desktop' }))).toBe('NENHUM');
    expect(modoDoConvite(estado({ plataforma: 'desconhecida' }))).toBe('NENHUM');
  });

  it('no computador, o evento do navegador ainda vale', () => {
    // O Chrome no Windows instala PWA; se ele oferecer, não há razão para
    // recusar só porque não é celular.
    expect(modoDoConvite(estado({ plataforma: 'desktop', temEventoDeInstalacao: true }))).toBe(
      'BOTAO',
    );
  });
});

describe('PASSOS_NO_IPHONE', () => {
  it('usa os nomes que aparecem na tela do aparelho, em português', () => {
    const texto = PASSOS_NO_IPHONE.join(' ');

    expect(texto).toContain('Compartilhar');
    expect(texto).toContain('Adicionar à Tela de Início');
    // "Add to Home Screen" não seria traduzido por quem está com pressa.
    expect(texto).not.toContain('Home Screen');
  });
});
