export const AJUDAS_DA_ADMINISTRACAO = [
  {
    chave: 'painel',
    titulo: 'Acompanhar a operação',
    passos: [
      'Confira a data antes de interpretar os indicadores. Jornadas abertas e corridas em andamento mostram trabalho iniciado; os totais concluídos dependem do encerramento.',
      'Abra Situação dos motoristas para separar dificuldade de acesso de falta de registro na operação.',
      'Confira Escala e Folgas do dia antes de procurar quem está sem registro. Só motoristas ativos escalados e sem folga devem ser cobrados por falta de registro.',
      'Abra as ocorrências e as pendências para conferir o caso de cada motorista. Um dia aberto pode continuar aberto de uma data anterior.',
    ],
  },
  {
    chave: 'motoristas',
    titulo: 'Situação dos motoristas',
    passos: [
      'Confira a data. A situação de acesso e o registro de trabalho são informações separadas: ter entrado no aplicativo não significa ter iniciado o dia.',
      'Nunca entrou significa que não há login registrado. Troca de senha pendente também pode acontecer depois de redefinir a senha de quem já utilizava o aplicativo.',
      'Senha temporária vencida exige uma nova senha. Para bloqueio temporário por tentativas incorretas, confira o horário de liberação e aguarde antes de tentar outra vez.',
      'Confira a escala e a folga antes de acompanhar quem está sem registro. Abra a jornada para consultar as corridas de quem já começou.',
    ],
  },
  {
    chave: 'usuarios',
    titulo: 'Cadastro e acesso',
    passos: [
      'Confira o perfil Motorista, o status e o CPF do cadastro. O último acesso mostra um login registrado; ele não confirma que o motorista registrou viagens.',
      'Em Mais ações, use Redefinir senha se a senha temporária venceu ou se o motorista esqueceu a senha. A senha atual deixa de funcionar e as sessões abertas são encerradas.',
      'Entregue a senha temporária individualmente ao motorista correto. No primeiro acesso com ela, o aplicativo pede uma nova senha pessoal.',
      'Troca de senha pendente não prova que a pessoa nunca entrou: ela também aparece após uma redefinição. Consulte a situação de acesso e confirme a mensagem que aparece no celular.',
      'Use Folgas do dia, em Escala, para uma folga pontual. Desativar o cadastro tira o acesso ao aplicativo.',
    ],
  },
  {
    chave: 'jornadas',
    titulo: 'Consultar um dia de trabalho',
    passos: [
      'Ajuste o período e o motorista. Jornada é o dia de trabalho aberto pelo motorista, com a van e o odômetro de início.',
      'Abra uma jornada para conferir corridas, abastecimentos e ocorrências. Uma jornada aberta pode ser de um dia anterior.',
      'Se uma viagem ainda está em andamento, confira com o motorista antes de orientar o encerramento. Depois da última viagem ele precisa usar Encerrar meu dia.',
      'Jornada aberta não entra no resumo nem no consolidado. Sair do aplicativo ou registrar uma folga não fecha a jornada.',
    ],
  },
  {
    chave: 'corridas',
    titulo: 'Conferir as viagens',
    passos: [
      'Filtre a data, o motorista e o status. Uma corrida Em andamento já foi registrada, mas ainda precisa ser encerrada para ter os totais finais.',
      'Abra a corrida para consultar a rota, as paradas, os horários, os passageiros e o odômetro.',
      'A quilometragem vem do painel da van. Falta de posição GPS não significa que a corrida deixou de ser registrada.',
      'Se houver um erro, confira o registro com o motorista e use a correção disponível com um motivo. Evite criar outra corrida para substituir a que já existe.',
    ],
  },
  {
    chave: 'escala',
    titulo: 'Escala e folgas',
    passos: [
      'Escolha a data e confira qual motorista está previsto para cada van. A escala sugere a van ao iniciar o dia; uma troca pode gerar divergência, mas não impede o registro.',
      'Registre a folga pontual em Folgas do dia. Quem está de folga não será cobrado por falta de registro naquela data, mesmo se continuar na escala.',
      'Folga não encerra jornadas já abertas. Antes de remover uma folga, confira se o motorista realmente deveria trabalhar naquele dia.',
      'Ao repetir uma escala, confira o período e as folgas de cada data. Só motoristas ativos escalados e sem folga entram na cobrança por falta de registro.',
    ],
  },
  {
    chave: 'pendencias',
    titulo: 'Resolver pendências',
    passos: [
      'Escolha a data. Dias não encerrados são registros incompletos; Sem registro são motoristas ativos escalados e sem folga que não abriram uma jornada naquela data.',
      'Antes de cobrar, confira Escala, Folgas do dia e Situação dos motoristas. Uma dificuldade de acesso pede suporte para entrar.',
      'Para um dia aberto, peça que o motorista confira e encerre a corrida atual e depois encerre o dia. Veja também se a jornada pertence a uma data anterior.',
      'Confira Cobranças deste dia e a fila de notificações. Na instalação com canal de link, a pessoa responsável ainda precisa abrir e enviar a mensagem preparada.',
    ],
  },
  {
    chave: 'relatorios',
    titulo: 'Resumo e relatórios',
    passos: [
      'Em Resumo do dia, escolha a data e o motorista para conferir a ficha das viagens. Use as setas ou o calendário para consultar dias anteriores.',
      'Use Imprimir relatório para imprimir a ficha ou salvar em PDF. Exportar para Excel respeita a data e o motorista escolhidos.',
      'Dias em andamento mostram as viagens já registradas, mas só jornadas encerradas entram nos totais finais.',
      'Confira os detalhes da jornada ou corrida antes de corrigir um número. A quilometragem é calculada pelo odômetro.',
      'Ao exportar, aguarde a geração e use o botão de download quando disponível. Confira a data e os filtros no arquivo.',
    ],
  },
  {
    chave: 'fechamento',
    titulo: 'Fechar o mês',
    passos: [
      'Escolha o período (do dia 16 ao dia 15) e resolva os avisos em amarelo antes de gerar: vans sem contrato, dias ainda abertos e horários a conferir.',
      'Confira os feriados do período. Feriado conta como dia extra no boletim e usa a saída das 17h na hora extra.',
      'Toque em Gerar planilhas e confira a aba Pendências do boletim antes de enviar ao cliente. A hora extra do boletim pode ser ajustada na própria planilha.',
      'No dia 16 o sistema gera sozinho as planilhas do período que terminou e avisa a administração. Gerar de novo depois de uma correção cria arquivos novos, sem apagar os anteriores.',
    ],
  },
  {
    chave: 'configuracoes',
    titulo: 'Ajustar prazos e horários',
    passos: [
      'Leia a explicação de cada campo e confira o valor atual antes de alterar. Salve apenas depois de conferir os novos valores.',
      'Horários de consolidado e alerta de pendência precisam do reinício do agendador para valer. Encaminhe essa etapa ao responsável técnico.',
      'Ajustar o horário de cobrança não corrige cadastros, escalas ou folgas. Confira esses dados quando a cobrança parecer indevida.',
      'As alterações ficam registradas na auditoria. Depois de salvar, confira a mensagem de confirmação.',
    ],
  },
] as const;

export function ajudaAdminParaCaminho(caminho: string) {
  const primeiroTrecho = caminho.split('/')[2];
  const chave =
    primeiroTrecho === 'resumo'
      ? 'relatorios'
      : primeiroTrecho === 'preparacao'
        ? 'escala'
        : primeiroTrecho === 'feriados'
          ? 'fechamento'
          : primeiroTrecho;
  return (
    AJUDAS_DA_ADMINISTRACAO.find((ajuda) => ajuda.chave === chave) ?? AJUDAS_DA_ADMINISTRACAO[0]
  );
}

export const ROTINA_DIARIA_DA_ADMINISTRACAO = [
  {
    titulo: 'Antes das saídas',
    passos: [
      { texto: 'Confira os motoristas e as vans previstos para a data.', href: '/admin/escala' },
      { texto: 'Registre as folgas e confira o checklist da operação.', href: '/admin/preparacao' },
      {
        texto: 'Resolva senhas vencidas e dificuldades de acesso antes da primeira viagem.',
        href: '/admin/motoristas',
      },
    ],
  },
  {
    titulo: 'Durante o dia',
    passos: [
      { texto: 'Confira as jornadas abertas, as viagens e as ocorrências.', href: '/admin' },
      {
        texto:
          'Acompanhe a primeira utilização de cada motorista: iniciar o dia, registrar uma viagem e conferir a confirmação.',
        href: '/admin/motoristas',
      },
      {
        texto: 'Antes de cobrar falta de registro, confira a escala, a folga e o acesso.',
        href: '/admin/pendencias',
      },
    ],
  },
  {
    titulo: 'Depois da última viagem',
    passos: [
      {
        texto: 'Confira os dias que ficaram abertos e peça o fechamento após encerrar as corridas.',
        href: '/admin/pendencias',
      },
      {
        texto: 'Confira o resumo do dia e investigue números que diferem do esperado.',
        href: '/admin/resumo',
      },
      {
        texto: 'Confira na fila se as mensagens preparadas chegaram a ser enviadas.',
        href: '/admin/notificacoes',
      },
    ],
  },
] as const;

export const ROTEIRO_TREINAMENTO_ADMINISTRACAO = [
  {
    tempo: '0–3 minutos',
    titulo: 'Acesso e suporte',
    passos: [
      'Abra Situação dos motoristas e mostre a diferença entre acesso e registro de trabalho.',
      'Mostre onde conferir uma senha vencida ou um bloqueio temporário. Explique a redefinição sem gerar uma senha apenas para treinar.',
    ],
  },
  {
    tempo: '3–6 minutos',
    titulo: 'Quem deveria trabalhar',
    passos: [
      'Abra Escala, selecione a data e confira a van e o motorista previstos.',
      'Mostre Folgas do dia e explique que uma folga evita a cobrança por falta de registro naquela data, mas não fecha um dia aberto.',
    ],
  },
  {
    tempo: '6–10 minutos',
    titulo: 'Acompanhar uma jornada',
    passos: [
      'Abra uma jornada existente e confira as corridas. Mostre a diferença entre Em andamento e Encerrada.',
      'No celular do motorista, peça que abra Aprender para praticar a demonstração sem criar registros. Em outro momento, acompanhe a primeira utilização real, com a van parada.',
    ],
  },
  {
    tempo: '10–13 minutos',
    titulo: 'Conferência e fechamento',
    passos: [
      'Abra Pendências e confira a data. Separe quem não abriu o dia de quem precisa encerrá-lo.',
      'Abra o resumo e explique por que uma jornada aberta ainda não entrou nos totais. Confira a fila de notificações quando houver cobranças.',
    ],
  },
  {
    tempo: '13–15 minutos',
    titulo: 'Praticar e combinar a rotina',
    passos: [
      'Peça à pessoa que encontre sozinha a situação de um motorista e a jornada de uma data.',
      'Combine quem fará a conferência antes das saídas e após a última viagem. Use a rotina diária abaixo nos primeiros dias.',
    ],
  },
] as const;
