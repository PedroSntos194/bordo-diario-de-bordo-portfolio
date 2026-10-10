import { criarRelatorio, prepararAmbiente } from './apoio.mjs';
import { executar as roteiro } from './roteiro.mjs';
import { executar as offline } from './offline.mjs';
import { executar as primeiroAcesso } from './primeiro-acesso.mjs';

/** Os três roteiros em sequência, com um relatório só. É o que `npm run test:ponta-a-ponta` roda. */

let ambiente;
try {
  ambiente = prepararAmbiente();
} catch (erro) {
  console.error(erro.message);
  process.exit(2);
}

console.log(`Servidor: ${ambiente.base}`);
const relatorio = criarRelatorio();

for (const [nome, executar] of [
  ['roteiro', roteiro],
  ['offline', offline],
  ['primeiro-acesso', primeiroAcesso],
]) {
  try {
    await executar(ambiente, relatorio);
  } catch (erro) {
    relatorio.ok(false, `Erro inesperado em ${nome}`, erro?.stack ?? String(erro));
  }
}

relatorio.encerrar();
