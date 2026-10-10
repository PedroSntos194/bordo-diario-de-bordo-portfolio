# 03 · Escopo e MVP

## Dentro do escopo (versão 1.0)

### Acesso e usuários
- Autenticação por **CPF + senha**, com bloqueio após tentativas inválidas.
- Troca de senha obrigatória no primeiro acesso e redefinição pelo administrador ⚠️ *(V-07)*.
- Gestão de usuários pelo administrador: criar, editar, bloquear/desativar, excluir (lógica).
- Perfis **Motorista** e **Administrador** com permissões distintas.
- Área "Meu perfil" com alteração da própria senha.

### Cadastros base
- **Veículos (vans)**: placa, modelo, capacidade, status ⚠️ *(V-03)*.
- **Rotas**: nome, origem, destino, turno, distância estimada.
- **Pontos de parada** da rota, com coordenadas e ordem.

### Operação diária (núcleo do produto)
- Abertura da **jornada** do dia: data, veículo, odômetro inicial.
- **Corridas** dentro da jornada: rota pré-cadastrada ou corrida avulsa.
- **Captura automática de localização** no início da corrida, nas paradas e no encerramento ⚠️ *(V-06)*.
- Registro de **eventos/paradas** (chegada, saída, embarque, desembarque).
- **Encerramento da corrida**: odômetro final, passageiros, observações.
- **Encerramento da jornada**: totais do dia calculados automaticamente.
- Registro de **ocorrências** vinculadas à corrida.
- **Confirmação obrigatória** em ações irreversíveis ⚠️ *(V-12)*.
- Edição do próprio registro dentro de janela configurável, com justificativa ⚠️ *(V-13)*.

### Painel administrativo
- **Dashboard** com indicadores do dia.
- Consulta de jornadas e corridas com **busca e filtros** (data, motorista, veículo, rota, status).
- Visualização do **trajeto/pontos no mapa**.
- Correção de registros com justificativa obrigatória.
- **Log de auditoria** com autor, data/hora, valor anterior e valor novo.
- Configurações do sistema (janela de edição, horário do consolidado, destinatários).

### Relatórios e exportação
- **Resumo do dia** (por motorista, por veículo e consolidado).
- Relatórios por período, motorista, veículo e rota.
- **Exportação em Excel (.xlsx)** de qualquer consulta filtrada.
- **Geração automática da planilha consolidada diária** (automação pedida pelo cliente).
- Histórico de arquivos gerados, com download.

### Importação
- **Upload de planilha** para importação de cadastros (motoristas, veículos, rotas) a partir de
  um modelo `.xlsx` fornecido pelo sistema, com validação linha a linha e relatório de erros ⚠️ *(V-10)*.

### Notificações
- **Envio do resumo do dia ao administrador via WhatsApp** ⚠️ *(V-05)*.
- Alerta de jornada não encerrada / motorista sem registro no dia.
- Central de notificações internas no sistema.

### Transversal
- Responsivo: **celular, tablet e computador**, com PWA instalável para o motorista.
- Rascunho local e sincronização em conexão instável ⚠️ *(V-08)*.
- Trilha de auditoria, logs de acesso e atividades.
- Conformidade LGPD: aviso de privacidade, retenção definida, controle de acesso ⚠️ *(V-09)*.

---

## Fora do escopo (não faz parte da versão 1.0)

| Item | Motivo |
|---|---|
| Pagamentos, cobrança, faturamento | Cliente respondeu explicitamente "nao" |
| Integração com e-mail | Cliente respondeu "nao" — recuperação de senha será via administrador ⚠️ *(V-07)* |
| Aplicativo nativo publicado nas lojas (Android/iOS) | PWA atende; loja acrescenta custo, contas de desenvolvedor e ciclo de revisão |
| Rastreamento GPS contínuo em segundo plano | Exige app nativo e tem impacto em bateria/dados ⚠️ *(V-06)* |
| Integração com rastreador veicular / telemetria embarcada | Não citado; depende de hardware existente |
| SSO Microsoft 365 / Entra ID, OneDrive, SharePoint, Power BI | "Microsoft" não foi especificado ⚠️ *(V-04)* |
| Módulo de manutenção de frota, pneus, multas, seguro | Não solicitado |
| Controle de jornada de trabalho / ponto eletrônico (Portaria 671) | Não solicitado; exige conformidade legal específica |
| Gestão de passageiros individualizada (lista nominal, catraca, QR Code) | Não solicitado |
| Roteirização/otimização automática de rotas | Não solicitado; alta complexidade |
| Fluxo de aprovação | Cliente respondeu "nao" |
| Migração de dados históricos | "Já existe alguma base de dados? Nao" |
| Multiempresa / multifilial | Não solicitado |
| Chat interno entre motorista e administrador | Não solicitado; WhatsApp já cumpre o papel |
| Aplicativo para passageiros | Não solicitado |

---

## Possíveis evoluções futuras

Ordenadas por valor percebido — **não fazem parte do MVP nem da v1.0**:

1. **Envio 100% automático por WhatsApp** via Cloud API oficial (evolução do V-05).
2. **Recuperação de senha autônoma** por e-mail ou código no WhatsApp (evolução do V-07).
3. **Escala/planejamento**: atribuir motorista + van + rota por dia, e comparar planejado × realizado.
4. **Controle de abastecimento e custo por km**, com relatório de consumo.
5. **Registro fotográfico**: checklist do veículo com fotos no início e no fim da jornada.
6. **Rastreamento contínuo em tempo real** com app nativo.
7. **Integração Microsoft**: publicar a planilha diária direto no OneDrive/SharePoint e conjunto de dados para Power BI.
8. **Perfil Supervisor** e permissões granulares por funcionalidade.
9. **Manutenção preventiva** por quilometragem, com alerta automático.
10. **Assinatura digital do resumo do dia** pelo motorista.
11. **Módulo de multas e infrações** vinculadas a motorista/veículo.
12. **Aplicativo nativo publicado nas lojas**.

---

## MVP — Minimum Viable Product

**Definição do MVP:** o menor conjunto de funcionalidades que permite a um motorista registrar
integralmente o dia de trabalho pelo celular e ao administrador receber esse dia consolidado em
Excel — encerrando o uso do papel.

Se o motorista precisar continuar anotando qualquer coisa em papel, o MVP falhou.

### Priorização MoSCoW

#### 🔴 Must Have — essencial (sem isso não existe produto)

| Item | RF | Por quê |
|---|---|---|
| Login com CPF e senha | RF001 | Porta de entrada; foi definido explicitamente pelo cliente |
| Troca de senha no 1º acesso e redefinição pelo admin | RF002, RF003 | Cliente pediu recuperação de senha; sem e-mail, o admin é o caminho |
| CRUD de usuários + bloqueio/desativação | RF004–RF007 | Pedido explicitamente no painel administrativo |
| Controle de acesso por perfil | RF041 | "Administrador vê tudo, funcionário tem acesso limitado" |
| Cadastro de veículos | RF010 | Sem veículo não há diário de bordo *da van* ⚠️ *(V-03)* |
| Cadastro de rotas e pontos de parada | RF011, RF012 | "cadastra as rotas" é passo do fluxo principal |
| Abertura de jornada | RF014 | Delimita o "dia" — o objetivo é "planilhar o dia a dia" |
| Iniciar corrida | RF015 | Núcleo da operação |
| Captura de localização nos marcos da corrida | RF016 | "Localizar" é o primeiro verbo da descrição do projeto |
| Encerramento da corrida | RF018 | Citado literalmente no fluxo do cliente |
| Encerramento da jornada com totais | RF019 | Fecha o dia e habilita o resumo |
| Confirmação em ações irreversíveis | RF024 | Pedido explicitamente |
| Dashboard administrativo | RF028 | Pedido explicitamente |
| Consulta com busca e filtros | RF029 | Pedido explicitamente |
| Relatório resumo do dia | RF030 | Pedido explicitamente ("Sim, resumo do dia") |
| Exportação em Excel | RF032 | Pedido explicitamente ("Excel") |
| Geração automática da planilha diária | RF033 | Automação pedida explicitamente |
| Envio do resumo ao administrador via WhatsApp | RF025 | Último passo do fluxo descrito pelo cliente ⚠️ *(V-05)* |
| Log de auditoria com valor anterior | RF037 | Pedido com riqueza de detalhe: "quem alterou, quando, valor anterior" |
| Responsividade mobile/tablet/desktop | RNF003 | Pedido explicitamente |

#### 🟠 Should Have — importante (entra na v1.0, mas o MVP roda sem)

| Item | RF | Por quê |
|---|---|---|
| Registro de paradas/eventos durante a corrida | RF017 | Enriquece o "destinos e rotas", mas o par início/fim já entrega valor |
| Registro de ocorrências | RF020 | Substitui o campo "observações" do papel |
| Rascunho offline com sincronização | RF022 | Crítico para adesão, mas tecnicamente isolável ⚠️ *(V-08)* |
| Edição com justificativa dentro da janela | RF023 | Correção de erro humano é inevitável na prática |
| Alerta de jornada não encerrada | RF026 | Ataca diretamente a causa do problema |
| Consulta de logs de atividade | RF038 | Pedido, mas consumido com baixa frequência |
| Histórico de alterações por registro | RF039 | Complementa a auditoria com visão por registro |
| Visualização do trajeto no mapa | RF034 | Alto valor percebido; depende de RF016 |
| Relatórios por período/motorista/veículo/rota | RF031 | O resumo do dia cobre o essencial no MVP |
| Central de notificações internas | RF027 | Rede de segurança caso o WhatsApp falhe |
| Importação de cadastros por planilha | RF035 | Acelera a carga inicial dos 60 usuários ⚠️ *(V-10)* |
| Histórico de arquivos gerados | RF036 | Conveniência sobre a exportação |
| Configurações do sistema | RF040 | Evita valores fixos no código |

#### 🟡 Could Have — desejável (só se houver folga na v1.0)

| Item | RF | Por quê |
|---|---|---|
| Registro de abastecimento | RF021 | Complementa custo/km, mas não foi solicitado |
| Escala motorista → van → rota | RF013 | Melhora a experiência do motorista; não é bloqueante |
| Perfil Supervisor | — | Sugestão S-09 |
| Modo escuro | — | Conforto de uso ao amanhecer/anoitecer |
| PWA instalável com ícone na tela inicial | RNF021 | Melhora percepção de "aplicativo" |

#### ⚪ Won't Have Now — fora desta versão

Tudo listado em **Fora do escopo** e em **Possíveis evoluções futuras** acima. Cada um desses
itens, se solicitado, entra pelo processo de [controle de mudanças](20-processo.md#controle-de-mudanças).

### Corte do MVP em uma frase

> Um motorista consegue, apenas com o celular, registrar jornada + corridas + localização e
> encerrar o dia; e um administrador consegue ver isso num painel, filtrar, exportar em Excel e
> receber o resumo do dia — com tudo auditado.
