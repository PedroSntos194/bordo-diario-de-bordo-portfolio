# 07 · Backlog do produto

Hierarquia: **Épico → Feature → User Story → Critérios de aceitação**
Complexidade em **Story Points** (1, 2, 3, 5, 8, 13) · Prioridade **MoSCoW** (Must / Should / Could)

| Épico | Features | Stories | Pontos |
|---|---|---|---|
| E1 · Acesso e usuários | 3 | US001–US010 | 40 |
| E2 · Cadastros base | 3 | US011–US015 | 31 |
| E3 · Operação do motorista | 4 | US016–US025 | 63 |
| E4 · Painel e acompanhamento | 2 | US026–US029 | 26 |
| E5 · Relatórios e planilhas | 2 | US030–US035 | 35 |
| E6 · Notificações | 2 | US036–US038 | 18 |
| E7 · Auditoria e administração | 2 | US039–US042 | 21 |
| E8 · Qualidade e conformidade | 2 | US043–US046 | 26 |
| **Total** | **20** | **46 stories** | **260 pontos** |

---

# Épico E1 — Acesso e usuários

**Objetivo:** garantir que apenas pessoas autorizadas entrem no sistema, cada uma com o alcance
correto, e que o administrador consiga administrar esse acesso sozinho.

## Feature E1.F1 — Autenticação

### US001 — Entrar no sistema com CPF e senha
> Como **motorista ou administrador**,
> quero entrar no sistema informando meu CPF e minha senha,
> para acessar as funcionalidades do meu perfil.

- **ID:** US001 · **Prioridade:** Must · **Complexidade:** 5
- **Dependências:** US006 (usuário existente), Sprint 0 concluída
- **Requisitos:** RF001, RF041 · **Regras:** RN001, RN002, RN003, RN006, RN007

**Critérios de aceitação**
- Dado um usuário ativo com credenciais corretas, quando informar CPF e senha e confirmar, então é
  autenticado e redirecionado conforme o perfil (Motorista → tela do dia; Administrador → dashboard).
- Dado um CPF digitado com máscara (`123.456.789-00`), quando enviar, então o sistema normaliza para
  dígitos e autentica normalmente.
- Dado um CPF ou senha incorretos, quando enviar, então é exibida a mensagem genérica
  "CPF ou senha inválidos" — sem indicar qual dos dois está errado.
- Dado 5 erros consecutivos, quando errar a 5ª vez, então a conta é bloqueada por 15 minutos e a
  mensagem informa o tempo restante.
- Dado um usuário com status Inativo ou Bloqueado, quando informar credenciais corretas, então o
  acesso é negado com mensagem orientando procurar o administrador.
- Dado um CPF estruturalmente inválido, quando enviar, então o erro é exibido no campo antes da
  chamada ao servidor.
- Campos obrigatórios: CPF e senha. Botão de envio desabilitado enquanto vazios; estado de
  carregamento durante a chamada.

### US002 — Trocar a senha no primeiro acesso
> Como **usuário com senha temporária**,
> quero ser obrigado a definir uma nova senha,
> para que ninguém além de mim conheça minha credencial.

- **ID:** US002 · **Prioridade:** Must · **Complexidade:** 3
- **Dependências:** US001 · **Requisitos:** RF003 · **Regras:** RN004, RN005

**Critérios de aceitação**
- Dado um usuário com o indicador "deve trocar senha", quando autenticar, então é levado à tela de
  troca e **nenhuma outra rota** fica acessível até concluir.
- A nova senha deve ter no mínimo 8 caracteres com letra e número; o requisito é exibido antes do erro.
- A nova senha não pode ser igual ao CPF, à matrícula nem à senha anterior.
- É exigida a confirmação da nova senha, com validação de igualdade.
- Concluída a troca, o indicador é removido, o usuário segue para a tela inicial e a ação é auditada.
- Dado uma senha temporária com mais de 72 horas, quando autenticar, então o acesso é negado com
  orientação para solicitar nova senha ao administrador.

### US003 — Sair do sistema e expirar sessão inativa
> Como **usuário**,
> quero encerrar minha sessão e ter a sessão expirada automaticamente,
> para proteger meus dados em dispositivos compartilhados.

- **ID:** US003 · **Prioridade:** Must · **Complexidade:** 2
- **Dependências:** US001 · **Requisitos:** RF008 · **Regras:** RN007

**Critérios de aceitação**
- Existe ação "Sair" visível em todas as telas autenticadas.
- Após sair, o cookie de sessão é invalidado no servidor e o retorno pelo botão "voltar" do
  navegador não restaura o acesso.
- Sessão expirada redireciona para o login com aviso "Sua sessão expirou" e preserva o destino
  pretendido para retorno após novo login.
- Alteração de status do usuário para Inativo/Bloqueado invalida as sessões ativas dele.

## Feature E1.F2 — Gestão de usuários

### US004 — Cadastrar usuário
> Como **administrador**,
> quero cadastrar um novo usuário,
> para liberar o acesso de um novo motorista ou administrador.

- **ID:** US004 · **Prioridade:** Must · **Complexidade:** 5
- **Dependências:** US001, US010 · **Requisitos:** RF004 · **Regras:** RN002, RN004, RN005, RN026

**Critérios de aceitação**
- Campos obrigatórios: nome completo, CPF, telefone (WhatsApp), perfil e status.
- Campos opcionais: matrícula, e-mail, CNH, categoria e validade da CNH (exibidos apenas para perfil Motorista).
- Dado um CPF já cadastrado em usuário ativo, quando salvar, então o sistema recusa com
  "Já existe um usuário ativo com este CPF" e destaca o campo.
- Ao salvar, o sistema gera senha temporária e a exibe **uma única vez** ao administrador, com
  ação de copiar.
- O usuário criado nasce com o indicador "deve trocar senha".
- A criação gera registro de auditoria com autor e valores.
- Dado um telefone fora do formato brasileiro, quando salvar, então o campo é rejeitado com exemplo do formato aceito.

### US005 — Editar usuário
> Como **administrador**, quero editar os dados de um usuário, para manter o cadastro correto.

- **ID:** US005 · **Prioridade:** Must · **Complexidade:** 3
- **Dependências:** US004 · **Requisitos:** RF005 · **Regras:** RN002, RN011, RN026

**Critérios de aceitação**
- Todos os campos do cadastro são editáveis, exceto o CPF quando o usuário já possuir jornadas registradas.
- O administrador não pode alterar o próprio perfil de acesso.
- A auditoria registra apenas os campos efetivamente alterados, com valor anterior e novo.
- Sair da tela com alterações não salvas exibe confirmação de descarte.

### US006 — Bloquear, desativar e excluir usuário
> Como **administrador**, quero bloquear, desativar ou excluir um usuário, para impedir o acesso de
> quem não faz mais parte da operação.

- **ID:** US006 · **Prioridade:** Must · **Complexidade:** 5
- **Dependências:** US004 · **Requisitos:** RF006, RF024 · **Regras:** RN006, RN010, RN011, RN024, RN026

**Critérios de aceitação**
- As três ações exigem confirmação em modal com o nome do usuário e a consequência descrita.
- A exclusão é **lógica**: o usuário some das listagens padrão, mas os registros históricos
  continuam exibindo o nome dele.
- Dado o último administrador ativo, quando tentar excluir/desativar/rebaixar, então a ação é
  bloqueada com mensagem explicativa.
- Nenhum usuário pode executar essas ações sobre a própria conta.
- Após a mudança de status, as sessões ativas do usuário são encerradas.
- Cada ação gera registro de auditoria.

### US007 — Listar e filtrar usuários
> Como **administrador**, quero pesquisar e filtrar usuários, para encontrar rapidamente uma pessoa.

- **ID:** US007 · **Prioridade:** Must · **Complexidade:** 3
- **Dependências:** US004 · **Requisitos:** RF007, RF043 · **Regras:** RN029

**Critérios de aceitação**
- Busca por nome, CPF ou matrícula, com no mínimo 2 caracteres e resposta sem recarregar a página.
- Filtros por perfil e status; combinação de filtros funciona em conjunto.
- Paginação de 20 itens com indicação do total encontrado.
- Estado vazio distingue "nenhum usuário cadastrado" de "nenhum resultado para este filtro",
  oferecendo limpar filtros no segundo caso.
- CPF exibido mascarado na listagem.
- Os filtros aplicados são refletidos na URL.

### US008 — Redefinir a senha de um usuário
> Como **administrador**, quero gerar uma nova senha temporária, para destravar quem esqueceu a senha.

- **ID:** US008 · **Prioridade:** Must · **Complexidade:** 3
- **Dependências:** US004, US002 · **Requisitos:** RF002 · **Regras:** RN004, RN005, RN026

**Critérios de aceitação**
- A ação exige confirmação e informa que a senha atual deixará de funcionar.
- A senha temporária é exibida uma única vez, com botão de copiar, e nunca é recuperável depois.
- O usuário passa a ter o indicador "deve trocar senha" e suas sessões ativas são encerradas.
- A ação é auditada sem registrar o valor da senha.

## Feature E1.F3 — Perfil e autorização

### US009 — Ver meu perfil e trocar minha senha
> Como **usuário**, quero ver meus dados e alterar minha senha, para manter minha conta segura.

- **ID:** US009 · **Prioridade:** Must · **Complexidade:** 3
- **Dependências:** US001 · **Requisitos:** RF009 · **Regras:** RN004

**Critérios de aceitação**
- A tela exibe nome, CPF mascarado, perfil, telefone e data do último acesso.
- A troca de senha exige a senha atual; senha atual incorreta retorna erro específico no campo.
- Regras de senha (RN004) aplicadas e explicadas antes do envio.
- Após a troca, as demais sessões do usuário são encerradas e a atual é mantida.

### US010 — Restringir acesso por perfil
> Como **empresa**, quero que cada perfil só acesse o que lhe compete, para proteger os dados da operação.

- **ID:** US010 · **Prioridade:** Must · **Complexidade:** 8
- **Dependências:** US001 · **Requisitos:** RF041 · **Regras:** RN008, RN009

**Critérios de aceitação**
- Dado um motorista autenticado, quando acessar uma URL administrativa diretamente, então recebe
  403 e é redirecionado para a área permitida.
- Dado um motorista, quando solicitar uma jornada de outro motorista pela API, então recebe **404**
  (não 403), sem revelar a existência do registro.
- A verificação ocorre **no servidor**; ocultar o item de menu não é suficiente.
- Requisição sem sessão válida a qualquer rota protegida retorna 401.
- Existe teste automatizado cobrindo cada combinação perfil × rota protegida.

---

# Épico E2 — Cadastros base

**Objetivo:** ter veículos, rotas e paradas cadastrados para que o registro do motorista seja
seleção, não digitação.

## Feature E2.F1 — Veículos

### US011 — Gerenciar veículos ⚠️ *V-03*
> Como **administrador**, quero cadastrar e manter as vans, para vincular cada jornada a um veículo.

- **ID:** US011 · **Prioridade:** Must · **Complexidade:** 5
- **Dependências:** US010 · **Requisitos:** RF010 · **Regras:** RN013, RN020, RN024, RN026

**Critérios de aceitação**
- Campos: placa (obrigatória, única, formato antigo `AAA-1234` ou Mercosul `AAA1A23`), modelo,
  marca, ano, capacidade de passageiros, odômetro atual e status.
- Placa duplicada é recusada com mensagem específica.
- Veículo com jornadas registradas só pode ser **desativado**, nunca excluído.
- Desativar veículo em jornada aberta é bloqueado com mensagem indicando a jornada.
- Listagem com busca por placa/modelo e filtro por status.
- Todas as operações são auditadas.

## Feature E2.F2 — Rotas

### US012 — Gerenciar rotas
> Como **administrador**, quero cadastrar as rotas, para que o motorista apenas as selecione.

- **ID:** US012 · **Prioridade:** Must · **Complexidade:** 5
- **Dependências:** US010 · **Requisitos:** RF011 · **Regras:** RN021, RN024, RN026

**Critérios de aceitação**
- Campos: nome (obrigatório), código (único), origem, destino, turno (manhã/tarde/noite/integral),
  distância estimada em km e status.
- Rota já utilizada em corridas só pode ser desativada.
- Rota inativa não aparece na seleção de nova corrida, mas continua visível nos registros históricos.
- Listagem com busca por nome/código e filtros por turno e status.

### US013 — Definir os pontos de parada de uma rota
> Como **administrador**, quero definir os pontos de parada em ordem, para o motorista registrar
> chegada e saída em cada um com um toque.

- **ID:** US013 · **Prioridade:** Must · **Complexidade:** 8
- **Dependências:** US012 · **Requisitos:** RF012 · **Regras:** RN021, RN022

**Critérios de aceitação**
- É possível adicionar, editar, reordenar e remover pontos de parada.
- Cada ponto tem nome (obrigatório), endereço e coordenadas.
- As coordenadas podem ser preenchidas clicando no mapa ou buscando por endereço.
- A ordem é persistida e usada na tela do motorista.
- Rota sem pontos de parada é válida (corrida ponto a ponto).
- Remover um ponto já usado em corridas históricas mantém o histórico intacto.

## Feature E2.F3 — Escala

### US014 — Atribuir motorista, veículo e rota por data
> Como **administrador**, quero programar quem dirige o quê e por qual rota, para agilizar a abertura
> da jornada.

- **ID:** US014 · **Prioridade:** Could · **Complexidade:** 5
- **Dependências:** US011, US012, US016 · **Requisitos:** RF013 · **Regras:** RN013

**Critérios de aceitação**
- Ao abrir a jornada, o veículo e as rotas escalados vêm pré-selecionados.
- O motorista pode alterar a seleção pré-preenchida; a divergência é sinalizada ao administrador.
- Não é possível escalar o mesmo veículo para dois motoristas na mesma data e turno.

### US015 — Importar cadastros por planilha ⚠️ *V-10*
> Como **administrador**, quero importar usuários, veículos ou rotas de uma planilha, para fazer a
> carga inicial sem digitar 60 cadastros.

- **ID:** US015 · **Prioridade:** Should · **Complexidade:** 8
- **Dependências:** US004, US011, US012 · **Requisitos:** RF035 · **Regras:** RN031, RN032, RN026

**Critérios de aceitação**
- Existe download de modelo `.xlsx` por tipo de importação, com cabeçalhos fixos e uma linha de exemplo.
- Arquivo com cabeçalho divergente é rejeitado integralmente, sem gravar nada.
- Com estrutura válida, linhas corretas são importadas e as incorretas são listadas com número da
  linha e motivo do erro.
- É possível baixar o relatório de erros em `.xlsx` para correção e reenvio.
- Formatos aceitos: `.xlsx` e `.csv`; tamanho máximo 5 MB; demais tipos são recusados.
- A importação é auditada com o nome do arquivo e a quantidade de registros afetados.

---

# Épico E3 — Operação do motorista

**Objetivo:** substituir a folha de papel. É o épico que define o sucesso do produto.

## Feature E3.F1 — Jornada

### US016 — Abrir a jornada do dia
> Como **motorista**, quero abrir minha jornada informando a van e o odômetro,
> para começar a registrar o dia.

- **ID:** US016 · **Prioridade:** Must · **Complexidade:** 8
- **Dependências:** US001, US011 · **Requisitos:** RF014 · **Regras:** RN012, RN013, RN015, RN020

**Critérios de aceitação**
- Dado um motorista sem jornada no dia, quando abrir o sistema, então a tela inicial oferece
  "Iniciar meu dia" como ação principal.
- Campos: veículo (seleção, obrigatório) e odômetro inicial (numérico, obrigatório). Data e hora são
  automáticas e exibidas em modo leitura.
- Só veículos ativos e sem jornada em andamento aparecem na seleção.
- Dado odômetro menor que o último registrado do veículo, quando enviar, então é recusado com
  informação do último valor conhecido.
- Dado odômetro mais de 500 km acima do último, quando enviar, então é exigida confirmação adicional.
- Dado um motorista com jornada já aberta no dia, quando acessar, então o sistema abre a jornada
  existente em vez de criar outra.
- A tela deve ser concluída em no máximo 3 interações, com alvos de toque ≥ 44 px.

### US017 — Encerrar a jornada do dia
> Como **motorista**, quero encerrar meu dia, para consolidar tudo o que registrei.

- **ID:** US017 · **Prioridade:** Must · **Complexidade:** 5
- **Dependências:** US016, US019 · **Requisitos:** RF019, RF024 · **Regras:** RN014, RN017, RN018, RN024

**Critérios de aceitação**
- Dado uma corrida em andamento, quando tentar encerrar a jornada, então a ação é bloqueada com
  indicação de qual corrida está aberta e atalho para encerrá-la.
- O encerramento exige o odômetro final do dia, coerente com a última corrida.
- Antes de confirmar, é apresentado o resumo (corridas, km, tempo, passageiros) em modal de confirmação.
- Após encerrar, a jornada fica somente leitura para o motorista, ressalvada a janela de correção (US022).
- O encerramento dispara a geração do resumo do dia e a oferta de envio ao administrador.

## Feature E3.F2 — Corridas

### US018 — Iniciar uma corrida
> Como **motorista**, quero iniciar uma corrida escolhendo a rota, para registrar o trajeto que vou fazer.

- **ID:** US018 · **Prioridade:** Must · **Complexidade:** 8
- **Dependências:** US016, US012, US020 · **Requisitos:** RF015, RF016 · **Regras:** RN014, RN016, RN021, RN022

**Critérios de aceitação**
- A tela lista as rotas ativas com busca; as mais usadas pelo motorista aparecem no topo.
- É possível iniciar uma **corrida avulsa** informando origem e destino em texto livre.
- Ao confirmar, o sistema registra horário e captura a localização atual automaticamente.
- Dado uma corrida já em andamento, quando tentar iniciar outra, então a ação é bloqueada com
  atalho para a corrida aberta.
- Dado a jornada não aberta, quando tentar iniciar corrida, então o sistema conduz primeiro à abertura da jornada.
- A corrida iniciada aparece na tela inicial como cartão destacado, com tempo decorrido.

### US019 — Encerrar a corrida
> Como **motorista**, quero encerrar a corrida informando o odômetro, para registrar quanto rodei.

- **ID:** US019 · **Prioridade:** Must · **Complexidade:** 5
- **Dependências:** US018 · **Requisitos:** RF018, RF024 · **Regras:** RN016, RN018, RN020, RN024

**Critérios de aceitação**
- Campos: odômetro final (obrigatório), quantidade de passageiros (opcional) e observações (opcional).
- O sistema calcula e exibe o km percorrido e a duração antes da confirmação.
- Odômetro final menor que o inicial da corrida é recusado.
- Passageiros acima da capacidade do veículo exige confirmação explícita.
- O encerramento exige confirmação em modal e captura a localização final.
- Após encerrar, a corrida aparece na lista do dia com km, duração e horários.

### US020 — Capturar a localização automaticamente ⚠️ *V-06*
> Como **empresa**, quero que a localização seja capturada pelo aparelho, para saber por onde a van
> passou sem depender da anotação do motorista.

- **ID:** US020 · **Prioridade:** Must · **Complexidade:** 8
- **Dependências:** US018, US043 · **Requisitos:** RF016, RF042 · **Regras:** RN022, RN029

**Critérios de aceitação**
- A permissão de localização é solicitada com explicação antes do prompt do navegador.
- São capturados latitude, longitude, precisão e horário no início, em cada parada e no encerramento.
- Dado permissão negada, quando registrar, então a operação prossegue e o registro é marcado
  "sem localização", com aviso não bloqueante.
- Dado precisão pior que 100 m, quando capturar, então o ponto é salvo com indicação de baixa precisão.
- As coordenadas não podem ser editadas manualmente por nenhum perfil.
- A captura não pode travar a interface: tempo limite de 10 segundos, com prosseguimento automático.

### US021 — Registrar paradas e eventos da corrida
> Como **motorista**, quero marcar chegada e saída nos pontos, para registrar os destinos atendidos.

- **ID:** US021 · **Prioridade:** Should · **Complexidade:** 5
- **Dependências:** US018, US013 · **Requisitos:** RF017 · **Regras:** RN016, RN022

**Critérios de aceitação**
- Com rota cadastrada, os pontos aparecem em ordem e cada um se registra com um toque.
- Em corrida avulsa, é possível registrar parada informando um nome livre.
- Cada evento grava horário e localização.
- Eventos registrados aparecem em linha do tempo na tela da corrida.
- É possível desfazer o último evento registrado em até 2 minutos.

## Feature E3.F3 — Correções e ocorrências

### US022 — Corrigir um registro com justificativa ⚠️ *V-13*
> Como **motorista**, quero corrigir um erro no que registrei, para que os dados fiquem certos.

- **ID:** US022 · **Prioridade:** Should · **Complexidade:** 5
- **Dependências:** US019, US039 · **Requisitos:** RF023 · **Regras:** RN019, RN026, RN027

**Critérios de aceitação**
- Dentro da janela configurada (padrão 12 h), a corrida encerrada exibe a ação "Corrigir".
- A justificativa é obrigatória, com mínimo de 10 caracteres.
- Fora da janela, a ação não é exibida ao motorista e a tentativa via API retorna 403 com mensagem clara.
- O administrador pode corrigir a qualquer momento, também com justificativa.
- Cada correção gera registro de auditoria com valor anterior, valor novo e a justificativa.
- O registro corrigido exibe marcação visual de "editado" com data e autor.

### US023 — Registrar uma ocorrência
> Como **motorista**, quero registrar um problema no dia, para que a empresa fique sabendo.

- **ID:** US023 · **Prioridade:** Should · **Complexidade:** 3
- **Dependências:** US016 · **Requisitos:** RF020 · **Regras:** RN023

**Critérios de aceitação**
- Tipos: atraso, pane mecânica, acidente, desvio de rota, problema com passageiro, outro.
- Descrição obrigatória; horário e localização automáticos.
- A ocorrência pode ser vinculada à jornada ou a uma corrida específica.
- Ocorrências do dia aparecem no dashboard do administrador com destaque.
- A ocorrência não altera km, horários nem status da corrida.

### US024 — Registrar abastecimento
> Como **motorista**, quero registrar um abastecimento, para o controle de consumo da van.

- **ID:** US024 · **Prioridade:** Could · **Complexidade:** 3
- **Dependências:** US016 · **Requisitos:** RF021 · **Regras:** RN020

**Critérios de aceitação**
- Campos: data/hora, litros, valor total, odômetro, posto e tipo de combustível.
- Odômetro do abastecimento é validado contra o último registrado do veículo.
- Abastecimentos aparecem no relatório do veículo com consumo médio calculado.

## Feature E3.F4 — Continuidade em campo

### US025 — Registrar sem internet e sincronizar depois ⚠️ *V-08*
> Como **motorista em área sem sinal**, quero conseguir registrar mesmo assim,
> para não perder o registro nem voltar ao papel.

- **ID:** US025 · **Prioridade:** Should · **Complexidade:** 13
- **Dependências:** US016, US018, US019 · **Requisitos:** RF022, RF044 · **Regras:** RN025

**Critérios de aceitação**
- Sem conexão, abrir jornada, iniciar corrida, registrar parada e encerrar corrida continuam
  funcionando, com os dados armazenados localmente.
- Um indicador permanente mostra o estado: "Sincronizado" ou "N registros pendentes".
- Ao restabelecer a conexão, a sincronização ocorre automaticamente, em ordem cronológica.
- Cada registro criado offline carrega um identificador local único; reenvio do mesmo identificador
  não cria duplicidade.
- Conflito com o servidor (ex.: jornada já encerrada) é apresentado ao usuário com opção de resolução,
  nunca descartado silenciosamente.
- Registros pendentes sobrevivem ao fechamento do aplicativo e à reinicialização do aparelho.

---

# Épico E4 — Painel e acompanhamento

## Feature E4.F1 — Dashboard

### US026 — Acompanhar o dia no dashboard
> Como **administrador**, quero ver o panorama do dia ao entrar, para saber o que está acontecendo agora.

- **ID:** US026 · **Prioridade:** Must · **Complexidade:** 8
- **Dependências:** US016, US018 · **Requisitos:** RF028 · **Regras:** RN008

**Critérios de aceitação**
- Indicadores do dia: jornadas abertas, jornadas encerradas, corridas em andamento, corridas
  concluídas, km total, veículos em operação, ocorrências e motoristas sem registro.
- Lista das corridas em andamento com motorista, veículo, rota e tempo decorrido.
- Cada indicador é clicável e leva à listagem já filtrada correspondente.
- Estado vazio ("nenhuma operação registrada hoje") é tratado com texto próprio, não com zeros mudos.
- Os dados se atualizam ao recarregar; atualização automática a cada 60 segundos é desejável.
- Carregamento exibe *skeleton*, não tela em branco.

## Feature E4.F2 — Consultas

### US027 — Consultar jornadas e corridas com filtros
> Como **administrador**, quero pesquisar registros por data, motorista, veículo e rota,
> para encontrar o que preciso.

- **ID:** US027 · **Prioridade:** Must · **Complexidade:** 5
- **Dependências:** US016, US018 · **Requisitos:** RF029, RF043 · **Regras:** RN008, RN009

**Critérios de aceitação**
- Filtros: período (início e fim), motorista, veículo, rota e status; combináveis.
- Período padrão: dia atual. Período maior que 12 meses é recusado com aviso.
- Resultado paginado, ordenável por data, motorista ou km.
- Filtros refletidos na URL, permitindo compartilhar a consulta.
- Dado um motorista autenticado, quando acessar a consulta, então só enxerga os próprios registros.
- Estado vazio distingue "sem registros no período" de "nenhum resultado para os filtros".

### US028 — Ver o detalhe de uma jornada
> Como **administrador**, quero abrir uma jornada e ver tudo o que aconteceu, para conferir o dia.

- **ID:** US028 · **Prioridade:** Must · **Complexidade:** 5
- **Dependências:** US027 · **Requisitos:** RF029, RF030, RF039 · **Regras:** RN008, RN018

**Critérios de aceitação**
- Exibe cabeçalho (motorista, veículo, data, horários, odômetros, totais) e a lista de corridas.
- Cada corrida mostra rota, horários, km, passageiros, paradas e ocorrências.
- Aba/seção com o histórico de alterações do registro.
- Ações disponíveis: exportar em Excel, corrigir (com justificativa) e ver no mapa.
- Registros alterados exibem marcação "editado" com autor e data.

### US029 — Ver o trajeto no mapa
> Como **administrador**, quero ver no mapa por onde a van passou, para confirmar a rota realizada.

- **ID:** US029 · **Prioridade:** Should · **Complexidade:** 8
- **Dependências:** US020, US028 · **Requisitos:** RF034 · **Regras:** RN008, RN022, RN029

**Critérios de aceitação**
- O mapa exibe os pontos capturados na ordem cronológica, com numeração e ligação entre eles.
- Clicar num ponto mostra horário, tipo (início/parada/fim), precisão e endereço aproximado.
- Corrida sem pontos capturados exibe mensagem explicativa em vez de mapa vazio.
- O mapa é utilizável em tela de celular, sem travar a rolagem da página.
- Falha ao carregar o mapa não quebra a tela: o restante do detalhe continua acessível.

---

# Épico E5 — Relatórios e planilhas

## Feature E5.F1 — Resumo do dia

### US030 — Gerar o resumo do dia
> Como **administrador**, quero o resumo do dia consolidado, para saber o que a frota fez.

- **ID:** US030 · **Prioridade:** Must · **Complexidade:** 8
- **Dependências:** US017 · **Requisitos:** RF030 · **Regras:** RN017, RN018

**Critérios de aceitação**
- O resumo apresenta, por motorista: veículo, horário de início e fim, corridas, rotas percorridas,
  km total, passageiros e ocorrências.
- Apresenta também o consolidado do dia (totais da frota).
- Jornadas ainda abertas aparecem em seção separada de pendências, não no consolidado.
- É possível escolher a data do resumo, com padrão no dia atual.
- O motorista acessa apenas o próprio resumo.

### US031 — Relatórios por período e por dimensão
> Como **administrador**, quero relatórios por período, motorista, veículo ou rota, para analisar a operação.

- **ID:** US031 · **Prioridade:** Should · **Complexidade:** 8
- **Dependências:** US030 · **Requisitos:** RF031 · **Regras:** RN008

**Critérios de aceitação**
- Seleção de período e de agrupamento (motorista, veículo ou rota).
- Mostra total de corridas, km, tempo, passageiros e média por dia.
- Período sem dados exibe estado vazio explicativo.
- Relatório com mais de 5.000 linhas é processado em segundo plano, com aviso e notificação ao concluir.

## Feature E5.F2 — Excel

### US032 — Exportar em Excel
> Como **administrador**, quero exportar o que estou vendo para Excel, para trabalhar os dados fora do sistema.

- **ID:** US032 · **Prioridade:** Must · **Complexidade:** 5
- **Dependências:** US027, US030 · **Requisitos:** RF032 · **Regras:** RN008, RN030

**Critérios de aceitação**
- A exportação respeita exatamente os filtros aplicados na tela.
- O arquivo `.xlsx` abre no Excel sem aviso de formato inválido, com cabeçalho congelado, larguras
  ajustadas, datas como data e números como número.
- A primeira aba traz identificação: empresa, tipo de relatório, período, filtros e data/hora de geração.
- Nome do arquivo padronizado: `bordo_<relatorio>_<AAAA-MM-DD>.xlsx`.
- Exportação sem resultados é bloqueada com aviso.
- A exportação é auditada (quem exportou, o quê e quando).

### US033 — Gerar automaticamente a planilha do dia
> Como **empresa**, quero a planilha do dia gerada sozinha, para ninguém precisar lembrar de fazer isso.

- **ID:** US033 · **Prioridade:** Must · **Complexidade:** 8
- **Dependências:** US032, US042 · **Requisitos:** RF033 · **Regras:** RN030

**Critérios de aceitação**
- Em horário configurável (padrão 23h), o sistema gera a planilha consolidada do dia.
- O arquivo fica disponível no histórico, com data, parâmetros e link de download.
- Falha na geração é registrada e notificada ao administrador, com nova tentativa automática.
- Reexecução no mesmo dia gera um novo arquivo, sem sobrescrever o anterior.
- Dia sem movimentação gera planilha com aviso "sem registros", em vez de não gerar nada.

### US034 — Consultar o histórico de arquivos
> Como **administrador**, quero ver e baixar arquivos gerados anteriormente, para não precisar regerá-los.

- **ID:** US034 · **Prioridade:** Should · **Complexidade:** 3
- **Dependências:** US032, US033 · **Requisitos:** RF036 · **Regras:** RN030

**Critérios de aceitação**
- Lista com tipo, período, autor (ou "sistema"), data/hora e tamanho.
- Filtro por tipo e por período; paginação.
- Download registra auditoria.
- Arquivo expirado ou removido exibe mensagem em vez de link quebrado.

### US035 — Exportar meus registros (motorista)
> Como **motorista**, quero exportar meu próprio dia, para guardar comprovação do que registrei.

- **ID:** US035 · **Prioridade:** Should · **Complexidade:** 3
- **Dependências:** US032 · **Requisitos:** RF032 · **Regras:** RN009, RN029

**Critérios de aceitação**
- A exportação do motorista contém apenas registros dele.
- Tentativa de exportar período com registros de terceiros retorna somente os próprios dados.
- O arquivo tem o mesmo padrão visual da exportação administrativa.

---

# Épico E6 — Notificações

## Feature E6.F1 — WhatsApp

### US036 — Enviar o resumo do dia ao administrador pelo WhatsApp ⚠️ *V-05*
> Como **motorista**, quero enviar o resumo do meu dia ao administrador,
> para concluir meu processo como o cliente descreveu.

- **ID:** US036 · **Prioridade:** Must · **Complexidade:** 8
- **Dependências:** US017, US030, US033 · **Requisitos:** RF025 · **Regras:** RN017, RN028

**Critérios de aceitação**
- Ao encerrar a jornada, é oferecida a ação "Enviar resumo ao administrador".
- A mensagem contém data, motorista, veículo, corridas, km total, horários e link para a planilha.
- **Na abordagem (a) do V-05:** o sistema abre o WhatsApp com a mensagem pronta e o destinatário
  pré-selecionado; ao retornar, o motorista confirma o envio e o sistema registra a data/hora.
- **Na abordagem (b):** o envio ocorre automaticamente pelo servidor, sem ação do motorista.
- A interface de encerramento não muda entre as abordagens — a diferença fica isolada no serviço de envio.
- Falha ou recusa no envio não invalida o encerramento da jornada; fica registrada como pendente.

### US037 — Reenviar notificações que falharam
> Como **administrador**, quero reenviar o que não foi entregue, para não perder informação.

- **ID:** US037 · **Prioridade:** Should · **Complexidade:** 5
- **Dependências:** US036 · **Requisitos:** RF027 · **Regras:** RN028

**Critérios de aceitação**
- Tela lista as notificações com status (pendente, enviada, falha), destinatário, tentativa e erro.
- Reenvio manual disponível para itens com falha, com confirmação.
- Reenvio automático com no máximo 3 tentativas e intervalo crescente.
- Após 3 falhas, o item é marcado como "requer atenção" e sinalizado no dashboard.

## Feature E6.F2 — Cobrança de registro

### US038 — Alertar jornadas não encerradas e motoristas sem registro
> Como **empresa**, quero que o sistema cobre quem não registrou, para atacar a causa do problema.

- **ID:** US038 · **Prioridade:** Should · **Complexidade:** 5
- **Dependências:** US017, US042 · **Requisitos:** RF026 · **Regras:** RN012, RN028

**Critérios de aceitação**
- Em horário configurável, o sistema identifica jornadas abertas e motoristas ativos sem jornada no dia.
- O motorista recebe notificação; o administrador recebe a lista consolidada.
- As pendências aparecem no dashboard e na consulta com filtro próprio.
- Motorista de férias/afastado (status Inativo) não é cobrado.
- A rotina não dispara duas vezes para o mesmo dia.

---

# Épico E7 — Auditoria e administração

## Feature E7.F1 — Trilha de auditoria

### US039 — Registrar automaticamente quem alterou o quê
> Como **administrador**, quero saber quem alterou determinado dado, quando alterou e qual era o valor
> anterior, para ter rastreabilidade — exatamente como solicitado no levantamento.

- **ID:** US039 · **Prioridade:** Must · **Complexidade:** 8
- **Dependências:** US010 · **Requisitos:** RF037 · **Regras:** RN026, RN027

**Critérios de aceitação**
- Toda criação, alteração, exclusão, login, logout, exportação e importação gera registro de auditoria.
- O registro contém: usuário, data/hora, ação, entidade, identificador, valor anterior, valor novo e IP.
- Campos sensíveis (hash de senha, token) nunca são gravados na auditoria.
- Nenhum perfil pode editar ou excluir registros de auditoria — inclusive por API.
- A gravação da auditoria não pode impedir a operação principal em caso de falha, mas deve ser
  registrada como erro crítico.

### US040 — Consultar os logs de atividade
> Como **administrador**, quero consultar o histórico de atividades, para investigar o que aconteceu.

- **ID:** US040 · **Prioridade:** Should · **Complexidade:** 5
- **Dependências:** US039 · **Requisitos:** RF038 · **Regras:** RN027

**Critérios de aceitação**
- Filtros por usuário, período, ação e entidade; período padrão de 7 dias.
- Cada linha permite abrir o detalhe com a comparação "antes × depois".
- A consulta é paginada e exportável em Excel.
- A própria consulta de logs é auditada.

### US041 — Ver o histórico de alterações de um registro
> Como **administrador**, quero ver a linha do tempo de um registro específico, para entender sua evolução.

- **ID:** US041 · **Prioridade:** Should · **Complexidade:** 3
- **Dependências:** US039 · **Requisitos:** RF039 · **Regras:** RN026

**Critérios de aceitação**
- Jornada, corrida, usuário, veículo e rota exibem seu histórico próprio.
- Cada entrada mostra autor, data/hora, campos alterados e a justificativa quando houver.
- Registro nunca alterado exibe "nenhuma alteração desde a criação".

## Feature E7.F2 — Configuração

### US042 — Configurar parâmetros do sistema
> Como **administrador**, quero ajustar prazos e horários, para adaptar o sistema à rotina da empresa.

- **ID:** US042 · **Prioridade:** Should · **Complexidade:** 5
- **Dependências:** US010 · **Requisitos:** RF040 · **Regras:** RN019, RN026

**Critérios de aceitação**
- Parâmetros: janela de edição do motorista (horas), horário de geração do consolidado, horário do
  alerta de pendências, destinatários do resumo e tolerância de divergência de odômetro.
- Valores fora de faixa válida são recusados com explicação.
- Alterações entram em vigor sem necessidade de reiniciar o sistema e são auditadas.

---

# Épico E8 — Qualidade, conformidade e entrega

## Feature E8.F1 — Conformidade

### US043 — Aceitar o aviso de privacidade ⚠️ *V-09*
> Como **usuário**, quero saber quais dados meus são coletados, para dar meu aceite de forma informada.

- **ID:** US043 · **Prioridade:** Must · **Complexidade:** 3
- **Dependências:** US001 · **Requisitos:** RF042 · **Regras:** RN029

**Critérios de aceitação**
- No primeiro acesso, o aviso é exibido antes de qualquer funcionalidade, explicando quais dados são
  coletados (inclusive localização), por que e por quanto tempo.
- O aceite é registrado com data/hora, versão do texto e usuário.
- O aviso fica permanentemente acessível no perfil e no rodapé.
- Nova versão do texto exige novo aceite.

### US044 — Aplicar as políticas de retenção
> Como **empresa**, quero que dados antigos sejam descartados automaticamente, para cumprir a LGPD.

- **ID:** US044 · **Prioridade:** Should · **Complexidade:** 5
- **Dependências:** US039 · **Requisitos:** RNF007 · **Regras:** RN029

**Critérios de aceitação**
- Rotina periódica remove pontos de GPS com mais de 12 meses, preservando os totais consolidados.
- Cada execução da rotina é registrada com a quantidade de registros afetados.
- Os prazos são parametrizáveis, não fixos no código.

## Feature E8.F2 — Entrega

### US045 — Instalar o sistema como aplicativo no celular
> Como **motorista**, quero um ícone na tela inicial, para abrir direto sem digitar endereço.

- **ID:** US045 · **Prioridade:** Could · **Complexidade:** 5
- **Dependências:** US016 · **Requisitos:** RF044, RNF021 · **Regras:** —

**Critérios de aceitação**
- O sistema oferece a instalação em navegadores compatíveis, com ícone e nome definidos.
- Aberto pelo ícone, roda em tela cheia, sem barra de endereços.
- Os recursos estáticos ficam em cache, e a abertura seguinte não depende de rede para exibir a interface.

### US046 — Preparar o ambiente de produção
> Como **empresa**, quero o sistema publicado, com backup e monitoramento, para usar na operação real.

- **ID:** US046 · **Prioridade:** Must · **Complexidade:** 13
- **Dependências:** todas as stories Must · **Requisitos:** RNF002, RNF013, RNF014, RNF018 · **Regras:** —

**Critérios de aceitação**
- Domínio configurado, HTTPS válido e renovação automática de certificado.
- Backup diário automatizado com restauração testada e documentada.
- Monitoramento ativo com health check e alerta de indisponibilidade.
- Variáveis de ambiente de produção configuradas fora do repositório.
- Usuário administrador inicial criado e senha entregue com segurança.
- Roteiro de homologação executado e aprovado pelo cliente.
