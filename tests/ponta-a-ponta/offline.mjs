import { randomUUID } from 'node:crypto';
import {
  Cliente,
  acharId,
  cpfAleatorio,
  placaAleatoria,
  resumo,
  rodarSeForPrincipal,
  senhaAleatoria,
} from './apoio.mjs';

/**
 * Modo sem conexão (Sprint 10): um dia inteiro registrado sem sinal chega ao
 * servidor de uma vez, pela mesma rota que o aplicativo usa para esvaziar a
 * fila do aparelho — e reenviar a fila não duplica nada.
 */
export async function executar(ambiente, r) {
  const admin = new Cliente(ambiente, 21);
  let res = await admin.post('/api/auth/login', {
    cpf: ambiente.adminCpf,
    senha: ambiente.adminSenha,
  });
  if (res.status !== 200) throw new Error(`O administrador não entrou: ${resumo(res)}`);

  r.secao('Sem conexão');
  const placa = placaAleatoria();
  res = await admin.post('/api/veiculos', {
    placa,
    modelo: 'Van Sem Sinal',
    capacidadePassageiros: 15,
    odometroAtual: 5000,
  });
  const veiculoId = acharId(res.dados);
  r.ok(res.status === 201 && veiculoId, 'Cadastrar van', resumo(res));

  const motorista = await criarMotoristaPronto(ambiente, admin, 22, { aceitaAviso: true });

  // Os instantes são os do aparelho, ao longo da última hora.
  const agora = Date.now();
  const minuto = (m) => new Date(agora - (60 - m) * 60_000).toISOString();
  const [jornada, corrida, parada, fimCorrida, fimDia] = Array.from({ length: 5 }, () =>
    randomUUID(),
  );
  const lote = {
    operacoes: [
      {
        clientUuid: jornada,
        tipo: 'ABRIR_JORNADA',
        ocorridoEm: minuto(0),
        dados: { veiculoId, odometroInicial: 5000, clientUuid: jornada },
      },
      {
        clientUuid: corrida,
        tipo: 'INICIAR_CORRIDA',
        ocorridoEm: minuto(5),
        dados: {
          origemDescricao: 'Garagem',
          destinoDescricao: 'Escola',
          clientUuid: corrida,
          localizacao: { latitude: -23.55, longitude: -46.63 },
        },
      },
      {
        clientUuid: parada,
        tipo: 'REGISTRAR_EVENTO',
        ocorridoEm: minuto(20),
        dados: {
          corridaClientUuid: corrida,
          tipo: 'EMBARQUE',
          descricao: 'Portão da escola',
          clientUuid: parada,
        },
      },
      {
        clientUuid: fimCorrida,
        tipo: 'ENCERRAR_CORRIDA',
        ocorridoEm: minuto(40),
        dados: { corridaClientUuid: corrida, odometroFinal: 5018, quantidadePassageiros: 11 },
      },
      {
        clientUuid: fimDia,
        tipo: 'ENCERRAR_JORNADA',
        ocorridoEm: minuto(55),
        dados: { odometroFinal: 5018 },
      },
    ],
  };

  res = await motorista.post('/api/sincronizacao', lote);
  const situacoes = (res.dados?.resultados ?? []).map((item) => item.situacao);
  r.ok(
    res.status === 200 && situacoes.length === 5 && situacoes.every((s) => s === 'APLICADA'),
    'Dia inteiro registrado sem sinal sincroniza de uma vez (5 operações)',
    `${resumo(res)} ${situacoes.join(',')}`,
  );
  res = await motorista.post('/api/sincronizacao', lote);
  const reenvio = (res.dados?.resultados ?? []).map((item) => item.situacao);
  r.ok(
    res.status === 200 && reenvio.length === 5 && reenvio.every((s) => s === 'JA_PROCESSADA'),
    'Reenviar a mesma fila não duplica nada',
    `${resumo(res)} ${reenvio.join(',')}`,
  );
  res = await admin.get(
    `/api/corridas?dataInicio=${ambiente.hoje}&dataFim=${ambiente.hoje}&busca=${encodeURIComponent(placa)}`,
  );
  const texto = JSON.stringify(res.dados);
  r.ok(
    res.status === 200 && texto.includes('Escola') && texto.includes('18'),
    'Corrida feita sem sinal aparece no painel com 18 km',
    resumo(res),
  );

  // Quem não aceitou o aviso tem a fila recusada inteira, com resposta não-OK:
  // o aparelho mantém a fila e reenvia depois do aceite (src/offline/sincronizador.ts).
  const pendente = await criarMotoristaPronto(ambiente, admin, 23, { aceitaAviso: false });
  res = await pendente.post('/api/sincronizacao', {
    operacoes: [
      {
        clientUuid: randomUUID(),
        tipo: 'ABRIR_JORNADA',
        ocorridoEm: new Date().toISOString(),
        dados: { veiculoId, odometroInicial: 5018 },
      },
    ],
  });
  r.ok(
    res.status === 403,
    'Fila de quem não aceitou o aviso é recusada inteira (fica no aparelho)',
    resumo(res),
  );
}

/** Motorista criado pelo administrador, com a senha temporária já trocada. */
async function criarMotoristaPronto(ambiente, admin, finalDoIp, { aceitaAviso }) {
  const cpf = cpfAleatorio();
  const res = await admin.post('/api/usuarios', {
    nome: 'Motorista Sem Sinal',
    cpf,
    telefone: '11933332222',
    perfil: 'MOTORISTA',
  });
  const motorista = new Cliente(ambiente, finalDoIp);
  const senha = senhaAleatoria();
  await motorista.post('/api/auth/login', { cpf, senha: res.dados?.senhaTemporaria });
  await motorista.post('/api/auth/trocar-senha', { novaSenha: senha, confirmacao: senha });
  if (aceitaAviso) {
    await motorista.post('/api/privacidade/aceite', { versaoTexto: ambiente.versaoAviso });
  }
  return motorista;
}

await rodarSeForPrincipal(import.meta.url, executar);
