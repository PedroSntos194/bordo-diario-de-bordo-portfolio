import assert from 'node:assert/strict';

// Nenhuma URL de produção é aceita. Banco, credenciais e nome do schema são
// exclusivos deste executor, que nunca lê .env ou reaproveita uma sessão real.
export function validarBancoDescartavel(valor) {
  const url = new URL(valor);
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/bordo_ci');
  assert.equal(url.username, 'bordo_ci');
  assert.equal(url.password, 'bordo_ci_apenas_testes');
  assert.match(url.searchParams.get('schema') ?? '', /^ci_fluxos_[a-f0-9]{12}$/);
  assert.deepEqual([...url.searchParams.keys()].sort(), ['schema']);
  assert.ok(Number(url.port) >= 1024 && Number(url.port) <= 65535);
  return url;
}

export function validarAmbienteDaSuite(ambiente) {
  assert.equal(ambiente.CI_HTTP_ISOLADO, 'sim');
  assert.equal(ambiente.APP_AMBIENTE, 'local');
  assert.equal(ambiente.STORAGE_DRIVER, 'local');
  assert.equal(ambiente.WHATSAPP_CANAL, 'link');
  assert.equal(ambiente.DIRECT_URL, ambiente.DATABASE_URL);
  validarBancoDescartavel(ambiente.DATABASE_URL);
  const app = new URL(ambiente.APP_URL);
  assert.equal(app.protocol, 'http:');
  assert.equal(app.hostname, '127.0.0.1');
  assert.equal(app.pathname, '/');
  assert.equal(app.search, '');
  assert.equal(app.hash, '');
  assert.ok(Number(app.port) >= 1024 && Number(app.port) <= 65535);
  return app;
}
