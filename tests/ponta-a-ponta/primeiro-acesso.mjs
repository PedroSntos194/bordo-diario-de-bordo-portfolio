import {
  Cliente,
  cpfAleatorio,
  ehRedirecionamento,
  resumo,
  rodarSeForPrincipal,
  senhaAleatoria,
} from './apoio.mjs';

/**
 * Primeiro acesso de um motorista, pelas telas: com a senha temporária só se
 * chega à troca de senha; depois dela, só ao aviso de privacidade. As telas
 * que resolvem a pendência precisam abrir, e sair precisa funcionar — a trava
 * de 30/09 (55ad1aa) não pode prender ninguém nelas.
 */
export async function executar(ambiente, r) {
  const admin = new Cliente(ambiente, 31);
  let res = await admin.post('/api/auth/login', {
    cpf: ambiente.adminCpf,
    senha: ambiente.adminSenha,
  });
  if (res.status !== 200) throw new Error(`O administrador não entrou: ${resumo(res)}`);

  r.secao('Primeiro acesso');
  const cpf = cpfAleatorio();
  res = await admin.post('/api/usuarios', {
    nome: 'Motorista Primeiro Acesso',
    cpf,
    telefone: '11944443333',
    perfil: 'MOTORISTA',
  });
  r.ok(res.status === 201, 'Cadastrar motorista', resumo(res));

  const motorista = new Cliente(ambiente, 32);
  res = await motorista.post('/api/auth/login', { cpf, senha: res.dados?.senhaTemporaria });
  r.ok(
    res.dados?.destino === '/trocar-senha',
    'Login com senha temporária leva à troca',
    resumo(res),
  );

  res = await motorista.get('/trocar-senha');
  r.ok(res.status === 200, 'Tela de troca de senha abre com a senha temporária', resumo(res));
  res = await motorista.get('/');
  r.ok(
    ehRedirecionamento(res) && (res.headers.get('location') ?? '').includes('/trocar-senha'),
    'Início leva à troca de senha',
    `${res.status} → ${res.headers.get('location')}`,
  );

  const senha = senhaAleatoria();
  res = await motorista.post('/api/auth/trocar-senha', { novaSenha: senha, confirmacao: senha });
  r.ok(res.status === 204, 'Trocar a senha', resumo(res));
  res = await motorista.get('/privacidade/aceite');
  r.ok(res.status === 200, 'Tela do aviso abre antes do aceite', resumo(res));
  res = await motorista.get('/app');
  r.ok(
    ehRedirecionamento(res) && (res.headers.get('location') ?? '').includes('/privacidade/aceite'),
    'Área do motorista manda para o aviso',
    `${res.status} → ${res.headers.get('location')}`,
  );

  res = await motorista.post('/api/auth/logout');
  r.ok(res.status === 200 || res.status === 204, 'Sair funciona com pendência', resumo(res));
}

await rodarSeForPrincipal(import.meta.url, executar);
