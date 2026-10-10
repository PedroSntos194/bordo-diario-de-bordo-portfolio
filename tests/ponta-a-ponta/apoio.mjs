import { existsSync, readFileSync } from 'node:fs';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VERSAO_AVISO_PRIVACIDADE } from '../../src/modulos/privacidade/aviso-privacidade.ts';

/**
 * Apoio comum aos roteiros ponta a ponta (ver README desta pasta).
 *
 * Os roteiros **gravam dados** — vans, rotas, motoristas, jornadas — e por
 * isso só falam com servidor local. Duas travas, antes de qualquer requisição:
 *
 * 1. o endereço tem que ser `localhost`, `127.0.0.1`, `::1` ou `*.localhost`,
 *    e nenhum redirecionamento pode levar para fora dele;
 * 2. o ambiente não pode ser o de produção — nem `APP_AMBIENTE=producao`, nem
 *    um `DATABASE_URL` que aponte para o mesmo banco do `.env.producao`.
 *
 * Nenhuma credencial fica no código: a do administrador vem de variável de
 * ambiente, e as dos motoristas que o roteiro cria são geradas na hora.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** O mesmo nome de `NOME_COOKIE_SESSAO`, em `src/lib/sessao.ts`. */
export const COOKIE_DE_SESSAO = 'bordo_sessao';

function exigirServidorLocal(endereco) {
  let url;
  try {
    url = new URL(endereco);
  } catch {
    throw new Error(`E2E_BASE_URL inválida: ${endereco}`);
  }
  const host = url.hostname;
  if (!HOSTS_LOCAIS.has(host) && !host.endsWith('.localhost')) {
    throw new Error(
      `Recusado: ${url.origin} não é um servidor local. ` +
        'Estes roteiros gravam dados e só rodam contra localhost.',
    );
  }
  return url.origin;
}

function hostDoBanco(url) {
  try {
    // Pooler e conexão direta do Neon diferem só pelo `-pooler` no host.
    return new URL(url).hostname.replace('-pooler', '');
  } catch {
    return null;
  }
}

function exigirAmbienteQueNaoSejaProducao() {
  if ((process.env.APP_AMBIENTE ?? '').trim().toLowerCase() === 'producao') {
    throw new Error('Recusado: APP_AMBIENTE=producao neste ambiente.');
  }

  const atual = hostDoBanco(process.env.DATABASE_URL ?? '');
  const arquivo = resolve(RAIZ, '.env.producao');
  if (!atual || !existsSync(arquivo)) return;

  // Lido só para comparar o host — nada deste arquivo é exibido.
  const conteudo = readFileSync(arquivo, 'utf8');
  for (const chave of ['DATABASE_URL', 'DIRECT_URL']) {
    const valor = new RegExp(`^${chave}=["']?([^"'\\r\\n]+)`, 'm').exec(conteudo)?.[1];
    if (valor && hostDoBanco(valor) === atual) {
      throw new Error(
        'Recusado: o DATABASE_URL deste ambiente aponta para o mesmo banco do .env.producao.',
      );
    }
  }
}

/** Lê e valida a configuração. Lança erro — e nada é requisitado — se algo não confere. */
export function prepararAmbiente() {
  const base = exigirServidorLocal(process.env.E2E_BASE_URL ?? 'http://localhost:3000');
  exigirAmbienteQueNaoSejaProducao();

  // Nenhuma credencial no código, nem a do seed: o CPF e a senha do
  // administrador local vêm do ambiente de quem roda.
  const adminCpf = process.env.E2E_ADMIN_CPF ?? process.env.SEED_ADMIN_CPF;
  const adminSenha = process.env.E2E_ADMIN_SENHA;
  if (!adminCpf || !adminSenha) {
    throw new Error(
      'Defina E2E_ADMIN_CPF e E2E_ADMIN_SENHA com o CPF que o seed mostrou e a senha ' +
        'definitiva do administrador do banco local (ver README desta pasta).',
    );
  }

  return {
    base,
    adminCpf,
    adminSenha,
    cronSecret: process.env.CRON_SECRET ?? '',
    versaoAviso: VERSAO_AVISO_PRIVACIDADE,
    // Um prefixo de IP por execução: o limite de login (10 por IP a cada 15 min)
    // fica em memória no servidor, e rodar duas vezes seguidas com os mesmos IPs
    // faria a segunda execução tropeçar no limite da primeira.
    prefixoIp: `10.${randomInt(1, 255)}.${randomInt(0, 255)}`,
    hoje: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
  };
}

export function criarRelatorio() {
  const itens = [];
  const registrar = (situacao, nome, detalhe = '') => {
    itens.push({ situacao, nome, detalhe });
    console.log(`${situacao} | ${nome}${detalhe ? ` | ${detalhe}` : ''}`);
  };

  return {
    secao(titulo) {
      console.log(`\n=== ${titulo}`);
    },
    ok(condicao, nome, detalhe) {
      registrar(condicao ? 'PASSOU' : 'FALHOU', nome, detalhe);
      return Boolean(condicao);
    },
    /** Depende de algo fora do sistema (internet, segredo não configurado): não reprova. */
    pular(nome, motivo) {
      registrar('PULADO', nome, motivo);
    },
    encerrar() {
      const contar = (situacao) => itens.filter((item) => item.situacao === situacao).length;
      const falhas = itens.filter((item) => item.situacao === 'FALHOU');
      console.log(
        `\n=== TOTAL: ${contar('PASSOU')} passaram, ${falhas.length} falharam, ` +
          `${contar('PULADO')} pulados`,
      );
      for (const falha of falhas) console.log(`  ✗ ${falha.nome} | ${falha.detalhe}`);
      process.exitCode = falhas.length > 0 ? 1 : 0;
    },
  };
}

/** Cliente HTTP com cookies próprios — cada instância é uma pessoa diferente. */
export class Cliente {
  constructor(ambiente, finalDoIp) {
    this.base = ambiente.base;
    this.ip = `${ambiente.prefixoIp}.${finalDoIp}`;
    this.cookies = {};
  }

  async req(metodo, caminho, corpo, extra = {}) {
    const url = new URL(caminho, this.base);
    if (url.origin !== this.base)
      throw new Error(`Recusado: ${url.origin} fora do servidor local.`);

    const headers = { 'x-forwarded-for': this.ip, ...(extra.headers ?? {}) };
    const cookie = Object.entries(this.cookies)
      .map(([nome, valor]) => `${nome}=${valor}`)
      .join('; ');
    if (cookie) headers.cookie = cookie;

    let body;
    if (corpo instanceof FormData) body = corpo;
    else if (corpo !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(corpo);
    }

    const resposta = await fetch(url, { method: metodo, headers, body, redirect: 'manual' });
    for (const definicao of resposta.headers.getSetCookie?.() ?? []) {
      const [par] = definicao.split(';');
      const igual = par.indexOf('=');
      const nome = par.slice(0, igual).trim();
      const valor = par.slice(igual + 1).trim();
      if (valor === '' || /max-age=0/i.test(definicao)) delete this.cookies[nome];
      else this.cookies[nome] = valor;
    }

    const tipo = resposta.headers.get('content-type') ?? '';
    let dados;
    if (extra.binario) dados = Buffer.from(await resposta.arrayBuffer());
    else if (tipo.includes('json')) dados = await resposta.json().catch(() => null);
    else dados = await resposta.text().catch(() => '');
    return { status: resposta.status, dados, headers: resposta.headers };
  }

  get(caminho, extra) {
    return this.req('GET', caminho, undefined, extra);
  }
  post(caminho, corpo, extra) {
    return this.req('POST', caminho, corpo ?? {}, extra);
  }
  put(caminho, corpo) {
    return this.req('PUT', caminho, corpo);
  }
  patch(caminho, corpo) {
    return this.req('PATCH', caminho, corpo);
  }

  /** Segue redirecionamentos — só dentro do servidor local — e conta quantos foram. */
  async seguir(caminho, maximo = 8) {
    let atual = caminho;
    for (let saltos = 0; saltos <= maximo; saltos++) {
      const resposta = await this.get(atual);
      const destino = resposta.headers.get('location');
      if (![301, 302, 303, 307, 308].includes(resposta.status) || !destino) {
        return { ...resposta, caminho: atual, saltos };
      }
      atual = new URL(destino, this.base).pathname + new URL(destino, this.base).search;
    }
    return { status: 0, dados: '', headers: new Headers(), caminho: atual, saltos: maximo + 1 };
  }
}

/** CPF válido gerado na hora. Só existe no banco local do teste — nunca no repositório. */
export function cpfAleatorio() {
  const digitos = Array.from({ length: 9 }, () => randomInt(10));
  const verificador = (base) => {
    const soma = base.reduce((total, digito, i) => total + digito * (base.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  digitos.push(verificador(digitos));
  digitos.push(verificador(digitos));
  return digitos.join('');
}

/** Senha para os usuários que o roteiro cria: letra e número, como pede a política. */
export function senhaAleatoria() {
  return `T${randomBytes(8).toString('hex')}7`;
}

/** Valor errado de propósito, para testar recusa. Também gerado na hora. */
export function valorErrado() {
  return `errado-${randomUUID()}`;
}

export function placaAleatoria() {
  const letras = Array.from({ length: 3 }, () => 'ABCDEFGHJKLMNPRSTUVWXZ'[randomInt(22)]).join('');
  return `${letras}${randomInt(1000, 9999)}`;
}

/** O `id` da resposta, esteja no objeto ou num objeto aninhado (`{ usuario: { id } }`). */
export function acharId(objeto) {
  if (!objeto || typeof objeto !== 'object') return undefined;
  if (typeof objeto.id === 'string') return objeto.id;
  for (const valor of Object.values(objeto)) {
    if (valor && typeof valor === 'object' && typeof valor.id === 'string') return valor.id;
  }
  return undefined;
}

export const erroDe = (resposta) =>
  resposta.dados?.erro ? `${resposta.dados.erro.codigo}: ${resposta.dados.erro.mensagem}` : '';

export const resumo = (resposta) =>
  `HTTP ${resposta.status}${erroDe(resposta) ? ` ${erroDe(resposta)}` : ''}`;

export const ehRedirecionamento = (resposta) => [301, 302, 303, 307, 308].includes(resposta.status);

/** Roda o roteiro quando o arquivo é chamado diretamente (e não importado pelo `todos.mjs`). */
export async function rodarSeForPrincipal(urlDoModulo, executar) {
  if (!process.argv[1] || pathToFileURL(resolve(process.argv[1])).href !== urlDoModulo) return;

  let ambiente;
  try {
    ambiente = prepararAmbiente();
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 2;
    return;
  }

  const relatorio = criarRelatorio();
  try {
    await executar(ambiente, relatorio);
  } catch (erro) {
    relatorio.ok(false, 'Erro inesperado no roteiro', erro?.stack ?? String(erro));
  }
  relatorio.encerrar();
}
