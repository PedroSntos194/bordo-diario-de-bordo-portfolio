import { readFileSync } from 'node:fs';
import { randomInt, randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import {
  COOKIE_DE_SESSAO,
  Cliente,
  acharId,
  cpfAleatorio,
  ehRedirecionamento,
  erroDe,
  placaAleatoria,
  resumo,
  rodarSeForPrincipal,
  senhaAleatoria,
  valorErrado,
} from './apoio.mjs';

/**
 * Roteiro principal — o teste ponta a ponta de 30/09, com sessões reais de
 * administrador e de motorista: acesso, cadastros, o dia do motorista, painel,
 * planilhas, importação, segurança e todas as telas. Grava dados no banco do
 * servidor local; ver o README desta pasta.
 */
export async function executar(ambiente, r) {
  const { hoje, versaoAviso } = ambiente;
  const anonimo = new Cliente(ambiente, 1);
  const admin = new Cliente(ambiente, 2);
  let res;

  // ------------------------------------------------------------------ público
  r.secao('1. Público e proteção');
  res = await anonimo.get('/api/health');
  r.ok(
    res.status === 200 && res.dados?.banco === 'ok',
    'Saúde do sistema com banco ok',
    resumo(res),
  );
  res = await anonimo.get('/admin');
  r.ok(
    ehRedirecionamento(res) && (res.headers.get('location') ?? '').includes('/login'),
    'Painel sem login redireciona para o login',
    `${res.status} → ${res.headers.get('location')}`,
  );
  res = await anonimo.get('/api/usuarios');
  r.ok(res.status === 401, 'API sem login responde 401', resumo(res));
  res = await anonimo.get('/api/cron');
  r.ok(res.status === 404, 'Cron sem segredo responde 404', resumo(res));
  res = await anonimo.get('/api/cron', { headers: { authorization: `Bearer ${valorErrado()}` } });
  r.ok(res.status === 404, 'Cron com segredo errado responde 404', resumo(res));
  if (ambiente.cronSecret) {
    res = await anonimo.get('/api/cron', {
      headers: { authorization: `Bearer ${ambiente.cronSecret}` },
    });
    r.ok(
      res.status === 200 &&
        Array.isArray(res.dados?.rotinas) &&
        res.dados.rotinas.every((x) => x.ok),
      'Cron com o segredo roda o despacho sem falhas',
      JSON.stringify(res.dados).slice(0, 200),
    );
  } else {
    r.pular('Cron com o segredo roda o despacho', 'CRON_SECRET não definido no ambiente');
  }
  res = await anonimo.get('/manifest.webmanifest');
  r.ok(
    res.status === 200 && JSON.stringify(res.dados).includes('Bordo'),
    'Manifesto do app instalável com o nome Bordo',
    resumo(res),
  );

  // Achado em produção em 01/10: com o cookie de uma sessão vencida, `/login`
  // e `/` se mandavam um para o outro até o navegador desistir.
  const vencida = new Cliente(ambiente, 3);
  vencida.cookies[COOKIE_DE_SESSAO] = `vencida-${randomUUID()}`;
  res = await vencida.get('/login');
  r.ok(res.status === 200, 'Sessão vencida: /login abre o formulário', resumo(res));
  res = await vencida.seguir('/');
  r.ok(
    res.status === 200 && res.caminho.startsWith('/login') && res.saltos <= 2,
    'Sessão vencida: / chega ao login sem laço',
    `${res.status} em ${res.caminho} após ${res.saltos} redirecionamento(s)`,
  );

  // ------------------------------------------------------------ administrador
  r.secao('2. Acesso do administrador');
  res = await admin.post('/api/auth/login', { cpf: ambiente.adminCpf, senha: valorErrado() });
  r.ok(
    res.status === 401 && /CPF ou senha/i.test(res.dados?.erro?.mensagem ?? ''),
    'Senha errada é recusada sem dizer qual campo errou',
    resumo(res),
  );
  res = await admin.post('/api/auth/login', { cpf: ambiente.adminCpf, senha: ambiente.adminSenha });
  if (res.status === 200 && res.dados?.destino === '/privacidade/aceite') {
    await admin.post('/api/privacidade/aceite', { versaoTexto: versaoAviso });
    res = { ...res, dados: { ...res.dados, destino: '/admin' } };
  }
  const entrou = r.ok(
    res.status === 200 && res.dados?.destino === '/admin',
    'Administrador entra e vai para /admin',
    `${resumo(res)} destino=${res.dados?.destino}`,
  );
  if (!entrou) {
    throw new Error(
      'O administrador não entrou: confira E2E_ADMIN_CPF/E2E_ADMIN_SENHA e se a senha ' +
        'temporária do seed já foi trocada (ver README).',
    );
  }
  res = await admin.get('/api/perfil');
  r.ok(
    res.status === 200 && res.dados?.perfil === 'ADMIN',
    'Meu perfil responde como administrador',
    resumo(res),
  );
  res = await admin.get('/sw.js');
  const swDoRepositorio = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
  r.ok(
    res.status === 200 && String(res.dados) === swDoRepositorio,
    'Service worker servido é o do repositório',
    resumo(res),
  );

  // ---------------------------------------------------------------- cadastros
  r.secao('3. Cadastros');
  const placaA = placaAleatoria();
  res = await admin.post('/api/veiculos', {
    placa: placaA,
    modelo: 'Sprinter 416',
    marca: 'Mercedes-Benz',
    ano: 2022,
    capacidadePassageiros: 15,
    odometroAtual: 100000,
  });
  const veiculoId = acharId(res.dados);
  r.ok(res.status === 201 && veiculoId, 'Cadastrar van', `${resumo(res)} placa=${placaA}`);
  res = await admin.post('/api/veiculos', {
    placa: placaA,
    modelo: 'Outra',
    capacidadePassageiros: 10,
    odometroAtual: 5,
  });
  r.ok(res.status === 409, 'Placa repetida é recusada', resumo(res));
  res = await admin.put(`/api/veiculos/${veiculoId}`, {
    placa: placaA,
    modelo: 'Sprinter 416 CDI',
    marca: 'Mercedes-Benz',
    ano: 2022,
    capacidadePassageiros: 15,
  });
  r.ok(res.status === 200, 'Editar van', resumo(res));
  res = await admin.get(`/api/veiculos/${veiculoId}`);
  r.ok(
    res.status === 200 && JSON.stringify(res.dados).includes('416 CDI'),
    'Detalhe da van reflete a edição',
    resumo(res),
  );
  res = await admin.get(`/api/veiculos?busca=${encodeURIComponent(placaA)}`);
  r.ok(
    res.status === 200 && JSON.stringify(res.dados).includes(placaA),
    'Busca de veículos encontra a van',
    resumo(res),
  );

  res = await admin.post('/api/rotas', {
    codigo: `T-${randomInt(100, 999)}`,
    nome: 'Rota de teste Centro',
    origem: 'Garagem',
    destino: 'Centro de São Paulo',
    turno: 'MANHA',
    distanciaEstimadaKm: 25,
  });
  const rotaId = acharId(res.dados);
  r.ok(res.status === 201 && rotaId, 'Cadastrar rota', resumo(res));
  res = await admin.put(`/api/rotas/${rotaId}/pontos`, {
    pontos: [
      { nome: 'Garagem', endereco: 'Rua A, 1', latitude: -23.55, longitude: -46.63 },
      { nome: 'Parada do meio', endereco: 'Av. B, 200', latitude: -23.56, longitude: -46.64 },
      { nome: 'Centro', endereco: 'Praça da Sé', latitude: -23.5505, longitude: -46.6333 },
    ],
  });
  r.ok(res.status === 200, 'Salvar 3 pontos de parada', resumo(res));
  res = await admin.get(`/api/rotas/${rotaId}`);
  const textoRota = JSON.stringify(res.dados);
  r.ok(
    res.status === 200 &&
      textoRota.indexOf('Garagem') < textoRota.indexOf('Parada do meio') &&
      textoRota.indexOf('Parada do meio') < textoRota.indexOf('Praça da Sé'),
    'Pontos da rota voltam na ordem certa',
    resumo(res),
  );

  // A busca de endereço depende do Nominatim, fora do sistema: e por desenho
  // (RNF015) devolve lista vazia em qualquer falha, então vazio não reprova.
  res = await admin.get(
    `/api/geocodificacao?endereco=${encodeURIComponent('Praça da Sé, São Paulo')}`,
  );
  if (res.status === 200 && res.dados?.locais?.length > 0) {
    r.ok(true, 'Busca de endereço encontra a Praça da Sé', resumo(res));
  } else if (res.status === 200) {
    r.pular('Busca de endereço encontra a Praça da Sé', 'lista vazia — Nominatim fora do alcance?');
  } else {
    r.ok(false, 'Busca de endereço responde', resumo(res));
  }

  const cpfA = cpfAleatorio();
  res = await admin.post('/api/usuarios', {
    nome: 'Motorista Roteiro A',
    cpf: cpfA,
    telefone: '11988887777',
    perfil: 'MOTORISTA',
    cnhNumero: '01234567890',
    cnhCategoria: 'D',
    cnhValidade: '2029-12-31',
  });
  const senhaTemporariaA = res.dados?.senhaTemporaria;
  const motoristaAId = acharId(res.dados);
  r.ok(
    res.status === 201 && senhaTemporariaA && motoristaAId,
    'Cadastrar motorista (senha temporária devolvida uma vez)',
    resumo(res),
  );
  res = await admin.post('/api/usuarios', {
    nome: 'Outra Pessoa Qualquer',
    cpf: cpfA,
    telefone: '11988887777',
    perfil: 'MOTORISTA',
  });
  r.ok(res.status === 409, 'CPF repetido é recusado', resumo(res));
  res = await admin.post('/api/usuarios', {
    nome: 'Telefone Ruim',
    cpf: cpfAleatorio(),
    telefone: '123',
    perfil: 'MOTORISTA',
  });
  r.ok(res.status === 400, 'Telefone inválido é recusado', resumo(res));
  const cpfB = cpfAleatorio();
  res = await admin.post('/api/usuarios', {
    nome: 'Motorista Roteiro B',
    cpf: cpfB,
    telefone: '11977776666',
    perfil: 'MOTORISTA',
  });
  const senhaTemporariaB = res.dados?.senhaTemporaria;
  r.ok(res.status === 201 && senhaTemporariaB, 'Cadastrar segundo motorista', resumo(res));

  // O resumo por WhatsApp precisa de um administrador com celular válido. Um
  // administrador próprio do roteiro, para não mexer no do seed.
  res = await admin.post('/api/usuarios', {
    nome: 'Administrador do Roteiro',
    cpf: cpfAleatorio(),
    telefone: '11955554444',
    perfil: 'ADMIN',
  });
  r.ok(res.status === 201, 'Cadastrar administrador com celular válido', resumo(res));

  res = await admin.get('/api/dashboard');
  const kmAntes = Number(res.dados?.indicadores?.kmTotal ?? 0);

  // ----------------------------------------------------------------- motorista
  r.secao('4. O dia do motorista');
  const motoristaA = new Cliente(ambiente, 4);
  res = await motoristaA.post('/api/auth/login', { cpf: cpfA, senha: senhaTemporariaA });
  r.ok(
    res.status === 200 && res.dados?.destino === '/trocar-senha',
    'Primeiro acesso exige troca de senha',
    `${resumo(res)} destino=${res.dados?.destino}`,
  );
  res = await motoristaA.get('/api/jornadas/hoje');
  r.ok(res.status === 403, 'Com senha temporária, leitura pela API é recusada', resumo(res));
  res = await motoristaA.post('/api/jornadas', { veiculoId, odometroInicial: 100000 });
  r.ok(res.status === 403, 'Com senha temporária, abrir jornada pela API é recusado', resumo(res));
  res = await motoristaA.get('/perfil');
  r.ok(
    ehRedirecionamento(res) && (res.headers.get('location') ?? '').includes('/trocar-senha'),
    'Tela Meu perfil manda trocar a senha antes',
    `${res.status} → ${res.headers.get('location')}`,
  );
  const senhaA = senhaAleatoria();
  res = await motoristaA.post('/api/auth/trocar-senha', { novaSenha: senhaA, confirmacao: senhaA });
  r.ok(res.status === 204, 'Trocar a senha', resumo(res));
  res = await motoristaA.get('/api/jornadas/hoje');
  r.ok(res.status === 403, 'Antes do aceite do aviso, leitura pela API é recusada', resumo(res));
  res = await motoristaA.post('/api/jornadas', { veiculoId, odometroInicial: 100000 });
  r.ok(
    res.status === 403 && /aviso de privacidade/i.test(erroDe(res)),
    'Antes do aceite do aviso, abrir jornada é recusado',
    resumo(res),
  );
  res = await motoristaA.post('/api/privacidade/aceite', { versaoTexto: 'versao-antiga' });
  r.ok(res.status === 400, 'Aceite de outra versão do aviso é recusado', resumo(res));
  res = await motoristaA.post('/api/privacidade/aceite', { versaoTexto: versaoAviso });
  r.ok(res.status === 204, `Aceitar o aviso de privacidade ${versaoAviso}`, resumo(res));
  res = await motoristaA.get('/api/usuarios');
  r.ok(res.status === 403, 'Motorista não acessa a API de administração', resumo(res));
  res = await motoristaA.get('/admin');
  r.ok(
    ehRedirecionamento(res) || res.status === 403,
    'Motorista não abre o painel /admin',
    `${res.status} → ${res.headers.get('location') ?? ''}`,
  );
  res = await motoristaA.get('/api/veiculos/disponiveis');
  r.ok(
    res.status === 200 && JSON.stringify(res.dados).includes(placaA),
    'A van aparece como disponível',
    resumo(res),
  );

  res = await motoristaA.post('/api/jornadas', { veiculoId, odometroInicial: 150000 });
  r.ok(
    res.status >= 400 && /diverg|confirm/i.test(JSON.stringify(res.dados)),
    'Odômetro muito acima pede confirmação',
    resumo(res),
  );
  res = await motoristaA.post('/api/jornadas', { veiculoId, odometroInicial: 90000 });
  r.ok(res.status >= 400, 'Odômetro menor que o registrado é recusado', resumo(res));
  res = await motoristaA.post('/api/jornadas', {
    veiculoId,
    odometroInicial: 100000,
    clientUuid: randomUUID(),
  });
  const jornadaId = acharId(res.dados) ?? res.dados?.jornadaId;
  r.ok(res.status === 201 && jornadaId, 'Iniciar o dia (abrir jornada)', resumo(res));
  res = await motoristaA.post('/api/jornadas', { veiculoId, odometroInicial: 100000 });
  r.ok(
    res.status === 200 && res.dados?.jaExistia,
    'Abrir de novo no mesmo dia retoma a jornada',
    resumo(res),
  );
  res = await admin.get('/api/veiculos/disponiveis');
  r.ok(
    res.status === 200 && !JSON.stringify(res.dados).includes(placaA),
    'Van em uso some da lista de disponíveis',
    resumo(res),
  );

  res = await motoristaA.post('/api/corridas', {
    rotaId,
    localizacao: { latitude: -23.55, longitude: -46.63, precisaoMetros: 12 },
    clientUuid: randomUUID(),
  });
  const corrida1 = acharId(res.dados);
  r.ok(res.status === 201 && corrida1, 'Iniciar corrida com rota e GPS', resumo(res));
  res = await motoristaA.post('/api/corridas', { rotaId });
  r.ok(res.status >= 400, 'Segunda corrida simultânea é recusada', resumo(res));
  res = await motoristaA.post(`/api/corridas/${corrida1}/encerrar`, { odometroFinal: 99999 });
  r.ok(res.status >= 400, 'Odômetro final menor que o inicial é recusado', resumo(res));
  res = await motoristaA.post(`/api/corridas/${corrida1}/encerrar`, {
    odometroFinal: 100030,
    quantidadePassageiros: 12,
    localizacao: { latitude: -23.5505, longitude: -46.6333 },
  });
  r.ok(
    res.status === 200,
    'Encerrar corrida (30 km)',
    `${resumo(res)} ${JSON.stringify(res.dados).slice(0, 120)}`,
  );

  res = await motoristaA.post('/api/corridas', {
    origemDescricao: 'Centro',
    destinoDescricao: 'Garagem',
  });
  const corrida2 = acharId(res.dados);
  r.ok(
    res.status === 201 && corrida2,
    'Corrida sem GPS (localização recusada) é aceita',
    resumo(res),
  );
  res = await motoristaA.post(`/api/corridas/${corrida2}/encerrar`, {
    odometroFinal: 100050,
    quantidadePassageiros: 20,
  });
  r.ok(res.status >= 400, 'Passageiros acima da capacidade pedem confirmação', resumo(res));
  res = await motoristaA.post(`/api/corridas/${corrida2}/encerrar`, {
    odometroFinal: 100050,
    quantidadePassageiros: 20,
    confirmaExcessoPassageiros: true,
  });
  r.ok(res.status === 200, 'Com a confirmação, encerra a corrida (20 km)', resumo(res));

  res = await motoristaA.post('/api/corridas', {
    origemDescricao: 'Garagem',
    destinoDescricao: 'Oficina',
  });
  const corrida3 = acharId(res.dados);
  r.ok(res.status === 201, 'Iniciar terceira corrida', resumo(res));
  res = await motoristaA.post(`/api/corridas/${corrida3}/cancelar`, {
    motivo: 'Cliente desmarcou a viagem',
  });
  r.ok(res.status === 200, 'Cancelar corrida com motivo', resumo(res));
  res = await motoristaA.get('/api/jornadas/hoje');
  r.ok(res.status === 200, 'Tela "hoje" do motorista responde', resumo(res));

  const motoristaB = new Cliente(ambiente, 5);
  const senhaB = senhaAleatoria();
  await motoristaB.post('/api/auth/login', { cpf: cpfB, senha: senhaTemporariaB });
  await motoristaB.post('/api/auth/trocar-senha', { novaSenha: senhaB, confirmacao: senhaB });
  await motoristaB.post('/api/privacidade/aceite', { versaoTexto: versaoAviso });
  res = await motoristaB.get(`/api/corridas/${corrida1}`);
  r.ok(res.status === 404, 'Motorista B não vê corrida do motorista A', resumo(res));

  res = await motoristaA.post(`/api/jornadas/${jornadaId}/encerrar`, {
    odometroFinal: 100050,
    observacoes: 'Dia de teste',
  });
  r.ok(
    res.status === 200,
    'Encerrar o dia',
    `${resumo(res)} ${JSON.stringify(res.dados).slice(0, 160)}`,
  );
  res = await motoristaA.post('/api/notificacoes/resumo-dia', { jornadaId });
  const textoResumo = decodeURIComponent(JSON.stringify(res.dados ?? ''));
  r.ok(
    res.status === 200 && /wa\.me/i.test(textoResumo) && textoResumo.includes('Bordo'),
    'Resumo do dia para WhatsApp com link e nome Bordo',
    `${resumo(res)} ${textoResumo.slice(0, 120)}`,
  );
  res = await motoristaA.get(`/api/resumo/${hoje}`);
  r.ok(res.status === 200, 'Resumo do dia do motorista', resumo(res));
  res = await motoristaA.get('/api/offline/retrato');
  r.ok(res.status === 200, 'Retrato para uso sem conexão', resumo(res));

  // --------------------------------------------------------------------- painel
  r.secao('5. Painel do administrador');
  res = await admin.get('/api/dashboard');
  const kmDepois = Number(res.dados?.indicadores?.kmTotal ?? 0);
  r.ok(
    res.status === 200 && kmDepois >= kmAntes + 50,
    'Dashboard soma os 50 km do dia',
    `${resumo(res)} km antes=${kmAntes} depois=${kmDepois}`,
  );
  res = await admin.get(`/api/jornadas?dataInicio=${hoje}&dataFim=${hoje}`);
  r.ok(
    res.status === 200 && JSON.stringify(res.dados).includes(hoje),
    `Jornadas do período trazem a data de hoje (${hoje})`,
    resumo(res),
  );
  res = await admin.get(
    `/api/jornadas?dataInicio=${hoje}&dataFim=${hoje}&motoristaId=${motoristaAId}`,
  );
  r.ok(
    res.status === 200 && JSON.stringify(res.dados).includes(jornadaId),
    'Filtro de jornadas por motorista',
    resumo(res),
  );
  res = await admin.get(`/api/corridas?dataInicio=${hoje}&dataFim=${hoje}`);
  r.ok(
    res.status === 200 && JSON.stringify(res.dados).includes(corrida1),
    'Corridas do dia aparecem na consulta',
    resumo(res),
  );
  res = await admin.get(`/api/resumo/${hoje}`);
  r.ok(res.status === 200, 'Resumo do dia consolidado (admin)', resumo(res));

  // ------------------------------------------------------------------ planilhas
  r.secao('6. Planilhas');
  for (const tipo of ['JORNADAS', 'CORRIDAS', 'RESUMO_DIA']) {
    const filtros = tipo === 'RESUMO_DIA' ? { data: hoje } : { dataInicio: hoje, dataFim: hoje };
    res = await admin.post('/api/exportacoes', { tipo, filtros });
    const arquivoId = res.dados?.arquivoId;
    if (
      !r.ok(
        [201, 202].includes(res.status) && arquivoId,
        `Exportar ${tipo}`,
        `${resumo(res)} ${res.dados?.nome ?? ''}`,
      )
    ) {
      continue;
    }
    const download = await admin.get(`/api/arquivos/${arquivoId}/download`, { binario: true });
    const nome = /filename="([^"]+)"/.exec(download.headers.get('content-disposition') ?? '')?.[1];
    if (
      !r.ok(
        download.status === 200 && download.dados.length > 1000,
        `Baixar planilha ${tipo}`,
        `HTTP ${download.status} ${nome}`,
      )
    ) {
      continue;
    }
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(download.dados);
    const cabecalho = String(livro.worksheets[0].getRow(1).getCell(1).value ?? '');
    r.ok(
      cabecalho.includes('Bordo') && nome?.startsWith('bordo_'),
      `Planilha ${tipo} com cabeçalho e nome Bordo`,
      `abas=${livro.worksheets.map((aba) => aba.name).join('/')} nome=${nome}`,
    );
    const dados = livro.worksheets[livro.worksheets.length - 1];
    let numeros = 0;
    let datas = 0;
    dados.eachRow((linha, indice) => {
      if (indice === 1) return;
      linha.eachCell((celula) => {
        if (typeof celula.value === 'number') numeros++;
        if (celula.value instanceof Date) datas++;
      });
    });
    const congelado = (dados.views ?? []).some((vista) => vista.state === 'frozen');
    r.ok(
      numeros > 0 && datas > 0 && congelado,
      `Planilha ${tipo}: números como número, datas como data, topo fixo`,
      `números=${numeros} datas=${datas} topo fixo=${congelado}`,
    );
  }
  res = await admin.post('/api/exportacoes', {
    tipo: 'JORNADAS',
    filtros: { dataInicio: '2020-01-01', dataFim: '2020-01-02' },
  });
  r.ok(res.status >= 400, 'Exportar período sem registros é recusado', resumo(res));
  res = await admin.get('/api/arquivos');
  r.ok(
    res.status === 200 && JSON.stringify(res.dados).includes('bordo_'),
    'Arquivos gerados aparecem em Arquivos',
    resumo(res),
  );

  // ----------------------------------------------------------------- importação
  r.secao('7. Importação');
  res = await admin.get('/api/importacoes/modelo?tipoDestino=VEICULO', { binario: true });
  if (
    r.ok(
      res.status === 200 && res.dados.length > 1000,
      'Baixar modelo de importação de veículos',
      `HTTP ${res.status}`,
    )
  ) {
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(res.dados);
    const aba = livro.getWorksheet('Veículos') ?? livro.worksheets[0];
    let linhaDoCabecalho = 1;
    aba.eachRow((linha, indice) => {
      if (
        String(linha.getCell(1).value ?? '')
          .replace(/\s*\*$/, '')
          .trim() === 'Placa'
      )
        linhaDoCabecalho = indice;
    });
    const colunas = {};
    aba.getRow(linhaDoCabecalho).eachCell((celula, indice) => {
      colunas[
        String(celula.value)
          .replace(/\s*\*$/, '')
          .trim()
      ] = indice;
    });
    // O modelo traz uma linha de exemplo: ela sai, e entra uma van só.
    for (let indice = linhaDoCabecalho + 1; indice <= aba.rowCount; indice++)
      aba.getRow(indice).values = [];
    const placaImportada = placaAleatoria();
    const valores = {
      Placa: placaImportada,
      Modelo: 'Ducato Minibus',
      Marca: 'Fiat',
      Ano: 2021,
      Capacidade: 16,
      'Odômetro atual': 54321,
    };
    for (const [coluna, valor] of Object.entries(valores)) {
      aba.getRow(linhaDoCabecalho + 1).getCell(colunas[coluna]).value = valor;
    }
    const formulario = new FormData();
    formulario.append('tipoDestino', 'VEICULO');
    formulario.append(
      'arquivo',
      new Blob([Buffer.from(await livro.xlsx.writeBuffer())]),
      'veiculos.xlsx',
    );
    res = await admin.post('/api/importacoes', formulario);
    const importacaoId = res.dados?.importacaoId;
    r.ok(
      res.status === 200 &&
        importacaoId &&
        res.dados?.linhasOk === 1 &&
        res.dados?.linhasErro === 0,
      'Enviar planilha de importação (análise sem erros)',
      `${resumo(res)} ok=${res.dados?.linhasOk} erro=${res.dados?.linhasErro}`,
    );
    if (importacaoId) {
      res = await admin.post(`/api/importacoes/${importacaoId}/confirmar`);
      r.ok(res.status === 200 && res.dados?.importados === 1, 'Confirmar importação', resumo(res));
      res = await admin.get(`/api/veiculos?busca=${encodeURIComponent(placaImportada)}`);
      r.ok(
        JSON.stringify(res.dados).includes(placaImportada),
        'Van importada aparece na lista',
        `placa=${placaImportada}`,
      );
    }
  }

  // ------------------------------------------------------------------ segurança
  r.secao('8. Segurança');
  res = await admin.patch(`/api/usuarios/${motoristaAId}/status`, {
    status: 'BLOQUEADO',
    motivo: 'Teste do roteiro',
  });
  r.ok(res.status === 200, 'Administrador bloqueia o motorista A', resumo(res));
  res = await motoristaA.get('/api/jornadas/hoje');
  r.ok(res.status === 401, 'Sessão do motorista bloqueado cai na hora', resumo(res));
  res = await motoristaA.post('/api/auth/login', { cpf: cpfA, senha: senhaA });
  r.ok(res.status === 403, 'Motorista bloqueado não consegue entrar', resumo(res));
  res = await admin.patch(`/api/usuarios/${motoristaAId}/status`, { status: 'ATIVO' });
  r.ok(res.status === 200, 'Reativar o motorista A', resumo(res));
  res = await admin.post(`/api/usuarios/${motoristaAId}/redefinir-senha`);
  r.ok(
    res.status === 200 && res.dados?.senhaTemporaria,
    'Redefinir senha gera temporária nova',
    resumo(res),
  );

  const tentativas = new Cliente(ambiente, 6);
  for (let i = 0; i < 5; i++)
    await tentativas.post('/api/auth/login', { cpf: cpfB, senha: valorErrado() });
  res = await tentativas.post('/api/auth/login', { cpf: cpfB, senha: senhaB });
  r.ok(
    res.status === 403 && /bloque/i.test(erroDe(res)),
    'Cinco erros bloqueiam a conta temporariamente',
    resumo(res),
  );

  const enxurrada = new Cliente(ambiente, 7);
  for (let i = 0; i < 11; i++) {
    res = await enxurrada.post('/api/auth/login', { cpf: cpfAleatorio(), senha: valorErrado() });
  }
  r.ok(res.status === 429, 'Mais de 10 tentativas por IP em 15 min são barradas', resumo(res));

  res = await motoristaB.post('/api/auth/logout');
  r.ok(res.status === 200 || res.status === 204, 'Sair (logout)', resumo(res));
  res = await motoristaB.get('/api/perfil');
  r.ok(res.status === 401, 'Depois de sair, a sessão não vale mais', resumo(res));

  // --------------------------------------------------------------- todas as telas
  r.secao('9. Todas as telas');
  // "Algo não saiu como esperado" é o título da tela de erro (`app/error.tsx`).
  // O marcador antigo, "Algo deu errado", não aparecia em tela de erro nenhuma
  // e passou a acusar falso: é o texto do botão de ajuda da faixa do motorista.
  const quebrou = (html) =>
    /Application error|Unhandled Runtime Error|Internal Server Error|Algo não saiu como esperado/i.test(
      String(html),
    );
  const telasDoAdmin = [
    '/admin',
    '/admin/arquivos',
    '/admin/auditoria',
    '/admin/configuracoes',
    '/admin/corridas',
    `/admin/corridas/${corrida1}`,
    '/admin/escala',
    '/admin/importar',
    '/admin/jornadas',
    `/admin/jornadas/${jornadaId}`,
    '/admin/notificacoes',
    '/admin/pendencias',
    '/admin/preparacao',
    '/admin/relatorios',
    '/admin/resumo',
    '/admin/retencao',
    '/admin/rotas',
    `/admin/rotas/${rotaId}`,
    '/admin/rotas/novo',
    '/admin/usuarios',
    `/admin/usuarios/${motoristaAId}`,
    '/admin/usuarios/novo',
    '/admin/veiculos',
    `/admin/veiculos/${veiculoId}`,
    '/admin/veiculos/novo',
    '/perfil',
  ];
  for (const tela of telasDoAdmin) {
    // O detalhe de corrida do painel reaproveita a tela em /app/corrida/[id].
    res = tela.startsWith('/admin/corridas/') ? await admin.seguir(tela) : await admin.get(tela);
    r.ok(res.status === 200 && !quebrou(res.dados), `Tela ${tela}`, `HTTP ${res.status}`);
  }

  const motoristaC = new Cliente(ambiente, 8);
  const cpfC = cpfAleatorio();
  const senhaC = senhaAleatoria();
  res = await admin.post('/api/usuarios', {
    nome: 'Motorista Roteiro C',
    cpf: cpfC,
    telefone: '11966665555',
    perfil: 'MOTORISTA',
  });
  await motoristaC.post('/api/auth/login', { cpf: cpfC, senha: res.dados?.senhaTemporaria });
  await motoristaC.post('/api/auth/trocar-senha', { novaSenha: senhaC, confirmacao: senhaC });
  await motoristaC.post('/api/privacidade/aceite', { versaoTexto: versaoAviso });
  const telasDoMotorista = [
    '/app',
    '/app/jornada/abrir',
    '/app/abastecimento',
    '/app/historico',
    '/app/ajuda',
    '/app/pendencias-de-envio',
    `/app/resumo/${hoje}`,
    '/app/sem-conexao',
    '/perfil',
  ];
  for (const tela of telasDoMotorista) {
    res = await motoristaC.get(tela);
    r.ok(
      res.status === 200 && !quebrou(res.dados),
      `Tela do motorista ${tela}`,
      `HTTP ${res.status}`,
    );
  }
  // Ocorrência só existe com o dia aberto; sem ele, volta para o início.
  res = await motoristaC.get('/app/ocorrencia');
  r.ok(
    ehRedirecionamento(res) && res.headers.get('location') === '/app',
    'Tela de ocorrência sem dia aberto volta para /app',
    `${res.status} → ${res.headers.get('location')}`,
  );
}

await rodarSeForPrincipal(import.meta.url, executar);
