import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validarBancoDescartavel, validarAmbienteDaSuite } from './ambiente-seguro.mjs';

const banco =
  'postgresql://bordo_ci:bordo_ci_apenas_testes@127.0.0.1:55433/bordo_ci?schema=ci_fluxos_012345abcdef';
const ambiente = {
  CI_HTTP_ISOLADO: 'sim',
  APP_AMBIENTE: 'local',
  APP_URL: 'http://127.0.0.1:3107',
  DATABASE_URL: banco,
  DIRECT_URL: banco,
  STORAGE_DRIVER: 'local',
  WHATSAPP_CANAL: 'link',
};

test('aceita apenas o banco local reservado e schema descartável', () => {
  assert.doesNotThrow(() => validarAmbienteDaSuite(ambiente));
});

test('recusa hosts remotos, banco público, credenciais e parâmetros alheios', () => {
  for (const invalido of [
    banco.replace('127.0.0.1', 'producao.neon.tech'),
    banco.replace('/bordo_ci?', '/bordo?'),
    banco.replace('bordo_ci_apenas_testes', 'senha-real'),
    banco.replace('ci_fluxos_012345abcdef', 'public'),
    `${banco}&sslmode=require`,
  ]) {
    assert.throws(() => validarBancoDescartavel(invalido));
  }
});

test('recusa servidor remoto, ambiente de produção e serviços externos', () => {
  for (const alteracao of [
    { APP_URL: 'https://bordo.vercel.app' },
    { APP_AMBIENTE: 'producao' },
    { STORAGE_DRIVER: 's3' },
    { WHATSAPP_CANAL: 'cloud' },
    { CI_HTTP_ISOLADO: undefined },
    { DIRECT_URL: banco.replace('127.0.0.1', 'remoto.invalid') },
  ]) {
    assert.throws(() => validarAmbienteDaSuite({ ...ambiente, ...alteracao }));
  }
});
