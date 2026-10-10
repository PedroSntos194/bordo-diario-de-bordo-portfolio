/**
 * Texto do aviso de privacidade (RF042 · US043).
 *
 * ⚠️ **V-09 — Necessário validar com o cliente.** Este é um rascunho técnico,
 * escrito a partir do que o sistema efetivamente coleta. Ele **não substitui
 * revisão jurídica**: monitorar a localização de empregados exige base legal
 * definida, transparência prévia e, preferencialmente, previsão em política
 * interna e no contrato de trabalho. O texto abaixo descreve com honestidade o
 * comportamento do sistema; a assessoria jurídica do cliente precisa aprová-lo
 * antes do go-live.
 *
 * Alterar o texto exige **subir a versão** — nova versão obriga novo aceite de
 * todos os usuários (RF042).
 */

export const VERSAO_AVISO_PRIVACIDADE = '1.1';

export interface SecaoDoAviso {
  titulo: string;
  paragrafos: string[];
}

export const AVISO_PRIVACIDADE: SecaoDoAviso[] = [
  {
    titulo: 'Por que este aviso existe',
    paragrafos: [
      'O Bordo é o sistema de diário de bordo das vans. Para funcionar, ele registra informações sobre você e sobre o seu trabalho. Esta página explica quais são, por que são coletadas e por quanto tempo ficam guardadas.',
      'Você precisa ler e aceitar antes de usar o sistema pela primeira vez.',
    ],
  },
  {
    titulo: 'Quais dados são coletados',
    paragrafos: [
      'Dados de cadastro: nome, CPF, telefone, matrícula e, para motoristas, número, categoria e validade da CNH.',
      'Dados de operação: jornadas abertas e encerradas, veículo utilizado, rotas percorridas, horários, quilometragem, quantidade de passageiros e ocorrências registradas.',
      'Dados de localização: a posição do aparelho no início da corrida, nas paradas registradas e no encerramento. A coleta acontece apenas nesses momentos e somente com uma jornada aberta — o sistema não acompanha sua posição de forma contínua nem fora do horário de trabalho.',
      'Dados de acesso: data e hora de entrada e saída do sistema, endereço de rede e alterações que você fizer em registros.',
    ],
  },
  {
    titulo: 'Para que servem',
    paragrafos: [
      'Controle operacional da frota: saber quais rotas foram feitas, por quem, em qual veículo, em que horário e com qual quilometragem.',
      'Geração dos relatórios e planilhas entregues à administração.',
      'Rastreabilidade: registrar quem alterou cada informação, quando e qual era o valor anterior.',
      'Os dados não são usados para qualquer outra finalidade, nem vendidos ou compartilhados com terceiros.',
    ],
  },
  {
    titulo: 'Se você recusar a localização',
    paragrafos: [
      'Você pode negar a permissão de localização no seu aparelho. O sistema continua funcionando: a corrida é registrada normalmente e marcada como "sem localização". Nenhum registro é bloqueado por falta de GPS.',
    ],
  },
  {
    titulo: 'Quem pode ver',
    paragrafos: [
      'Você tem acesso a todos os seus próprios registros e pode exportá-los.',
      'Os administradores do sistema têm acesso aos registros de toda a operação.',
      'Nenhum outro motorista tem acesso aos seus dados.',
    ],
  },
  {
    titulo: 'Por quanto tempo ficam guardados',
    paragrafos: [
      'Pontos de localização: 12 meses, após os quais são eliminados automaticamente.',
      'Diário de bordo, relatórios e trilha de alterações: 5 anos.',
      'Registros técnicos de acesso: 6 meses.',
    ],
  },
  {
    titulo: 'Seus direitos',
    paragrafos: [
      'Você pode consultar seus dados a qualquer momento pelo próprio sistema e solicitar correção de qualquer informação incorreta ao administrador. Toda correção fica registrada, com autor e data.',
      'Este aviso fica sempre acessível no seu perfil.',
    ],
  },
];
