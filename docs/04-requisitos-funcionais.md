# 04 · Requisitos funcionais

Legenda de prioridade: **M** = Must Have · **S** = Should Have · **C** = Could Have
Perfis: **MOT** = Motorista · **ADM** = Administrador · **SIS** = ação automática do sistema

---

## A. Autenticação, acesso e usuários

### RF001 — Autenticação por CPF e senha
O sistema deverá autenticar o usuário a partir do **CPF** e de uma **senha**, aceitando o CPF com
ou sem máscara e normalizando-o para apenas dígitos antes da consulta.
- **Usuários:** MOT, ADM
- **Prioridade:** M
- **Dependências:** RF004 (existir usuário cadastrado)
- **Regras:** RN001, RN002, RN003, RN006, RN007

### RF002 — Redefinição de senha pelo administrador
O administrador deverá poder gerar uma **senha temporária** para qualquer usuário, que será
comunicada fora do sistema e obrigará a troca no próximo acesso. ⚠️ *V-07*
- **Usuários:** ADM
- **Prioridade:** M
- **Dependências:** RF004, RF003
- **Regras:** RN004, RN005, RN026

### RF003 — Troca de senha obrigatória no primeiro acesso
Ao acessar com senha temporária ou no primeiro login, o sistema deverá exigir a definição de uma
nova senha antes de liberar qualquer outra tela.
- **Usuários:** MOT, ADM
- **Prioridade:** M
- **Dependências:** RF001
- **Regras:** RN004, RN005

### RF004 — Cadastro de usuários
O administrador deverá poder cadastrar usuários informando nome completo, CPF, telefone (WhatsApp),
perfil (Motorista/Administrador), matrícula, CNH e validade da CNH (para motoristas) e status.
- **Usuários:** ADM
- **Prioridade:** M
- **Dependências:** RF041
- **Regras:** RN001, RN002, RN010, RN011, RN026

### RF005 — Edição de usuários
O administrador deverá poder editar os dados cadastrais de qualquer usuário, exceto o CPF de
usuários que já possuam registros operacionais.
- **Usuários:** ADM
- **Prioridade:** M
- **Dependências:** RF004
- **Regras:** RN002, RN026

### RF006 — Bloqueio, desativação e exclusão de usuários
O administrador deverá poder **bloquear**, **desativar** ou **excluir** um usuário. A exclusão será
sempre **lógica**, preservando o vínculo com os registros históricos.
- **Usuários:** ADM
- **Prioridade:** M
- **Dependências:** RF004, RF024
- **Regras:** RN006, RN010, RN011, RN024, RN026

### RF007 — Consulta e filtros de usuários
O sistema deverá listar os usuários com busca por nome/CPF/matrícula e filtros por perfil e status,
com paginação e ordenação.
- **Usuários:** ADM
- **Prioridade:** M
- **Dependências:** RF004
- **Regras:** RN009

### RF008 — Encerramento e expiração de sessão
O sistema deverá permitir o logout manual e encerrar automaticamente sessões inativas.
- **Usuários:** MOT, ADM
- **Prioridade:** M
- **Dependências:** RF001
- **Regras:** RN007

### RF009 — Meu perfil
O usuário deverá poder visualizar os próprios dados e alterar a própria senha informando a senha atual.
- **Usuários:** MOT, ADM
- **Prioridade:** M
- **Dependências:** RF001
- **Regras:** RN004, RN005

---

## B. Cadastros base

### RF010 — Cadastro de veículos (vans) ⚠️ *V-03*
O sistema deverá permitir cadastrar, editar, consultar e desativar veículos com placa, modelo,
marca, ano, capacidade de passageiros, odômetro atual e status.
- **Usuários:** ADM
- **Prioridade:** M
- **Dependências:** RF041
- **Regras:** RN013, RN020, RN024, RN026

### RF011 — Cadastro de rotas
O sistema deverá permitir cadastrar, editar, consultar e desativar rotas com nome, código, origem,
destino, turno, distância estimada e status.
- **Usuários:** ADM
- **Prioridade:** M
- **Dependências:** RF041
- **Regras:** RN021, RN024, RN026

### RF012 — Cadastro de pontos de parada da rota
Cada rota deverá poder conter uma sequência ordenada de pontos de parada com nome, endereço e
coordenadas (latitude/longitude), selecionáveis em mapa.
- **Usuários:** ADM
- **Prioridade:** M
- **Dependências:** RF011
- **Regras:** RN021, RN022

### RF013 — Escala motorista × veículo × rota
O sistema deverá permitir atribuir previamente um motorista a um veículo e a uma ou mais rotas em
uma data, pré-preenchendo a abertura da jornada.
- **Usuários:** ADM
- **Prioridade:** C
- **Dependências:** RF004, RF010, RF011
- **Regras:** RN013

---

## C. Operação — jornada, corridas e localização

### RF014 — Abertura da jornada diária
O motorista deverá poder abrir a jornada do dia informando o veículo e o **odômetro inicial**,
com a data e a hora capturadas automaticamente pelo sistema.
- **Usuários:** MOT
- **Prioridade:** M
- **Dependências:** RF001, RF010
- **Regras:** RN012, RN013, RN014, RN015, RN020

### RF015 — Início de corrida
Com a jornada aberta, o motorista deverá poder iniciar uma corrida escolhendo uma **rota
cadastrada** ou registrando uma **corrida avulsa** com origem e destino informados manualmente.
- **Usuários:** MOT
- **Prioridade:** M
- **Dependências:** RF014, RF011
- **Regras:** RN014, RN016, RN021

### RF016 — Captura automática de localização ⚠️ *V-06*
Nos marcos da corrida (início, cada parada registrada e encerramento), o sistema deverá capturar
latitude, longitude, precisão e horário do dispositivo, registrando a origem do dado (GPS ou manual).
Se o usuário negar a permissão de localização, o registro deverá prosseguir marcado como **sem GPS**.
- **Usuários:** MOT, SIS
- **Prioridade:** M
- **Dependências:** RF015
- **Regras:** RN022, RN023, RN029

### RF017 — Registro de paradas e eventos da corrida
Durante a corrida, o motorista deverá poder registrar eventos (chegada ao ponto, saída do ponto,
embarque, desembarque) com horário e localização.
- **Usuários:** MOT
- **Prioridade:** S
- **Dependências:** RF015, RF016
- **Regras:** RN016, RN022

### RF018 — Encerramento da corrida
O motorista deverá poder encerrar a corrida informando odômetro final (ou km percorrido),
quantidade de passageiros e observações. O sistema calculará duração e distância.
- **Usuários:** MOT
- **Prioridade:** M
- **Dependências:** RF015, RF024
- **Regras:** RN016, RN017, RN018, RN020, RN024

### RF019 — Encerramento da jornada
O motorista deverá poder encerrar a jornada do dia. O sistema exigirá que não existam corridas em
andamento, registrará o odômetro final do dia e consolidará os totais (corridas, km, tempo, passageiros).
- **Usuários:** MOT
- **Prioridade:** M
- **Dependências:** RF018, RF024
- **Regras:** RN014, RN017, RN018, RN020, RN024

### RF020 — Registro de ocorrências
O motorista deverá poder registrar ocorrências (atraso, pane, acidente, desvio, outro) vinculadas
à jornada ou à corrida, com descrição e horário.
- **Usuários:** MOT, ADM
- **Prioridade:** S
- **Dependências:** RF014
- **Regras:** RN023

### RF021 — Registro de abastecimento
O motorista deverá poder registrar abastecimentos com data, litros, valor, odômetro e posto.
- **Usuários:** MOT, ADM
- **Prioridade:** C
- **Dependências:** RF014, RF010
- **Regras:** RN020

### RF022 — Rascunho offline e sincronização ⚠️ *V-08*
Sem conexão, o sistema deverá manter os registros em armazenamento local do dispositivo e
sincronizá-los automaticamente quando a conexão for restabelecida, sem duplicar registros.
- **Usuários:** MOT, SIS
- **Prioridade:** S
- **Dependências:** RF014, RF015, RF018
- **Regras:** RN025

### RF023 — Edição de registro com justificativa ⚠️ *V-13*
Registros já encerrados poderão ser editados pelo motorista dentro de uma janela configurável
(padrão 12 horas) e pelo administrador a qualquer momento, sempre com **justificativa obrigatória**.
- **Usuários:** MOT, ADM
- **Prioridade:** S
- **Dependências:** RF018, RF019, RF037
- **Regras:** RN019, RN026, RN027

### RF024 — Confirmação de ações irreversíveis ⚠️ *V-12*
Ações irreversíveis deverão exigir confirmação explícita em modal, com descrição da consequência.
- **Usuários:** MOT, ADM
- **Prioridade:** M
- **Dependências:** —
- **Regras:** RN024

---

## D. Notificações

### RF025 — Envio do resumo do dia ao administrador via WhatsApp ⚠️ *V-05*
Ao encerrar a jornada, o sistema deverá disponibilizar o envio do resumo do dia ao administrador
pelo WhatsApp, contendo os totais e o link para a planilha gerada.
- **Usuários:** MOT, SIS
- **Prioridade:** M
- **Dependências:** RF019, RF030, RF033
- **Regras:** RN017, RN028

### RF026 — Alerta de jornada não encerrada / motorista sem registro
Em horário configurável, o sistema deverá identificar jornadas abertas e motoristas ativos sem
registro no dia e notificar o motorista e o administrador.
- **Usuários:** SIS, MOT, ADM
- **Prioridade:** S
- **Dependências:** RF019, RF040
- **Regras:** RN012, RN028

### RF027 — Fila de notificações com reenvio
Toda notificação deverá ser persistida com status (pendente, enviada, falha), número de tentativas
e erro, permitindo reenvio manual pelo administrador.
- **Usuários:** SIS, ADM
- **Prioridade:** S
- **Dependências:** RF025
- **Regras:** RN028

---

## E. Painel, consultas e relatórios

### RF028 — Dashboard administrativo
O sistema deverá apresentar ao administrador indicadores do dia: jornadas abertas e encerradas,
corridas em andamento, km rodado, veículos em operação, ocorrências e pendências de registro.
- **Usuários:** ADM
- **Prioridade:** M
- **Dependências:** RF014, RF015, RF019
- **Regras:** RN008, RN009

### RF029 — Consulta de jornadas e corridas com filtros
O sistema deverá permitir consultar jornadas e corridas com filtros por período, motorista,
veículo, rota e status, com paginação, ordenação e busca textual.
- **Usuários:** ADM (todos os registros), MOT (apenas os próprios)
- **Prioridade:** M
- **Dependências:** RF014, RF015
- **Regras:** RN008, RN009

### RF030 — Relatório resumo do dia
O sistema deverá gerar o resumo diário com: motorista, veículo, rotas percorridas, horário de
início e fim, quantidade de corridas, km total, passageiros e ocorrências.
- **Usuários:** ADM, MOT (o próprio)
- **Prioridade:** M
- **Dependências:** RF019
- **Regras:** RN017, RN018

### RF031 — Relatórios por período, motorista, veículo e rota
O sistema deverá gerar relatórios agregados por intervalo de datas, com quebra por motorista,
veículo ou rota.
- **Usuários:** ADM
- **Prioridade:** S
- **Dependências:** RF029
- **Regras:** RN008

### RF032 — Exportação em Excel (.xlsx)
Toda consulta e relatório deverá poder ser exportado em `.xlsx`, respeitando os filtros aplicados,
com cabeçalho identificando empresa, período e data de geração. ⚠️ *V-04*
- **Usuários:** ADM, MOT (os próprios registros)
- **Prioridade:** M
- **Dependências:** RF029, RF030
- **Regras:** RN008, RN030

### RF033 — Geração automática da planilha consolidada diária
Em horário configurável, o sistema deverá gerar automaticamente a planilha `.xlsx` consolidada do
dia anterior e disponibilizá-la para download e envio.
- **Usuários:** SIS
- **Prioridade:** M
- **Dependências:** RF030, RF032, RF040
- **Regras:** RN030

### RF034 — Visualização do trajeto no mapa
O sistema deverá exibir em mapa os pontos capturados de uma corrida (início, paradas, fim), com
horário e endereço aproximado de cada ponto.
- **Usuários:** ADM, MOT (as próprias corridas)
- **Prioridade:** S
- **Dependências:** RF016
- **Regras:** RN008, RN022, RN029

### RF035 — Importação de cadastros por planilha ⚠️ *V-10*
O administrador deverá poder baixar um modelo `.xlsx`, preenchê-lo e importar usuários, veículos ou
rotas em lote. O sistema deverá validar linha a linha e apresentar relatório com erros e sucessos,
sem gravar nada em caso de erro estrutural do arquivo.
- **Usuários:** ADM
- **Prioridade:** S
- **Dependências:** RF004, RF010, RF011
- **Regras:** RN002, RN013, RN031, RN032

### RF036 — Histórico de arquivos gerados
O sistema deverá manter o histórico dos arquivos gerados e importados, com autor, data, tipo,
parâmetros e link para download.
- **Usuários:** ADM
- **Prioridade:** S
- **Dependências:** RF032, RF033, RF035
- **Regras:** RN030

---

## F. Administração e auditoria

### RF037 — Registro de auditoria
Toda operação de criação, alteração, exclusão, login, logout e exportação deverá gerar um registro
de auditoria com **usuário, data/hora, ação, entidade, identificador, valor anterior e valor novo**.
- **Usuários:** SIS
- **Prioridade:** M
- **Dependências:** RF041
- **Regras:** RN026, RN027

### RF038 — Consulta de logs de atividade
O administrador deverá poder consultar os registros de auditoria com filtros por usuário, período,
ação e entidade.
- **Usuários:** ADM
- **Prioridade:** S
- **Dependências:** RF037
- **Regras:** RN008, RN027

### RF039 — Histórico de alterações do registro
Cada jornada, corrida, usuário, veículo e rota deverá exibir a linha do tempo de suas alterações,
com autor, data/hora, campo alterado, valor anterior e valor novo.
- **Usuários:** ADM
- **Prioridade:** S
- **Dependências:** RF037
- **Regras:** RN026, RN027

### RF040 — Configurações do sistema
O administrador deverá poder configurar: janela de edição do motorista, horário de geração do
consolidado, horário do alerta de pendências, destinatários do resumo e política de senha.
- **Usuários:** ADM
- **Prioridade:** S
- **Dependências:** RF041
- **Regras:** RN019, RN026

---

## G. Transversais

### RF041 — Controle de acesso por perfil
O sistema deverá restringir telas, ações e dados conforme o perfil do usuário, negando o acesso
tanto na interface quanto no servidor.
- **Usuários:** MOT, ADM, SIS
- **Prioridade:** M
- **Dependências:** RF001
- **Regras:** RN008, RN009

### RF042 — Aviso de privacidade e consentimento de localização ⚠️ *V-09*
No primeiro acesso, o sistema deverá apresentar o aviso de privacidade explicando quais dados são
coletados — incluindo localização — e registrar o aceite com data/hora.
- **Usuários:** MOT, ADM
- **Prioridade:** M
- **Dependências:** RF001
- **Regras:** RN029

### RF043 — Busca e filtros persistentes
Filtros aplicados em listagens deverão ser refletidos na URL, permitindo compartilhar e recuperar
a mesma consulta.
- **Usuários:** ADM
- **Prioridade:** C
- **Dependências:** RF029
- **Regras:** —

### RF044 — Instalação como aplicativo (PWA)
O sistema deverá poder ser instalado na tela inicial do celular, com ícone, nome e abertura em
tela cheia.
- **Usuários:** MOT
- **Prioridade:** C
- **Dependências:** RNF003
- **Regras:** —
