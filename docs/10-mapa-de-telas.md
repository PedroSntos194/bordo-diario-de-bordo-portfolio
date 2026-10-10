# 10 · Mapa de telas

Convenção de rotas: área do motorista sob `/app`, área administrativa sob `/admin`.

| # | Tela | Rota | Perfil |
|---|---|---|---|
| T01 | Login | `/login` | Público |
| T02 | Troca obrigatória de senha | `/trocar-senha` | Autenticado |
| T03 | Aviso de privacidade | `/privacidade/aceite` | Autenticado |
| T04 | Meu dia | `/app` | Motorista |
| T05 | Abrir jornada | `/app/jornada/abrir` | Motorista |
| T06 | Iniciar corrida | `/app/corrida/iniciar` | Motorista |
| T07 | Corrida em andamento | `/app/corrida/[id]` | Motorista |
| T08 | Encerrar corrida | `/app/corrida/[id]/encerrar` | Motorista |
| T09 | Encerrar jornada | `/app/jornada/encerrar` | Motorista |
| T10 | Resumo do dia (motorista) | `/app/resumo/[data]` | Motorista |
| T11 | Meu histórico | `/app/historico` | Motorista |
| T12 | Registrar ocorrência | `/app/ocorrencia/nova` | Motorista |
| T13 | Meu perfil | `/perfil` | Autenticado |
| T14 | Dashboard | `/admin` | Administrador |
| T15 | Jornadas | `/admin/jornadas` | Administrador |
| T16 | Detalhe da jornada | `/admin/jornadas/[id]` | Administrador |
| T17 | Corridas | `/admin/corridas` | Administrador |
| T18 | Detalhe da corrida + mapa | `/admin/corridas/[id]` | Administrador |
| T19 | Usuários | `/admin/usuarios` | Administrador |
| T20 | Formulário de usuário | `/admin/usuarios/novo` · `/admin/usuarios/[id]` | Administrador |
| T21 | Veículos | `/admin/veiculos` | Administrador |
| T22 | Formulário de veículo | `/admin/veiculos/novo` · `/admin/veiculos/[id]` | Administrador |
| T23 | Rotas | `/admin/rotas` | Administrador |
| T24 | Formulário de rota + pontos de parada | `/admin/rotas/novo` · `/admin/rotas/[id]` | Administrador |
| T25 | Relatórios | `/admin/relatorios` | Administrador |
| T26 | Arquivos gerados | `/admin/arquivos` | Administrador |
| T27 | Importação | `/admin/importar` | Administrador |
| T28 | Notificações | `/admin/notificacoes` | Administrador |
| T29 | Logs de auditoria | `/admin/auditoria` | Administrador |
| T30 | Configurações | `/admin/configuracoes` | Administrador |
| T31 | Acesso não permitido | `/403` | Autenticado |
| T32 | Página não encontrada | `/404` | Todos |
| T33 | Erro inesperado | `/500` | Todos |

---

## Área pública e comum

### T01 · Login
**Objetivo:** autenticar o usuário. É a primeira coisa que o usuário vê, conforme o cliente definiu.
**Acesso:** público
**Componentes:** logo da empresa, campo CPF (com máscara e teclado numérico no celular), campo senha
com alternância de visibilidade, botão "Entrar", link "Esqueci minha senha" (orienta procurar o
administrador ⚠️ *V-07*), área de mensagem de erro.
**Informações exibidas:** nome do sistema, versão discreta no rodapé.
**Ações:** entrar.
**Origem dos dados:** `POST /api/auth/login`.
**Destino:** Motorista → T04 · Administrador → T14 · com indicador de troca → T02 · sem aceite → T03.

### T02 · Troca obrigatória de senha
**Objetivo:** forçar a definição de senha própria.
**Acesso:** autenticado com indicador "deve trocar senha".
**Componentes:** campos nova senha e confirmação, lista de requisitos com validação em tempo real,
botão "Salvar e continuar".
**Ações:** salvar. **Origem:** `POST /api/auth/trocar-senha`. **Destino:** tela inicial do perfil.

### T03 · Aviso de privacidade
**Objetivo:** informar a coleta de dados (inclusive localização) e registrar o aceite.
**Acesso:** autenticado sem aceite da versão vigente.
**Componentes:** texto do aviso com rolagem, caixa de aceite, botão "Aceitar e continuar".
**Ações:** aceitar. **Origem:** `POST /api/privacidade/aceite`. **Destino:** tela inicial do perfil.

### T13 · Meu perfil
**Objetivo:** consultar os próprios dados e trocar a senha.
**Acesso:** autenticado.
**Componentes:** cartão de dados (nome, CPF mascarado, perfil, telefone, último acesso), formulário
de troca de senha, link para o aviso de privacidade, botão "Sair".
**Ações:** trocar senha, sair. **Origem:** `GET /api/perfil`.

---

## Área do motorista (mobile-first)

### T04 · Meu dia
**Objetivo:** tela central do motorista — mostrar o estado do dia e a próxima ação.
**Acesso:** Motorista (Administrador acessa para verificação).
**Componentes:** cabeçalho com data e nome; **cartão de estado** que muda conforme a situação:
- sem jornada → botão grande "Iniciar meu dia";
- jornada aberta sem corrida → botão grande "Iniciar corrida" + resumo parcial;
- corrida em andamento → cartão destacado com rota, cronômetro e "Encerrar corrida";
- jornada encerrada → resumo do dia + "Enviar ao administrador".

Abaixo: lista das corridas do dia (rota, horários, km, status), indicador de sincronização,
acesso a ocorrência e histórico.
**Informações exibidas:** veículo do dia, odômetro inicial, total de corridas, km acumulado.
**Ações:** iniciar/encerrar jornada, iniciar/encerrar corrida, registrar ocorrência, ver histórico.
**Origem:** `GET /api/jornadas/hoje`.

### T05 · Abrir jornada
**Objetivo:** iniciar o registro do dia em poucos toques.
**Componentes:** data/hora em modo leitura, seletor de veículo (busca por placa), campo odômetro
inicial com teclado numérico, botão "Iniciar meu dia".
**Ações:** confirmar abertura. **Origem:** `GET /api/veiculos/disponiveis` · `POST /api/jornadas`.
**Destino:** T04.

### T06 · Iniciar corrida
**Objetivo:** escolher a rota e começar a corrida.
**Componentes:** busca de rota, lista de rotas ativas com as mais usadas no topo, alternativa
"Corrida avulsa" com campos de origem e destino, aviso de captura de localização, botão "Iniciar".
**Ações:** iniciar corrida. **Origem:** `GET /api/rotas?status=ATIVA` · `POST /api/corridas`.
**Destino:** T07.

### T07 · Corrida em andamento
**Objetivo:** acompanhar a corrida e registrar as paradas.
**Componentes:** cabeçalho com rota e cronômetro, lista ordenada dos pontos de parada com botão de
registro por ponto, linha do tempo dos eventos já registrados, botão fixo "Encerrar corrida",
indicador de GPS (ativo / indisponível), ação "Cancelar corrida".
**Ações:** registrar parada, desfazer último evento (2 min), encerrar, cancelar.
**Origem:** `GET /api/corridas/[id]` · `POST /api/corridas/[id]/eventos`. **Destino:** T08.

### T08 · Encerrar corrida
**Objetivo:** fechar a corrida com os dados finais.
**Componentes:** odômetro final (numérico), passageiros, observações, prévia calculada de km e
duração, modal de confirmação.
**Ações:** confirmar encerramento. **Origem:** `POST /api/corridas/[id]/encerrar`. **Destino:** T04.

### T09 · Encerrar jornada
**Objetivo:** fechar o dia e consolidar.
**Componentes:** resumo consolidado, campo odômetro final do dia, aviso de corrida em andamento
quando houver, modal de confirmação com os totais.
**Ações:** confirmar encerramento. **Origem:** `POST /api/jornadas/[id]/encerrar`. **Destino:** T10.

### T10 · Resumo do dia (motorista)
**Objetivo:** mostrar o que foi registrado e permitir o envio ao administrador.
**Componentes:** cartões de totais, lista de corridas, ocorrências, botão "Enviar ao administrador",
botão "Baixar Excel", estado do envio.
**Ações:** enviar resumo, baixar planilha. **Origem:** `GET /api/resumo/[data]`.

### T11 · Meu histórico
**Objetivo:** consultar os próprios dias anteriores.
**Componentes:** seletor de período, lista de jornadas com data, veículo, corridas e km, estado vazio.
**Ações:** abrir jornada (somente leitura), exportar. **Origem:** `GET /api/jornadas?escopo=proprio`.

### T12 · Registrar ocorrência
**Objetivo:** relatar um problema.
**Componentes:** seletor de tipo, descrição, vínculo opcional com a corrida atual, horário
automático, botão "Registrar".
**Ações:** registrar. **Origem:** `POST /api/ocorrencias`. **Destino:** T04.

---

## Área administrativa

### T14 · Dashboard
**Objetivo:** panorama imediato da operação do dia.
**Acesso:** Administrador.
**Componentes:** menu lateral, cabeçalho com usuário e data, cards de indicadores (jornadas abertas,
encerradas, corridas em andamento, km do dia, veículos em operação, ocorrências, motoristas sem
registro), tabela de corridas em andamento, lista de ocorrências do dia, atalhos rápidos.
**Ações:** navegar para cada listagem filtrada, abrir corrida, abrir ocorrência.
**Origem:** `GET /api/dashboard`.

### T15 · Jornadas
**Objetivo:** consultar todas as jornadas com filtros.
**Componentes:** barra de filtros (período, motorista, veículo, status), tabela paginada
(data, motorista, veículo, início, fim, corridas, km, status), botão "Exportar Excel", estado vazio.
**Ações:** filtrar, ordenar, abrir detalhe, exportar. **Origem:** `GET /api/jornadas`.
**Destino:** T16.

### T16 · Detalhe da jornada
**Objetivo:** ver tudo o que aconteceu em um dia de um motorista.
**Componentes:** cabeçalho (motorista, veículo, data, horários, odômetros, totais), lista de
corridas, ocorrências, seção de histórico de alterações, marcação "editado" quando aplicável.
**Ações:** ver corrida no mapa, corrigir com justificativa, exportar, ver histórico.
**Origem:** `GET /api/jornadas/[id]`.

### T17 · Corridas
**Objetivo:** consulta transversal de corridas.
**Componentes:** filtros (período, motorista, veículo, rota, status), tabela paginada, exportação.
**Origem:** `GET /api/corridas`. **Destino:** T18.

### T18 · Detalhe da corrida + mapa
**Objetivo:** analisar uma corrida específica e seu trajeto.
**Componentes:** dados da corrida, linha do tempo de eventos, **mapa** com os pontos numerados,
detalhes do ponto ao clicar, histórico de alterações, aviso quando não houver GPS.
**Ações:** corrigir, exportar, voltar. **Origem:** `GET /api/corridas/[id]`.

### T19 · Usuários
**Objetivo:** administrar o acesso das pessoas.
**Componentes:** busca, filtros (perfil, status), tabela (nome, CPF mascarado, perfil, telefone,
status, último acesso), menu de ações por linha, botão "Novo usuário".
**Ações:** criar, editar, redefinir senha, bloquear, desativar, excluir.
**Origem:** `GET /api/usuarios`. **Destino:** T20.

### T20 · Formulário de usuário
**Componentes:** campos de identificação, perfil, status, dados de CNH (condicionais ao perfil
Motorista), modal com a senha temporária ao criar.
**Ações:** salvar, cancelar. **Origem:** `POST/PUT /api/usuarios`.

### T21–T22 · Veículos e formulário de veículo
**Componentes:** busca por placa/modelo, filtro por status, tabela (placa, modelo, capacidade,
odômetro, status, jornada atual); formulário com placa, modelo, marca, ano, capacidade, odômetro e status.
**Ações:** criar, editar, desativar. **Origem:** `GET/POST/PUT /api/veiculos`.

### T23–T24 · Rotas e formulário de rota
**Componentes:** busca, filtros (turno, status), tabela (código, nome, origem, destino, turno,
paradas, status); formulário com dados da rota e **editor de pontos de parada** com mapa,
reordenação por arraste e busca de endereço.
**Ações:** criar, editar, desativar, gerenciar paradas. **Origem:** `GET/POST/PUT /api/rotas`.

### T25 · Relatórios
**Objetivo:** produzir as visões consolidadas.
**Componentes:** seletor de tipo (resumo do dia, por período, por motorista, por veículo, por rota),
filtros, prévia em tabela, gráfico simples de km por dia, botão "Exportar Excel", aviso de
processamento em segundo plano para volumes grandes.
**Origem:** `GET /api/relatorios/...`.

### T26 · Arquivos gerados
**Componentes:** tabela (tipo, período, autor, data/hora, tamanho, status), filtros, download.
**Origem:** `GET /api/arquivos`.

### T27 · Importação
**Componentes:** seletor de tipo, download do modelo, área de upload por arraste, pré-visualização
com contagem de válidos/inválidos, tabela de erros por linha, botão de confirmação, download do
relatório de erros.
**Origem:** `POST /api/importacoes`.

### T28 · Notificações
**Componentes:** tabela (data, tipo, destinatário, canal, status, tentativas, erro), filtros,
ação de reenvio com confirmação.
**Origem:** `GET /api/notificacoes`.

### T29 · Logs de auditoria
**Componentes:** filtros (usuário, período, ação, entidade), tabela paginada, painel de detalhe com
comparação "antes × depois", exportação.
**Origem:** `GET /api/auditoria`.

### T30 · Configurações
**Componentes:** formulário agrupado por tema (operação, relatórios, notificações, segurança), com
descrição de cada parâmetro e faixa de valores válidos.
**Origem:** `GET/PUT /api/configuracoes`.

---

## Telas de sistema

### T31 · Acesso não permitido (403)
Mensagem clara, sem jargão técnico, com botão para voltar à área permitida do perfil.

### T32 · Página não encontrada (404)
Mensagem simples com atalho para a tela inicial.

### T33 · Erro inesperado (500)
Mensagem amigável, código de referência do erro para suporte e botão "Tentar novamente".
Nenhum detalhe técnico (stack trace, SQL, nome de tabela) é exibido.
