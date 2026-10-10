export const AJUDAS_DO_MOTORISTA = [
  {
    chave: 'dia',
    titulo: 'Sua rotina do dia',
    passos: [
      'Entre com seu CPF e sua senha. Use o celular com a van parada.',
      'Abra o dia uma vez. Em cada viagem, inicie a corrida, marque as paradas e encerre a corrida.',
      'Depois da última viagem, toque em Encerrar meu dia e espere aparecer Dia encerrado. Sair do aplicativo não fecha o dia.',
      'Use Histórico para abrir uma viagem concluída, consultar outro dia ou baixar seu resumo.',
    ],
  },
  {
    chave: 'abrir',
    titulo: 'Iniciar meu dia',
    passos: [
      'Confira a placa da van que você vai dirigir. A van marcada na escala é uma sugestão: confira antes de continuar.',
      'Digite a quilometragem total do painel. Se ele mostra 125.430 km, digite 125430.',
      'Toque em Iniciar meu dia. Confira a placa e espere aparecer Dia em andamento.',
      'Se não houver uma van disponível, peça à administração para conferir o cadastro, o status e se existe outro dia aberto com ela.',
    ],
  },
  {
    chave: 'iniciar',
    titulo: 'Iniciar uma corrida',
    passos: [
      'Escolha a rota que vai fazer e confira a origem e o destino.',
      'Se ela não estiver na lista, toque em A rota de hoje não está na lista. Informe de onde saiu e para onde vai.',
      'Toque em Iniciar corrida e espere aparecer Em andamento. Permita a localização se o celular perguntar.',
      'Só é possível ter uma corrida em andamento. Encerre a atual antes de começar outra.',
      'A corrida em andamento já está registrada. Os totais de Meu dia contam apenas corridas encerradas, com quilômetros calculados pelo odômetro do painel.',
    ],
  },
  {
    chave: 'corrida',
    titulo: 'Paradas e fim da viagem',
    passos: [
      'Na parte Paradas, toque em Cheguei no ponto correto ao chegar. Toque em Saí quando esse botão aparecer e você sair do local.',
      'Para corrigir o último toque, use Desfazer enquanto estiver disponível.',
      'Ao terminar a viagem, toque em Encerrar corrida. Informe a quilometragem total do painel e a quantidade real de passageiros.',
      'Uma viagem concluída pode ser aberta pelo Histórico. Se Corrigir esta corrida aparecer, ajuste os dados e explique o motivo.',
    ],
  },
  {
    chave: 'encerrar',
    titulo: 'Encerrar a corrida',
    passos: [
      'Leia o painel da van agora e digite o número total, sem pontos. Exemplo: 125.462 km → 125462.',
      'Informe os passageiros transportados conforme a orientação da empresa. Escreva uma observação se precisar.',
      'Toque em Encerrar corrida. Se aparecer uma confirmação, confira os dados antes de confirmar.',
      'Espere voltar a Meu dia. A viagem deve aparecer em Corridas de hoje.',
    ],
  },
  {
    chave: 'fechar',
    titulo: 'Fechar o dia de trabalho',
    passos: [
      'Encerre a última corrida antes de fechar o dia.',
      'Confira as viagens registradas e digite a quilometragem total do painel ao terminar o trabalho.',
      'Toque em Encerrar meu dia, confira os totais e confirme. Espere aparecer Dia encerrado.',
      'Se a empresa pedir, envie o resumo pelo WhatsApp. Volte e toque em Já enviei somente depois de enviar a mensagem.',
    ],
  },
  {
    chave: 'abastecimento',
    titulo: 'Registrar abastecimento',
    passos: [
      'Com o dia aberto, confira a van e informe a quilometragem total do painel.',
      'Escolha o combustível e copie a quantidade da bomba. Para GNV, a unidade é m³.',
      'Responda Encheu o tanque?: Sim se completou o tanque, ou Não se abasteceu apenas parte.',
      'Valor pago e posto são opcionais. Toque em Registrar abastecimento e confira Abastecimento registrado.',
    ],
  },
  {
    chave: 'ocorrencia',
    titulo: 'Registrar uma ocorrência',
    passos: [
      'Escolha o tipo de problema. Descreva o que aconteceu e onde, com uma frase completa.',
      'Toque em Registrar ocorrência e espere a confirmação. O relato fica disponível à administração.',
      'Se precisar de ajuda imediata, avise a administração pelo canal habitual também.',
    ],
  },
  {
    chave: 'offline',
    titulo: 'Quando faltar internet',
    passos: [
      'Abra o aplicativo com internet antes de sair, no mesmo celular que você vai usar durante o dia.',
      'Use Modo sem conexão. Registre a tarefa e toque no botão Guardar correspondente.',
      'Os registros ficam no aparelho. Quando o sinal voltar, aguarde o envio ou toque em Enviar agora e confira Sincronizado.',
      'Se aparecer um conflito, leia o aviso e peça ajuda. Não descarte registros nem limpe os dados do aplicativo antes de enviar.',
      'Abastecimentos e ocorrências precisam de internet para serem registrados.',
    ],
  },
  {
    chave: 'localizacao',
    titulo: 'Localização desligada ou recusada',
    passos: [
      'Para guardar a posição, ative a localização do celular e permita o acesso quando o aplicativo perguntar. Sem GPS, a corrida continua sendo registrada.',
      'Se já recusou no Android, abra o mesmo endereço do aplicativo no Chrome. Toque no ícone à esquerda do endereço, em Permissões e em Localização para permitir. Confira também a permissão de localização do Chrome nas configurações do celular.',
      'No iPhone, confira os Serviços de Localização e o acesso do Safari nas configurações do celular. Abra o mesmo endereço no Safari e permita a localização nas configurações do site.',
      'Depois de permitir, volte à corrida. A posição será tentada nas próximas paradas e no encerramento; a posição que faltou no início não pode ser recuperada.',
      'O aplicativo registra posições no início, nas paradas e no fim da corrida. A quilometragem vem do odômetro, sem depender do GPS.',
    ],
  },
  {
    chave: 'acesso',
    titulo: 'Não consigo entrar no aplicativo',
    passos: [
      'Confira a internet, feche e abra o aplicativo novamente. Se o ícone não abrir, tente o mesmo endereço no navegador que usou para instalar.',
      'Se a sessão terminou, entre novamente com seu CPF e sua senha. Recusar a localização não impede o acesso.',
      'Se aparece Corrida em andamento, você já está no aplicativo e a viagem foi registrada. Se ela terminou, toque em Ver corrida e em Encerrar corrida antes de iniciar outra.',
      'Não desinstale nem limpe os dados antes de conferir os registros pendentes de envio. Registros feitos sem conexão podem estar somente neste aparelho.',
      'Se continuar sem acesso, informe à administração o texto da mensagem ou envie uma foto da tela. Se esqueceu a senha, peça uma senha temporária.',
    ],
  },
  {
    chave: 'historico',
    titulo: 'Histórico e correções',
    passos: [
      'Escolha a data no Histórico para consultar as viagens daquele dia.',
      'Toque em uma viagem para abrir os detalhes. Se estiver dentro do prazo, use Corrigir esta corrida e explique o motivo.',
      'Use Ver resumo e baixar planilha para abrir o resumo. Toque em Exportar para Excel e, se aparecer, em Baixar.',
      'Se o prazo para corrigir já passou ou o erro está no fechamento do dia, procure a administração.',
    ],
  },
] as const;

export function ajudaParaCaminho(caminho: string) {
  const chave = caminho.startsWith('/app/jornada/abrir')
    ? 'abrir'
    : caminho.startsWith('/app/jornada/encerrar')
      ? 'fechar'
      : caminho.startsWith('/app/corrida/iniciar')
        ? 'iniciar'
        : /\/corrida\/[^/]+\/encerrar/.test(caminho)
          ? 'encerrar'
          : caminho.startsWith('/app/corrida/')
            ? 'corrida'
            : caminho.startsWith('/app/abastecimento')
              ? 'abastecimento'
              : caminho.startsWith('/app/ocorrencia')
                ? 'ocorrencia'
                : caminho.startsWith('/app/sem-conexao') ||
                    caminho.startsWith('/app/pendencias-de-envio')
                  ? 'offline'
                  : caminho.startsWith('/app/historico') || caminho.startsWith('/app/resumo/')
                    ? 'historico'
                    : 'dia';
  return AJUDAS_DO_MOTORISTA.find((ajuda) => ajuda.chave === chave)!;
}
