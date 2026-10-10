import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { before, after, describe, test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import ExcelJS from 'exceljs';
import { validarAmbienteDaSuite } from './ambiente-seguro.mjs';
import {
  CPF_ADMIN_DESCARTAVEL,
  SENHA_ADMIN_DESCARTAVEL,
  CRON_SECRET_DESCARTAVEL,
} from './credenciais-descartaveis.mjs';

validarAmbienteDaSuite(process.env);
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const senha = SENHA_ADMIN_DESCARTAVEL;
const cpfAdmin = CPF_ADMIN_DESCARTAVEL;
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const ontem = new Date(`${hoje}T00:00:00Z`);
ontem.setUTCDate(ontem.getUTCDate() - 1);
const dataAnterior = ontem.toISOString().slice(0, 10);
const contexto = {};
let versaoPrivacidade;

function cpfFicticio(indice) {
  const numeros = `900${String(indice).padStart(6, '0')}`.split('').map(Number);
  for (let tamanho = 9; tamanho <= 10; tamanho++) {
    const resto =
      numeros.reduce((soma, digito, posicao) => soma + digito * (tamanho + 1 - posicao), 0) % 11;
    numeros.push(resto < 2 ? 0 : 11 - resto);
  }
  return numeros.join('');
}

function cliente() {
  return { cookie: '' };
}

async function solicitar(
  sessao,
  caminho,
  { metodo = 'GET', corpo, status = 200, binario = false } = {},
) {
  assert.ok(caminho.startsWith('/') && !caminho.startsWith('//'));
  const resposta = await fetch(`${process.env.APP_URL}${caminho}`, {
    method: metodo,
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
    headers: {
      ...(sessao.cookie ? { cookie: sessao.cookie } : {}),
      ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const conteudo = binario
    ? Buffer.from(await resposta.arrayBuffer())
    : resposta.status === 204
      ? null
      : await resposta.json();
  // Não imprime senha temporária, cookie, CPF ou dados de requisição em erro.
  assert.equal(
    resposta.status,
    status,
    `${metodo} ${caminho}: esperado ${status}; recebido ${resposta.status}; código ${conteudo?.erro?.codigo ?? 'sem código'}`,
  );
  const cookie = resposta.headers.getSetCookie().find((valor) => valor.startsWith('bordo_sessao='));
  if (cookie) sessao.cookie = cookie.split(';')[0];
  return { dados: conteudo, resposta };
}

async function solicitarPagina(sessao, caminho, { status = [200] } = {}) {
  assert.ok(caminho.startsWith('/') && !caminho.startsWith('//'));
  const resposta = await fetch(`${process.env.APP_URL}${caminho}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
    headers: sessao.cookie ? { cookie: sessao.cookie } : {},
  });
  const html = await resposta.text();
  // O HTML de falha também não entra no log: pode conter a sessão e os dados
  // fictícios devolvidos pelo servidor durante o render do App Router.
  assert.ok(status.includes(resposta.status), `GET ${caminho}: recebido ${resposta.status}`);
  if (resposta.status === 200) {
    assert.match(resposta.headers.get('content-type') ?? '', /text\/html/);
  }
  return { resposta, html };
}

function conferirCspDaPagina({ resposta, html }) {
  const politica = resposta.headers.get('content-security-policy') ?? '';
  const nonce = politica.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce, 'A página precisa receber nonce na CSP.');
  assert.ok(politica.includes("'strict-dynamic'"));
  assert.ok(politica.includes("frame-ancestors 'none'"));
  assert.ok(!politica.includes("'unsafe-eval'"));
  assert.ok(html.includes(`nonce="${nonce}"`), 'O HTML precisa usar o mesmo nonce da CSP.');
}

function conferirRedirecionamentoDaPagina(pagina, caminho) {
  if (pagina.resposta.status === 307) {
    const destino = new URL(pagina.resposta.headers.get('location'), process.env.APP_URL);
    assert.equal(destino.pathname, caminho);
    return destino;
  }
  // Um layout assíncrono pode recusar após o início do streaming. Nesse caso
  // o Next envia a instrução de redirect no HTML, em vez de mudar o status.
  const temInstrucao =
    (pagina.html.includes('NEXT_REDIRECT') && pagina.html.includes(`;${caminho};307;`)) ||
    (pagina.html.includes('id="__next-page-redirect"') &&
      (pagina.html.includes(`content="0;url=${caminho}"`) ||
        pagina.html.includes(`content="1;url=${caminho}"`)));
  assert.ok(temInstrucao, 'A página deve redirecionar o perfil sem autorização.');
}

function cartaoDoMotorista(html, nome) {
  const marcador = `>${nome}</h2>`;
  const inicio = html.indexOf(marcador);
  assert.ok(inicio >= 0, 'O painel deve exibir a fixture real do motorista.');
  const proximo = html.indexOf('<h2 ', inicio + marcador.length);
  return html.slice(inicio, proximo < 0 ? undefined : proximo);
}

function textoDaPagina(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ');
}

async function entrar(sessao, cpf, senhaAtual, destino) {
  const resultado = await solicitar(sessao, '/api/auth/login', {
    metodo: 'POST',
    corpo: { cpf, senha: senhaAtual, retorno: 'https://exemplo.invalid/externo' },
  });
  assert.equal(resultado.dados.destino, destino);
  assert.ok(sessao.cookie.startsWith('bordo_sessao='));
  assert.match(resultado.resposta.headers.get('set-cookie'), /HttpOnly/i);
  return resultado.dados;
}

async function criarMotorista(indice, nome) {
  const { dados } = await solicitar(contexto.admin, '/api/usuarios', {
    metodo: 'POST',
    status: 201,
    corpo: { nome, cpf: cpfFicticio(indice), telefone: '(11) 99999-7777', perfil: 'MOTORISTA' },
  });
  assert.equal(dados.usuario.senhaHash, undefined);
  assert.equal(typeof dados.senhaTemporaria, 'string');
  const sessao = cliente();
  await entrar(sessao, cpfFicticio(indice), dados.senhaTemporaria, '/trocar-senha');
  await solicitar(sessao, '/api/jornadas', {
    metodo: 'POST',
    corpo: {},
    status: 403,
  });
  await solicitar(sessao, '/api/auth/trocar-senha', {
    metodo: 'POST',
    status: 204,
    corpo: { novaSenha: senha, confirmacao: senha },
  });
  await solicitar(sessao, '/api/offline/retrato', { status: 403 });
  await solicitar(sessao, '/api/privacidade/aceite', {
    metodo: 'POST',
    status: 400,
    corpo: { versaoTexto: 'versao-inexistente' },
  });
  await solicitar(sessao, '/api/privacidade/aceite', {
    metodo: 'POST',
    status: 204,
    corpo: { versaoTexto: versaoPrivacidade },
  });
  return { id: dados.usuario.id, cpf: cpfFicticio(indice), nome, sessao };
}

async function criarVeiculo(placa, odometroAtual) {
  return (
    await solicitar(contexto.admin, '/api/veiculos', {
      metodo: 'POST',
      status: 201,
      corpo: { placa, modelo: 'Van fictícia HTTP', capacidadePassageiros: 16, odometroAtual },
    })
  ).dados;
}

function operacao(tipo, dados, ordem, clientUuid = randomUUID()) {
  return {
    clientUuid,
    tipo,
    dados,
    ocorridoEm: new Date(Date.now() - 60_000 + ordem * 1000).toISOString(),
  };
}

async function sincronizar(sessao, operacoes) {
  return (await solicitar(sessao, '/api/sincronizacao', { metodo: 'POST', corpo: { operacoes } }))
    .dados;
}

async function baixarPlanilha(sessao, url) {
  const { dados, resposta } = await solicitar(sessao, url, { binario: true });
  assert.match(resposta.headers.get('content-type'), /spreadsheetml\.sheet/);
  assert.match(resposta.headers.get('content-disposition'), /^attachment;/);
  assert.equal(resposta.headers.get('cache-control'), 'private, no-store');
  const tamanho = resposta.headers.get('content-length');
  if (tamanho !== null) {
    assert.equal(Number(tamanho), dados.length);
  } else {
    // next start envia o ReadableStream por chunked transfer; o XLSX abaixo
    // verifica que todos os chunks chegaram e formam um arquivo íntegro.
    assert.match(resposta.headers.get('transfer-encoding') ?? '', /chunked/i);
  }
  assert.equal(dados.subarray(0, 2).toString(), 'PK');
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(dados);
  assert.ok(livro.getWorksheet('Identificação'));
  return livro;
}

before(
  async () => {
    for (const variavel of [
      'S3_CHAVE_ID',
      'S3_CHAVE_SECRETA',
      'WHATSAPP_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
    ]) {
      assert.equal(process.env[variavel], undefined, `Credencial externa carregada: ${variavel}`);
    }
    assert.equal(process.env.CRON_SECRET, CRON_SECRET_DESCARTAVEL);
    const aviso = await readFile(
      join(process.env.CI_HTTP_RAIZ_COPIA, 'src/modulos/privacidade/aviso-privacidade.ts'),
      'utf8',
    );
    versaoPrivacidade = aviso.match(/VERSAO_AVISO_PRIVACIDADE\s*=\s*'([^']+)'/)[1];
    // Única criação administrativa por acesso direto: bootstrap do banco vazio.
    const admin = await prisma.usuario.create({
      data: {
        nome: 'Administrador Fictício HTTP',
        cpf: cpfAdmin,
        telefone: '+5511999997777',
        perfil: 'ADMIN',
        senhaHash: await hash(senha),
        deveTrocarSenha: false,
        aceites: { create: { versaoTexto: versaoPrivacidade } },
      },
    });
    contexto.admin = cliente();
    contexto.adminId = admin.id;
    await entrar(contexto.admin, cpfAdmin, senha, '/admin');
  },
  { timeout: 30_000 },
);

after(async () => {
  await prisma.$disconnect();
});

describe('Fluxos completos HTTP com PostgreSQL e aplicação reais', { concurrency: false }, () => {
  test('ajuda de acesso é pública, mantém CSP e não recebe dados de usuários', async () => {
    const pagina = await solicitarPagina(cliente(), '/ajuda-acesso');
    conferirCspDaPagina(pagina);
    assert.ok(pagina.html.includes('Ajuda para entrar no Bordo'));
    assert.ok(pagina.html.includes('href="/login"'));
    assert.ok(pagina.html.includes('id="senha-vencida"'));
    assert.ok(pagina.html.includes('id="bloqueio"'));
    assert.ok(!pagina.html.includes(cpfAdmin), 'Ajuda pública não deve devolver CPF.');
    assert.ok(
      !pagina.html.includes(contexto.admin.cookie),
      'Ajuda pública não deve devolver cookie.',
    );
    const outra = await solicitarPagina(
      { cookie: 'bordo_sessao=token-ficticio-invalido' },
      '/ajuda-acesso',
    );
    conferirCspDaPagina(outra);
    assert.notEqual(
      pagina.resposta.headers.get('content-security-policy'),
      outra.resposta.headers.get('content-security-policy'),
      'Cada resposta pública deve receber um nonce próprio.',
    );
    assert.ok(outra.html.includes('Ajuda para entrar no Bordo'));
  });

  test('novas telas privadas recusam visitante antes de renderizar dados', async () => {
    for (const caminho of ['/admin/motoristas', '/admin/ajuda', '/app/aprender']) {
      const pagina = await solicitarPagina(cliente(), caminho, { status: [307] });
      const destino = conferirRedirecionamentoDaPagina(pagina, '/login');
      assert.equal(destino.searchParams.get('retorno'), caminho);
      assert.ok(!pagina.html.includes('Motorista Fictício'));
    }
  });

  test('recusa visitante, cookie inválido e login incorreto sem ciclo de redirecionamento', async () => {
    const visitante = cliente();
    await solicitar(visitante, '/api/perfil', { status: 401 });
    await solicitar({ cookie: 'bordo_sessao=token-ficticio-invalido' }, '/api/perfil', {
      status: 401,
    });
    const pagina = await fetch(`${process.env.APP_URL}/login`, {
      redirect: 'manual',
      headers: { cookie: 'bordo_sessao=token-ficticio-invalido' },
    });
    assert.equal(pagina.status, 200);
    await solicitar(visitante, '/api/auth/login', {
      metodo: 'POST',
      status: 401,
      corpo: { cpf: cpfAdmin, senha: 'SenhaErradaFicticia!' },
    });
    await solicitar(visitante, '/api/auth/login', {
      metodo: 'POST',
      status: 400,
      corpo: { cpf: '000', senha },
    });
  });

  test('cadastro pelo administrador, senha temporária, troca obrigatória e aceite vigente', async () => {
    contexto.motorista = await criarMotorista(2, 'Motorista Fictício Online');
    contexto.offline = await criarMotorista(3, 'Motorista Fictício Offline');
    contexto.anterior = await criarMotorista(4, 'Motorista Fictício Ontem');
    contexto.van = await criarVeiculo('TST1A01', 1000);
    contexto.vanOffline = await criarVeiculo('TST1A02', 2000);
    contexto.vanAnterior = await criarVeiculo('TST1A03', 3000);
    const { dados: rota } = await solicitar(contexto.admin, '/api/rotas', {
      metodo: 'POST',
      status: 201,
      corpo: {
        codigo: 'HTTP-01',
        nome: 'Rota Fictícia HTTP',
        origem: 'Origem teste',
        destino: 'Destino teste',
        turno: 'INTEGRAL',
      },
    });
    contexto.rota = rota;
    await solicitar(contexto.admin, `/api/rotas/${rota.id}/pontos`, {
      metodo: 'PUT',
      corpo: { pontos: [{ nome: 'Parada Fictícia', latitude: -23.55, longitude: -46.63 }] },
    });
    contexto.ponto = (await solicitar(contexto.admin, `/api/rotas/${rota.id}`)).dados.pontos[0];
    await solicitar(contexto.admin, '/api/usuarios', {
      metodo: 'POST',
      status: 409,
      corpo: {
        nome: 'Duplicado Fictício',
        cpf: contexto.motorista.cpf,
        telefone: '(11) 99999-7777',
        perfil: 'MOTORISTA',
      },
    });
  });

  test('motorista não pode administrar cadastros ou listar a frota', async () => {
    await solicitar(contexto.motorista.sessao, '/api/usuarios', { status: 403 });
    await solicitar(contexto.motorista.sessao, '/api/dashboard', { status: 403 });
    await solicitar(contexto.motorista.sessao, '/api/veiculos', {
      metodo: 'POST',
      corpo: { placa: 'TST1A04', modelo: 'Van teste', capacidadePassageiros: 16, odometroAtual: 0 },
      status: 403,
    });
    const perfil = (await solicitar(contexto.motorista.sessao, '/api/perfil')).dados;
    assert.equal(perfil.senhaHash, undefined);
  });

  test('painel e ajuda administrativos exigem ADMIN e usam os motoristas reais da suíte', async () => {
    for (const caminho of ['/admin/motoristas', '/admin/ajuda']) {
      const negada = await solicitarPagina(contexto.motorista.sessao, caminho, {
        status: [200, 307],
      });
      conferirRedirecionamentoDaPagina(negada, '/403');
      assert.ok(
        !negada.html.includes(contexto.offline.nome),
        'MOTORISTA não recebe dados de outro.',
      );
      assert.ok(!negada.html.includes(contexto.offline.id), 'MOTORISTA não recebe ID de outro.');
    }
    const pagina = await solicitarPagina(contexto.admin, `/admin/motoristas?data=${hoje}`);
    conferirCspDaPagina(pagina);
    for (const motorista of [contexto.motorista, contexto.offline, contexto.anterior]) {
      const texto = textoDaPagina(cartaoDoMotorista(pagina.html, motorista.nome));
      assert.ok(texto.includes('Acesso pronto'), 'Login, senha e aceite devem liberar o acesso.');
      assert.ok(texto.includes('Sem escala'), 'Não existe escala nas fixtures iniciais.');
      assert.ok(texto.includes('Nenhuma jornada válida registrada.'));
      assert.ok(texto.includes('Ainda não há corrida encerrada em uma jornada válida.'));
      assert.ok(!pagina.html.includes(motorista.cpf), 'O painel não deve transmitir CPF.');
      const { senhaHash } = await prisma.usuario.findUnique({
        where: { id: motorista.id },
        select: { senhaHash: true },
      });
      assert.ok(!pagina.html.includes(senhaHash), 'O painel não deve transmitir hash de senha.');
    }
    assert.ok(
      !pagina.html.includes(contexto.admin.cookie.split('=')[1]),
      'O painel não deve expor token.',
    );
    const ajuda = await solicitarPagina(contexto.admin, '/admin/ajuda');
    assert.ok(ajuda.html.includes('Treinamento de 15 minutos'));
    assert.ok(ajuda.html.includes('Rotina de conferência diária'));
    assert.ok(ajuda.html.includes('href="/admin/motoristas"'));
  });

  test('motorista autorizado abre a demonstração sem criar jornada ou corrida', async () => {
    const contar = async () =>
      Promise.all([
        prisma.jornada.count({ where: { motoristaId: contexto.motorista.id } }),
        prisma.corrida.count({ where: { jornada: { motoristaId: contexto.motorista.id } } }),
      ]);
    const antes = await contar();
    const pagina = await solicitarPagina(contexto.motorista.sessao, '/app/aprender');
    conferirCspDaPagina(pagina);
    assert.ok(pagina.html.includes('Aprender a rotina'));
    assert.ok(pagina.html.includes('Demonstração: nada é enviado'));
    assert.ok(pagina.html.includes('Simular entrada'));
    assert.ok(!pagina.html.includes(contexto.offline.nome));
    assert.deepEqual(await contar(), antes, 'Abrir a demonstração não grava operação.');
  });

  test('abertura é idempotente e veículo ocupado não pode ser usado por outro motorista', async () => {
    const corpo = { veiculoId: contexto.van.id, odometroInicial: 1000, clientUuid: randomUUID() };
    contexto.jornada = (
      await solicitar(contexto.motorista.sessao, '/api/jornadas', {
        metodo: 'POST',
        status: 201,
        corpo,
      })
    ).dados;
    const repetido = (
      await solicitar(contexto.motorista.sessao, '/api/jornadas', { metodo: 'POST', corpo })
    ).dados;
    assert.equal(repetido.id, contexto.jornada.id);
    assert.equal(repetido.jaExistia, true);
    const ocupado = await solicitar(contexto.offline.sessao, '/api/jornadas', {
      metodo: 'POST',
      corpo: { veiculoId: contexto.van.id, odometroInicial: 1000 },
      status: 409,
    });
    assert.equal(ocupado.dados.erro.codigo, 'VEICULO_EM_USO');
    const retrato = (await solicitar(contexto.motorista.sessao, '/api/offline/retrato')).dados;
    assert.equal(retrato.jornadaAberta.id, contexto.jornada.id);
    assert.ok(retrato.rotas.some((rota) => rota.id === contexto.rota.id));
  });

  test('corrida com GPS, paradas sincronizadas e reenvio sem duplicação', async () => {
    const corpo = {
      rotaId: contexto.rota.id,
      clientUuid: randomUUID(),
      localizacao: { latitude: -23.55, longitude: -46.63, precisaoMetros: 12 },
    };
    contexto.corrida = (
      await solicitar(contexto.motorista.sessao, '/api/corridas', {
        metodo: 'POST',
        status: 201,
        corpo,
      })
    ).dados;
    assert.equal(
      (await solicitar(contexto.motorista.sessao, '/api/corridas', { metodo: 'POST', corpo })).dados
        .id,
      contexto.corrida.id,
    );
    await solicitar(contexto.motorista.sessao, '/api/corridas', {
      metodo: 'POST',
      corpo: { rotaId: contexto.rota.id },
      status: 409,
    });
    contexto.paradas = [
      operacao(
        'REGISTRAR_EVENTO',
        {
          corridaId: contexto.corrida.id,
          tipo: 'CHEGADA',
          pontoParadaId: contexto.ponto.id,
          localizacao: corpo.localizacao,
        },
        0,
      ),
      operacao(
        'REGISTRAR_EVENTO',
        { corridaId: contexto.corrida.id, tipo: 'SAIDA', pontoParadaId: contexto.ponto.id },
        1,
      ),
    ];
    assert.equal((await sincronizar(contexto.motorista.sessao, contexto.paradas)).aplicadas, 2);
    const reenvio = await sincronizar(contexto.motorista.sessao, contexto.paradas);
    assert.ok(reenvio.resultados.every((item) => item.situacao === 'JA_PROCESSADA'));
    assert.equal(
      await prisma.corridaEvento.count({
        where: { corridaId: contexto.corrida.id, tipo: { in: ['CHEGADA', 'SAIDA'] } },
      }),
      2,
    );
    assert.ok(
      (await prisma.pontoLocalizacao.count({ where: { corridaId: contexto.corrida.id } })) >= 2,
    );
  });

  test('isolamento de corrida impede leitura e encerramento por outro motorista', async () => {
    await solicitar(contexto.offline.sessao, `/api/corridas/${contexto.corrida.id}`, {
      status: 404,
    });
    await solicitar(contexto.offline.sessao, `/api/corridas/${contexto.corrida.id}/encerrar`, {
      metodo: 'POST',
      corpo: { odometroFinal: 1010 },
      status: 404,
    });
    assert.equal(
      (await prisma.corrida.findUnique({ where: { id: contexto.corrida.id } })).status,
      'EM_ANDAMENTO',
    );
  });

  test('erros não alteram corrida; encerramento consolida e cancela corrida avulsa sem GPS', async () => {
    await solicitar(contexto.motorista.sessao, `/api/jornadas/${contexto.jornada.id}/encerrar`, {
      metodo: 'POST',
      corpo: { odometroFinal: 1010 },
      status: 409,
    });
    await solicitar(contexto.motorista.sessao, `/api/corridas/${contexto.corrida.id}/encerrar`, {
      metodo: 'POST',
      corpo: { odometroFinal: 999, quantidadePassageiros: 5 },
      status: 422,
    });
    const fim = (
      await solicitar(contexto.motorista.sessao, `/api/corridas/${contexto.corrida.id}/encerrar`, {
        metodo: 'POST',
        corpo: { odometroFinal: 1010, quantidadePassageiros: 5 },
      })
    ).dados;
    assert.equal(fim.kmPercorrido, 10);
    const avulsa = (
      await solicitar(contexto.motorista.sessao, '/api/corridas', {
        metodo: 'POST',
        status: 201,
        corpo: { origemDescricao: 'Ponto teste A', destinoDescricao: 'Ponto teste B' },
      })
    ).dados;
    await solicitar(contexto.motorista.sessao, `/api/corridas/${avulsa.id}/cancelar`, {
      metodo: 'POST',
      corpo: { motivo: 'Passageiro fictício desistiu da viagem' },
    });
    const totais = (
      await solicitar(contexto.motorista.sessao, `/api/jornadas/${contexto.jornada.id}/encerrar`, {
        metodo: 'POST',
        corpo: { odometroFinal: 1010 },
      })
    ).dados;
    assert.equal(totais.totalCorridas, 1);
    assert.equal(totais.kmTotal, 10);
    assert.equal(totais.totalPassageiros, 5);
    assert.equal(
      (await prisma.veiculo.findUnique({ where: { id: contexto.van.id } })).odometroAtual,
      1010,
    );
  });

  test('painel cruza a jornada real, ignora corrida cancelada e comprova a primeira utilização', async () => {
    const pagina = await solicitarPagina(contexto.admin, `/admin/motoristas?data=${hoje}`);
    const cartao = cartaoDoMotorista(pagina.html, contexto.motorista.nome);
    const texto = textoDaPagina(cartao);
    assert.ok(texto.includes('Dia encerrado'));
    assert.ok(texto.includes('1 corrida(s) concluída(s) no dia'));
    assert.ok(texto.includes('Primeira utilização concluída'));
    assert.ok(cartao.includes(`href="/admin/jornadas/${contexto.jornada.id}"`));
    const aindaSemJornada = textoDaPagina(cartaoDoMotorista(pagina.html, contexto.offline.nome));
    assert.ok(aindaSemJornada.includes('Nenhuma jornada válida registrada.'));
    const filtrada = await solicitarPagina(
      contexto.admin,
      `/admin/motoristas?${new URLSearchParams({ data: hoje, busca: contexto.motorista.nome })}`,
    );
    assert.ok(filtrada.html.includes(`>${contexto.motorista.nome}</h2>`));
    assert.ok(!filtrada.html.includes(`>${contexto.offline.nome}</h2>`));
    assert.ok(!filtrada.html.includes(`>${contexto.anterior.nome}</h2>`));
  });

  test('jornada de ontem aparece como pendência e encerra pela API e tela', async () => {
    contexto.jornadaAnterior = await prisma.jornada.create({
      data: {
        motoristaId: contexto.anterior.id,
        veiculoId: contexto.vanAnterior.id,
        data: ontem,
        iniciadaEm: new Date(`${dataAnterior}T20:00:00Z`),
        odometroInicial: 3000,
      },
    });
    const meuDia = (await solicitar(contexto.anterior.sessao, '/api/jornadas/hoje')).dados;
    assert.equal(meuDia.jornada, null);
    assert.equal(meuDia.jornadaAbertaDeOutroDia.id, contexto.jornadaAnterior.id);
    const tela = await fetch(`${process.env.APP_URL}/app/jornada/encerrar`, {
      headers: { cookie: contexto.anterior.sessao.cookie },
      redirect: 'manual',
    });
    assert.equal(tela.status, 200);
    const painel = await solicitarPagina(contexto.admin, `/admin/motoristas?data=${hoje}`);
    const cartao = cartaoDoMotorista(painel.html, contexto.anterior.nome);
    const texto = textoDaPagina(cartao);
    assert.ok(texto.includes('Jornada anterior aberta em'));
    assert.ok(texto.includes('Sem escala'));
    assert.ok(!texto.includes('Dia iniciado'), 'Jornada antiga não conta como início de hoje.');
    assert.ok(cartao.includes(`href="/admin/jornadas/${contexto.jornadaAnterior.id}"`));
    await solicitar(
      contexto.anterior.sessao,
      `/api/jornadas/${contexto.jornadaAnterior.id}/encerrar`,
      {
        metodo: 'POST',
        corpo: { odometroFinal: 3000 },
      },
    );
    assert.equal(
      (await prisma.jornada.findUnique({ where: { id: contexto.jornadaAnterior.id } })).status,
      'ENCERRADA',
    );
  });

  test('lote offline fora de ordem faz abertura, corrida, parada e encerramentos uma única vez', async () => {
    const uuidCorrida = randomUUID();
    contexto.loteOffline = [
      operacao('ABRIR_JORNADA', { veiculoId: contexto.vanOffline.id, odometroInicial: 2000 }, 0),
      operacao(
        'INICIAR_CORRIDA',
        { origemDescricao: 'Origem offline', destinoDescricao: 'Destino offline' },
        1,
        uuidCorrida,
      ),
      operacao(
        'REGISTRAR_EVENTO',
        { corridaClientUuid: uuidCorrida, tipo: 'CHEGADA', descricao: 'Parada offline' },
        2,
      ),
      operacao(
        'ENCERRAR_CORRIDA',
        { corridaClientUuid: uuidCorrida, odometroFinal: 2007, quantidadePassageiros: 3 },
        3,
      ),
      operacao('ENCERRAR_JORNADA', { odometroFinal: 2007 }, 4),
    ];
    const resultado = await sincronizar(
      contexto.offline.sessao,
      [...contexto.loteOffline].reverse(),
    );
    assert.equal(resultado.aplicadas, 5);
    assert.equal(resultado.conflitos, 0);
    assert.equal(resultado.falhas, 0);
    const reenvio = await sincronizar(contexto.offline.sessao, contexto.loteOffline);
    assert.ok(reenvio.resultados.every((item) => item.situacao === 'JA_PROCESSADA'));
    assert.equal(
      await prisma.operacaoSincronizada.count({ where: { usuarioId: contexto.offline.id } }),
      5,
    );
    const jornada = await prisma.jornada.findFirst({ where: { motoristaId: contexto.offline.id } });
    assert.equal(jornada.status, 'ENCERRADA');
    assert.equal(Number(jornada.kmTotal), 7);
    assert.equal(await prisma.corrida.count({ where: { jornadaId: jornada.id } }), 1);
  });

  test('operação offline inválida não interrompe reenvio válido do restante do lote', async () => {
    const resultado = await sincronizar(contexto.offline.sessao, [
      operacao(
        'REGISTRAR_EVENTO',
        { corridaClientUuid: randomUUID(), tipo: 'CHEGADA', descricao: 'Referência ausente' },
        0,
      ),
      contexto.loteOffline[4],
    ]);
    assert.equal(resultado.conflitos, 1);
    assert.equal(resultado.aplicadas, 1);
    assert.equal(resultado.falhas, 0);
    await solicitar(contexto.offline.sessao, '/api/sincronizacao', {
      metodo: 'POST',
      corpo: { operacoes: [] },
      status: 400,
    });
  });

  test('filtros e paginação do administrador retornam somente o recorte solicitado', async () => {
    const query = new URLSearchParams({
      dataInicio: hoje,
      dataFim: hoje,
      motoristaId: contexto.motorista.id,
      status: 'ENCERRADA',
      tamanho: '1',
    });
    const jornadas = (await solicitar(contexto.admin, `/api/jornadas?${query}`)).dados;
    assert.equal(jornadas.paginacao.total, 1);
    assert.equal(jornadas.dados[0].id, contexto.jornada.id);
    const corridas = (
      await solicitar(contexto.admin, `/api/corridas?${query}&rotaId=${contexto.rota.id}`)
    ).dados;
    assert.equal(corridas.paginacao.total, 1);
    assert.equal(corridas.dados[0].id, contexto.corrida.id);
    const resumo = (await solicitar(contexto.motorista.sessao, `/api/resumo/${hoje}`)).dados;
    assert.equal(resumo.encerradas.length, 1);
    assert.equal(resumo.consolidado.kmTotal, 10);
    await solicitar(contexto.admin, '/api/jornadas?dataInicio=2026-10-02&dataFim=2026-09-01', {
      status: 400,
    });
  });

  test('exportação respeita filtros, entrega XLSX legível e impede download de terceiros', async () => {
    const { dados: exportacao } = await solicitar(contexto.admin, '/api/exportacoes', {
      metodo: 'POST',
      status: 201,
      corpo: {
        tipo: 'CORRIDAS',
        filtros: {
          motoristaId: contexto.motorista.id,
          rotaId: contexto.rota.id,
          status: 'ENCERRADA',
        },
      },
    });
    assert.equal(exportacao.totalDeLinhas, 1);
    const aba = (await baixarPlanilha(contexto.admin, exportacao.url)).getWorksheet('Corridas');
    assert.equal(aba.rowCount, 2);
    assert.equal(aba.getRow(2).getCell(2).value, contexto.motorista.nome);
    assert.equal(aba.getRow(2).getCell(10).value, 10);
    await solicitar(contexto.offline.sessao, exportacao.url, { status: 404 });
    // O motorista pede explicitamente os dados de outro: o servidor aplica
    // seu próprio escopo e a planilha continua tendo apenas a linha dele.
    const proprio = (
      await solicitar(contexto.motorista.sessao, '/api/exportacoes', {
        metodo: 'POST',
        status: 201,
        corpo: { tipo: 'JORNADAS', filtros: { motoristaId: contexto.offline.id } },
      })
    ).dados;
    assert.equal(proprio.totalDeLinhas, 1);
    const linhas = (await baixarPlanilha(contexto.motorista.sessao, proprio.url)).getWorksheet(
      'Jornadas',
    );
    assert.equal(linhas.getRow(2).getCell(2).value, contexto.motorista.nome);
    await solicitar(contexto.offline.sessao, proprio.url, { status: 404 });
    await solicitar(contexto.admin, '/api/exportacoes', {
      metodo: 'POST',
      status: 400,
      corpo: { tipo: 'JORNADAS', filtros: { rotaId: contexto.rota.id } },
    });
    await solicitar(contexto.admin, '/api/exportacoes', {
      metodo: 'POST',
      status: 422,
      corpo: { tipo: 'CORRIDAS', filtros: { rotaId: randomUUID() } },
    });
  });

  test(
    '5001 linhas são admitidas em segundo plano, processadas e baixadas com isolamento da tarefa',
    { timeout: 120_000 },
    async () => {
      const dados = Array.from({ length: 5001 }, () => ({
        jornadaId: contexto.jornadaAnterior.id,
        status: 'ENCERRADA',
        origemDescricao: 'Volume fictício CI',
        destinoDescricao: 'Destino fictício CI',
        iniciadaEm: new Date(`${dataAnterior}T20:00:00Z`),
        encerradaEm: new Date(`${dataAnterior}T20:05:00Z`),
        odometroInicial: 3000,
        odometroFinal: 3001,
        kmPercorrido: 1,
        duracaoMinutos: 5,
        quantidadePassageiros: 2,
      }));
      // Volume sintético direto evita milhares de chamadas; a admissão,
      // processamento, storage, autorização e XLSX continuam passando pela API.
      await prisma.corrida.createMany({ data: dados });
      const { dados: tarefa } = await solicitar(contexto.admin, '/api/exportacoes', {
        metodo: 'POST',
        status: 202,
        corpo: {
          tipo: 'CORRIDAS',
          filtros: { motoristaId: contexto.anterior.id, status: 'ENCERRADA' },
        },
      });
      assert.equal(tarefa.modo, 'segundo-plano');
      assert.equal(tarefa.totalDeLinhas, 5001);
      await solicitar(contexto.offline.sessao, `/api/exportacoes/${tarefa.tarefaId}`, {
        status: 404,
      });
      let situacao;
      const fim = Date.now() + 90_000;
      while (Date.now() < fim) {
        situacao = (await solicitar(contexto.admin, `/api/exportacoes/${tarefa.tarefaId}`)).dados;
        assert.notEqual(situacao.status, 'FALHA');
        if (situacao.status === 'CONCLUIDA') break;
        await new Promise((concluir) => setTimeout(concluir, 500));
      }
      assert.equal(situacao.status, 'CONCLUIDA');
      assert.equal(situacao.linhasGeradas, 5001);
      const livro = await baixarPlanilha(contexto.admin, situacao.url);
      assert.equal(livro.getWorksheet('Corridas').rowCount, 5002);
      await solicitar(contexto.offline.sessao, situacao.url, { status: 404 });
      assert.ok((await prisma.logAuditoria.count({ where: { acao: 'EXPORTAR' } })) >= 3);
    },
  );

  test('logout revoga sessão no banco e cookie anterior não recupera acesso', async () => {
    const cookie = contexto.motorista.sessao.cookie;
    await solicitar(contexto.motorista.sessao, '/api/auth/logout', { metodo: 'POST', status: 204 });
    await solicitar({ cookie }, '/api/perfil', { status: 401 });
    await entrar(contexto.motorista.sessao, contexto.motorista.cpf, senha, '/app');
    assert.notEqual(contexto.motorista.sessao.cookie, cookie);
  });
});
