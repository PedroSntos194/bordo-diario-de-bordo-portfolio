import { contaEstaBloqueada, senhaTemporariaExpirou } from '@/modulos/usuario/usuario.regras';
import { dataOperacional, formatarDataHora, formatarDataOperacional } from '@/utilitarios/data';

export type EstadoDeAcesso =
  | 'NUNCA_ENTROU'
  | 'TROCA_PENDENTE'
  | 'SENHA_EXPIRADA'
  | 'BLOQUEIO_TEMPORARIO'
  | 'CONTA_INATIVA'
  | 'CONTA_BLOQUEADA'
  | 'PRIVACIDADE_PENDENTE'
  | 'PRONTO';
export type EstadoDaOperacao =
  | 'SEM_ESCALA'
  | 'FOLGA'
  | 'AGUARDANDO_INICIAR'
  | 'DIA_INICIADO'
  | 'CORRIDA_EM_ANDAMENTO'
  | 'DIA_ENCERRADO';

export interface DadosDoMotorista {
  id: string;
  nome: string;
  status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO' | 'EXCLUIDO';
  ultimoLoginEm: Date | null;
  deveTrocarSenha: boolean;
  senhaTemporariaExpiraEm: Date | null;
  bloqueadoAte: Date | null;
  versoesAceitas: string[];
  escalado: boolean;
  deFolga: boolean;
  primeiraJornadaEm: Date | null;
  possuiCorridaConcluida: boolean;
  jornadaDoDia: {
    id: string;
    data: string;
    status: 'ABERTA' | 'ENCERRADA' | 'CANCELADA';
    iniciadaEm: Date;
    encerradaEm: Date | null;
    /** Opcional para não exigir a van de quem só quer o estado de acesso. */
    veiculo?: { placa: string };
    corridas: { status: 'EM_ANDAMENTO' | 'ENCERRADA' | 'CANCELADA'; encerradaEm: Date | null }[];
  } | null;
  jornadaAnteriorAberta: { id: string; data: string } | null;
}

export interface EtapaDeAdocao {
  chave: 'login' | 'senha' | 'privacidade' | 'jornada' | 'corrida';
  rotulo: string;
  concluida: boolean;
  evidencia: string;
}

export interface SituacaoDoMotorista {
  id: string;
  nome: string;
  contaAtiva: boolean;
  acesso: EstadoDeAcesso;
  acessoDescricao: string;
  ultimoLoginEm: Date | null;
  operacao: EstadoDaOperacao;
  operacaoDescricao: string;
  escalado: boolean;
  deFolga: boolean;
  jornadaId: string | null;
  /** Hora em que tocou em "Iniciar meu dia" na data consultada. */
  iniciouEm: Date | null;
  encerrouEm: Date | null;
  placaDoDia: string | null;
  /** Entrou no aplicativo (login) na data consultada, no fuso da operação. */
  entrouNoDia: boolean;
  corridasConcluidasNoDia: number;
  jornadaAnteriorAberta: { id: string; data: string } | null;
  adocao: EtapaDeAdocao[];
  adocaoConcluida: boolean;
  precisaAtencao: boolean;
  proximoPasso: string;
  orientacao: string;
  caminhoAjuda: string;
}

/** A senha redefinida muda a pendência atual; não apaga o login que já ocorreu. */
function acessoDoMotorista(
  motorista: DadosDoMotorista,
  agora: Date,
  versaoPrivacidade: string,
): EstadoDeAcesso {
  if (motorista.status === 'BLOQUEADO') return 'CONTA_BLOQUEADA';
  if (motorista.status !== 'ATIVO') return 'CONTA_INATIVA';
  if (contaEstaBloqueada({ tentativasLogin: 0, bloqueadoAte: motorista.bloqueadoAte }, agora)) {
    return 'BLOQUEIO_TEMPORARIO';
  }
  if (
    motorista.deveTrocarSenha &&
    senhaTemporariaExpirou(motorista.senhaTemporariaExpiraEm, agora)
  ) {
    return 'SENHA_EXPIRADA';
  }
  if (!motorista.ultimoLoginEm) return 'NUNCA_ENTROU';
  if (motorista.deveTrocarSenha) return 'TROCA_PENDENTE';
  if (!motorista.versoesAceitas.includes(versaoPrivacidade)) return 'PRIVACIDADE_PENDENTE';
  return 'PRONTO';
}

function operacaoDoMotorista(motorista: DadosDoMotorista): EstadoDaOperacao {
  const jornada = motorista.jornadaDoDia;
  if (jornada?.status === 'ENCERRADA') return 'DIA_ENCERRADO';
  if (jornada?.status === 'ABERTA') {
    if (jornada.corridas.some((corrida) => corrida.status === 'EM_ANDAMENTO')) {
      return 'CORRIDA_EM_ANDAMENTO';
    }
    return 'DIA_INICIADO';
  }
  // Folga prevalece sobre a obrigação da escala, sem esconder operação já registrada.
  if (motorista.deFolga) return 'FOLGA';
  return motorista.escalado ? 'AGUARDANDO_INICIAR' : 'SEM_ESCALA';
}

const DESCRICOES_ACESSO: Record<EstadoDeAcesso, string> = {
  NUNCA_ENTROU: 'Nunca entrou',
  TROCA_PENDENTE: 'Troca de senha pendente',
  SENHA_EXPIRADA: 'Senha temporária vencida',
  BLOQUEIO_TEMPORARIO: 'Bloqueio por tentativas',
  CONTA_INATIVA: 'Conta inativa',
  CONTA_BLOQUEADA: 'Conta bloqueada pela administração',
  PRIVACIDADE_PENDENTE: 'Aceite de privacidade pendente',
  PRONTO: 'Acesso pronto',
};

const DESCRICOES_OPERACAO: Record<EstadoDaOperacao, string> = {
  SEM_ESCALA: 'Sem escala',
  FOLGA: 'Folga',
  AGUARDANDO_INICIAR: 'Aguardando iniciar',
  DIA_INICIADO: 'Dia iniciado',
  CORRIDA_EM_ANDAMENTO: 'Corrida em andamento',
  DIA_ENCERRADO: 'Dia encerrado',
};

export function avaliarSituacaoDoMotorista(
  motorista: DadosDoMotorista,
  data: string,
  agora: Date,
  versaoPrivacidade: string,
): SituacaoDoMotorista {
  const acesso = acessoDoMotorista(motorista, agora, versaoPrivacidade);
  const operacao = operacaoDoMotorista(motorista);
  const privacidadeAceita = motorista.versoesAceitas.includes(versaoPrivacidade);
  const adocao: EtapaDeAdocao[] = [
    {
      chave: 'login',
      rotulo: 'Entrar',
      concluida: motorista.ultimoLoginEm !== null,
      evidencia: motorista.ultimoLoginEm
        ? `Último acesso: ${formatarDataHora(motorista.ultimoLoginEm)}.`
        : 'Nenhum login registrado.',
    },
    {
      chave: 'senha',
      rotulo: 'Trocar senha',
      concluida: !motorista.deveTrocarSenha,
      evidencia: motorista.deveTrocarSenha
        ? 'A senha atual ainda exige troca; uma redefinição pode reabrir esta etapa.'
        : 'A senha atual já foi trocada.',
    },
    {
      chave: 'privacidade',
      rotulo: 'Aceitar privacidade',
      concluida: privacidadeAceita,
      evidencia: privacidadeAceita
        ? `Aceite da versão ${versaoPrivacidade} registrado.`
        : `Aceite da versão ${versaoPrivacidade} pendente.`,
    },
    {
      chave: 'jornada',
      rotulo: 'Primeira jornada',
      concluida: motorista.primeiraJornadaEm !== null,
      evidencia: motorista.primeiraJornadaEm
        ? `Primeira jornada válida: ${formatarDataHora(motorista.primeiraJornadaEm)}.`
        : 'Nenhuma jornada válida registrada.',
    },
    {
      chave: 'corrida',
      rotulo: 'Primeira corrida concluída',
      concluida: motorista.possuiCorridaConcluida,
      evidencia: motorista.possuiCorridaConcluida
        ? 'Há corrida encerrada em uma jornada válida no histórico.'
        : 'Ainda não há corrida encerrada em uma jornada válida.',
    },
  ];
  const adocaoConcluida = adocao.every((etapa) => etapa.concluida);
  const contaAtiva = motorista.status === 'ATIVO';
  // Uma jornada antiga é pendência própria: nunca conta como início do dia escolhido.
  const anterior = motorista.jornadaAnteriorAberta;
  const cobravel = contaAtiva && motorista.escalado && !motorista.deFolga;
  const jornadaDoDiaNaoEncerrada =
    data < dataOperacional(agora) && ['DIA_INICIADO', 'CORRIDA_EM_ANDAMENTO'].includes(operacao);
  const precisaAtencao =
    anterior !== null ||
    jornadaDoDiaNaoEncerrada ||
    (contaAtiva &&
      (acesso !== 'PRONTO' ||
        !privacidadeAceita ||
        !adocaoConcluida ||
        (cobravel && operacao === 'AGUARDANDO_INICIAR')));

  let proximoPasso: string;
  switch (acesso) {
    case 'CONTA_INATIVA':
    case 'CONTA_BLOQUEADA':
      proximoPasso = 'Confira no cadastro se esta conta deve ser reativada.';
      break;
    case 'BLOQUEIO_TEMPORARIO':
      proximoPasso = `Aguarde até ${formatarDataHora(motorista.bloqueadoAte!)} antes de tentar novamente. Se perdeu a senha, gere uma nova.`;
      break;
    case 'SENHA_EXPIRADA':
      proximoPasso = 'Gere uma nova senha temporária e entregue individualmente ao motorista.';
      break;
    case 'NUNCA_ENTROU':
      proximoPasso =
        'Confirme que recebeu a senha temporária e acompanhe o primeiro acesso no celular.';
      break;
    case 'TROCA_PENDENTE':
      proximoPasso = 'Oriente a troca da senha temporária no próximo acesso.';
      break;
    case 'PRIVACIDADE_PENDENTE':
      proximoPasso = 'Oriente a leitura e o aceite do aviso de privacidade.';
      break;
    default:
      if (!privacidadeAceita)
        proximoPasso = 'Oriente a leitura e o aceite do aviso de privacidade.';
      else if (anterior)
        proximoPasso = `Confira e encerre a jornada de ${formatarDataOperacional(anterior.data)} antes de abrir outro dia.`;
      else if (jornadaDoDiaNaoEncerrada)
        proximoPasso =
          'Confira os registros deste dia anterior, os envios pendentes no celular e o encerramento das corridas e da jornada.';
      else if (operacao === 'FOLGA')
        proximoPasso = 'Folga registrada: não cobrar operação neste dia.';
      else if (operacao === 'SEM_ESCALA')
        proximoPasso =
          'Confira a escala antes de cobrar registro neste dia. Se for a primeira utilização, combine uma demonstração.';
      else if (operacao === 'AGUARDANDO_INICIAR')
        proximoPasso =
          data < dataOperacional(agora)
            ? 'Confira se trabalhou neste dia e se há registros pendentes de envio no celular.'
            : 'Acompanhe a abertura do dia no celular do motorista.';
      else if (operacao === 'CORRIDA_EM_ANDAMENTO')
        proximoPasso =
          'A corrida está em andamento. Encerrar ao chegar e encerrar o dia ao terminar o trabalho.';
      else if (operacao === 'DIA_INICIADO')
        proximoPasso =
          'Oriente o início e encerramento de cada corrida e o encerramento do dia ao terminar.';
      else if (!motorista.possuiCorridaConcluida)
        proximoPasso =
          'Confira se houve corridas e acompanhe a primeira corrida completa no próximo dia de trabalho.';
      else proximoPasso = 'Dia encerrado. Confira os registros em Ver jornada.';
  }

  let orientacaoDaOperacao: string;
  if (anterior)
    orientacaoDaOperacao = `Confira a jornada de ${formatarDataOperacional(anterior.data)}. Se o trabalho terminou, confira as corridas e encerre esse dia antes de abrir outro.`;
  else if (data < dataOperacional(agora))
    orientacaoDaOperacao = `Vamos conferir os registros de ${formatarDataOperacional(data)}. Se trabalhou e os registros não aparecem, confira os envios pendentes no mesmo celular e peça ajuda à administração.`;
  else if (data > dataOperacional(agora))
    orientacaoDaOperacao = `Confirme com a administração a escala de ${formatarDataOperacional(data)}. Os registros devem ser feitos quando começar o trabalho.`;
  else if (operacao === 'FOLGA')
    orientacaoDaOperacao =
      'Sua folga está registrada hoje. Se precisar trabalhar, confirme a escala com a administração antes de abrir o dia.';
  else if (operacao === 'SEM_ESCALA')
    orientacaoDaOperacao =
      'Confirme com a administração se está previsto trabalhar hoje e confira sua escala antes de abrir o dia.';
  else if (operacao === 'DIA_ENCERRADO')
    orientacaoDaOperacao =
      'Seu dia está encerrado. Confira as viagens no Histórico e se os registros feitos sem internet foram enviados.';
  else if (operacao === 'CORRIDA_EM_ANDAMENTO')
    orientacaoDaOperacao =
      'Sua corrida está em andamento. Se a viagem terminou, confira o odômetro e os passageiros e encerre a corrida. Encerre o dia após terminar o trabalho.';
  else if (operacao === 'DIA_INICIADO')
    orientacaoDaOperacao =
      'Seu dia está aberto. Registre o início e o fim de cada corrida e encerre o dia após terminar o trabalho. Confira também o envio dos registros no celular.';
  else
    orientacaoDaOperacao =
      'Quando começar o trabalho, confira a van e o odômetro e inicie o dia. Registre cada corrida e encerre o dia ao terminar. Confira o envio dos registros no celular.';

  const orientacoesDeAcesso: Record<EstadoDeAcesso, string> = {
    CONTA_INATIVA:
      'Seu acesso precisa ser conferido pela administração. Entre em contato com a empresa.',
    CONTA_BLOQUEADA:
      'Seu acesso precisa ser conferido pela administração. Entre em contato com a empresa.',
    BLOQUEIO_TEMPORARIO: `Aguarde até ${motorista.bloqueadoAte ? formatarDataHora(motorista.bloqueadoAte) : ''} antes de tentar novamente. Se não lembrar a senha, peça uma nova à administração.`,
    SENHA_EXPIRADA: 'Peça uma nova senha temporária à administração e faça a troca ao entrar.',
    NUNCA_ENTROU:
      'Abra o aplicativo com internet, use seu CPF e a senha recebida da empresa. Vamos acompanhar seu primeiro acesso juntos.',
    TROCA_PENDENTE:
      'Entre com a senha temporária recebida e escolha sua nova senha quando o aplicativo pedir.',
    PRIVACIDADE_PENDENTE:
      'Entre no aplicativo, leia o aviso de privacidade e confirme a leitura para continuar.',
    PRONTO: orientacaoDaOperacao,
  };

  return {
    id: motorista.id,
    nome: motorista.nome,
    contaAtiva,
    acesso,
    acessoDescricao:
      acesso === 'BLOQUEIO_TEMPORARIO'
        ? `Bloqueado até ${formatarDataHora(motorista.bloqueadoAte!)}`
        : DESCRICOES_ACESSO[acesso],
    ultimoLoginEm: motorista.ultimoLoginEm,
    operacao,
    operacaoDescricao: DESCRICOES_OPERACAO[operacao],
    escalado: motorista.escalado && !motorista.deFolga,
    deFolga: motorista.deFolga,
    jornadaId: motorista.jornadaDoDia?.id ?? null,
    iniciouEm: motorista.jornadaDoDia?.iniciadaEm ?? null,
    encerrouEm: motorista.jornadaDoDia?.encerradaEm ?? null,
    placaDoDia: motorista.jornadaDoDia?.veiculo?.placa ?? null,
    entrouNoDia:
      motorista.ultimoLoginEm !== null && dataOperacional(motorista.ultimoLoginEm) === data,
    corridasConcluidasNoDia:
      motorista.jornadaDoDia?.corridas.filter(
        (corrida) => corrida.status === 'ENCERRADA' && corrida.encerradaEm !== null,
      ).length ?? 0,
    jornadaAnteriorAberta: anterior,
    adocao,
    adocaoConcluida,
    precisaAtencao,
    proximoPasso,
    orientacao: `${motorista.nome}, vamos conferir o aplicativo juntos? ${orientacoesDeAcesso[acesso]}`,
    caminhoAjuda: acesso === 'PRONTO' ? '/app/ajuda' : '/ajuda-acesso',
  };
}

export function resumirSituacoes(motoristas: SituacaoDoMotorista[]) {
  return {
    total: motoristas.length,
    precisamAtencao: motoristas.filter((motorista) => motorista.precisaAtencao).length,
    nuncaEntraram: motoristas.filter((motorista) => motorista.ultimoLoginEm === null).length,
    escaladosSemJornada: motoristas.filter(
      (motorista) => motorista.contaAtiva && motorista.operacao === 'AGUARDANDO_INICIAR',
    ).length,
    emOperacao: motoristas.filter((motorista) =>
      ['DIA_INICIADO', 'CORRIDA_EM_ANDAMENTO'].includes(motorista.operacao),
    ).length,
    diaEncerrado: motoristas.filter((motorista) => motorista.operacao === 'DIA_ENCERRADO').length,
    adocaoConcluida: motoristas.filter((motorista) => motorista.adocaoConcluida).length,
  };
}

export function filtrarSituacoes(
  motoristas: SituacaoDoMotorista[],
  busca: string | undefined,
  apenasAtencao: boolean,
): SituacaoDoMotorista[] {
  const normalizar = (valor: string) =>
    valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  const termo = normalizar(busca?.trim() ?? '');
  return motoristas.filter(
    (motorista) =>
      (!apenasAtencao || motorista.precisaAtencao) && normalizar(motorista.nome).includes(termo),
  );
}

// ------------------------------------------------------------ presença do dia

/**
 * Quem foi trabalhar no dia, para o painel (pedido do cliente de 07/10).
 *
 * A administração chega às 8h e os motoristas começam às 6h: ao abrir o painel
 * ela precisa ver, de relance, quem começou e quem não. "Começou" é ter tocado
 * em **Iniciar meu dia** — o login sozinho não diz nada, porque a sessão vale
 * horas e pode ter sido aberta na véspera. Para quem não começou, o painel
 * mostra também se entrou no aplicativo hoje: cobre as duas leituras de "fez
 * login" enquanto o cliente não define qual vale.
 *
 * Quatro grupos, nesta ordem de prioridade:
 *
 * - **Começaram**: há jornada do dia, aberta ou encerrada. Vale mesmo de folga
 *   ou com a conta desativada depois — o registro existe e não se esconde.
 * - **Não conseguem entrar**: conta ativa, sem jornada e com acesso pendente
 *   (senha vencida, bloqueio, primeiro acesso). Não adianta cobrar: falta
 *   destravar, e é isso que a administração precisa fazer.
 * - **Não começaram**: conta ativa, acesso pronto, sem jornada e sem folga.
 * - **De folga**.
 *
 * Conta inativa sem jornada fica de fora: não é esperada no trabalho.
 */
export interface PresencaDoDia {
  comecaram: SituacaoDoMotorista[];
  semAcesso: SituacaoDoMotorista[];
  naoComecaram: SituacaoDoMotorista[];
  deFolga: SituacaoDoMotorista[];
  /** Motoristas ativos escalados e sem folga — quem o dia espera. */
  esperados: number;
  /** Há escala cadastrada para o dia? Sem ela, ninguém é "esperado". */
  temEscala: boolean;
}

const OPERACOES_INICIADAS: readonly EstadoDaOperacao[] = [
  'DIA_INICIADO',
  'CORRIDA_EM_ANDAMENTO',
  'DIA_ENCERRADO',
];

export function separarPresencaDoDia(motoristas: readonly SituacaoDoMotorista[]): PresencaDoDia {
  const presenca: PresencaDoDia = {
    comecaram: [],
    semAcesso: [],
    naoComecaram: [],
    deFolga: [],
    esperados: 0,
    temEscala: false,
  };

  for (const motorista of motoristas) {
    if (motorista.escalado || motorista.deFolga) presenca.temEscala = true;
    if (motorista.contaAtiva && motorista.escalado) presenca.esperados += 1;

    if (OPERACOES_INICIADAS.includes(motorista.operacao)) presenca.comecaram.push(motorista);
    else if (!motorista.contaAtiva) continue;
    else if (motorista.deFolga) presenca.deFolga.push(motorista);
    else if (motorista.acesso !== 'PRONTO') presenca.semAcesso.push(motorista);
    else presenca.naoComecaram.push(motorista);
  }

  const porNome = (a: SituacaoDoMotorista, b: SituacaoDoMotorista): number =>
    a.nome.localeCompare(b.nome, 'pt-BR');
  // Quem estava escalado vem primeiro: é a ausência que mais pesa.
  const escaladosPrimeiro = (a: SituacaoDoMotorista, b: SituacaoDoMotorista): number =>
    Number(b.escalado) - Number(a.escalado) || porNome(a, b);

  presenca.comecaram.sort(
    (a, b) => (a.iniciouEm?.getTime() ?? 0) - (b.iniciouEm?.getTime() ?? 0) || porNome(a, b),
  );
  presenca.semAcesso.sort(escaladosPrimeiro);
  presenca.naoComecaram.sort(escaladosPrimeiro);
  presenca.deFolga.sort(porNome);

  return presenca;
}
