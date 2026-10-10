# 23 · Checklist pré-desenvolvimento e ordem de implementação

---

## Checklist antes de começar a implementação

### 🔴 Bloqueantes — sem isso, não se começa

- [ ] **V-01 respondido:** sistema publicado na internet ou restrito à rede interna
- [ ] **V-02 respondido:** quem provisiona e paga domínio, servidor e backup
- [ ] **V-03 respondido:** cadastro de veículos entra no MVP
- [ ] **V-05 respondido:** abordagem do WhatsApp (link ou API oficial)
- [ ] **V-06 respondido:** captura pontual de GPS ou rastreamento contínuo
- [ ] **V-16 respondido:** nome oficial da empresa e do produto
- [ ] **Escopo e MVP aprovados por escrito** pelo cliente
- [ ] **Responsável pelo projeto definido** do lado do cliente, com poder de decisão
- [ ] Processo de controle de mudanças apresentado e aceito

### 🟠 Necessários antes das sprints que dependem deles

- [ ] V-04 (o que é "integração com Microsoft") — antes da Sprint 6
- [ ] V-07 (recuperação de senha sem e-mail) — antes da Sprint 1
- [ ] V-08 (necessidade de funcionamento offline) — antes da Sprint 10
- [ ] V-09 (base legal e aviso de privacidade, com validação jurídica) — antes da Sprint 2
- [ ] V-10 (objetivo e layout da importação) — antes da Sprint 10
- [ ] V-12 (quais ações são irreversíveis) — antes da Sprint 3
- [ ] V-13 (motorista pode editar após encerrar) — antes da Sprint 4
- [ ] V-14 (uma ou várias jornadas por dia) — antes da Sprint 3
- [ ] V-15 (para quem e quando vai o resumo do dia) — antes da Sprint 6
- [ ] V-17 (quantos motoristas, admins, vans e rotas) — antes da Sprint 2
- [ ] V-18 (identidade visual) — antes da Sprint 2

### Insumos do cliente

- [ ] Logo em arquivo vetorial (D-05)
- [ ] **Modelo da planilha de papel usada hoje** (D-06) — evita perder campos que já estão em uso
- [ ] Listas de usuários, veículos e rotas para carga inicial (D-07, D-08, D-09)
- [ ] Número de WhatsApp que receberá o resumo (D-10)
- [ ] Pessoa responsável pela homologação, com disponibilidade acordada (D-12)

### Técnico

- [ ] Repositório criado, com controle de acesso e padrão de branches definido
- [ ] Ambiente de desenvolvimento reprodutível (Docker Compose)
- [ ] Esquema Prisma revisado contra o doc 12
- [ ] Domínio registrado e servidor provisionado
- [ ] Ambiente de homologação acessível
- [ ] Pipeline de CI configurado
- [ ] Cofre de segredos definido
- [ ] `.env.example` completo
- [ ] Backlog carregado na ferramenta de acompanhamento, com IDs preservados

### Time e processo

- [ ] Time alocado e disponibilidade confirmada
- [ ] Duração da sprint e ritual de revisão acordados com o cliente
- [ ] Definition of Ready e Definition of Done aceitas pelo time
- [ ] Canal de comunicação definido com prazo de resposta acordado
- [ ] Critério de aceite de entrega acordado (quem valida e em quanto tempo)

---

## Ordem de implementação

A sequência abaixo é ditada por **dependência técnica real**, não por conveniência. Inverter etapas
aqui gera retrabalho previsível — cada item indica o que quebra se for feito fora de ordem.

### 1. Configuração inicial
Projeto, TypeScript, lint, formatação, Tailwind, componentes base, Docker, variáveis de ambiente.
*Primeiro porque tudo o mais é escrito dentro dessa estrutura.*

### 2. Banco de dados
Esquema Prisma completo, primeira migração, seed com administrador inicial e configurações padrão.
*Antes de qualquer tela: o modelo de dados define os tipos que atravessam todas as camadas. Modelar
depois significa refazer serviços e componentes já escritos.*

### 3. Camada transversal de segurança e auditoria
`acao-segura.ts` (sessão → permissão → validação → transação → auditoria), classes de erro, logger,
validação de variáveis de ambiente.
*Este é o ponto de ordem mais importante do projeto. Se a auditoria nascer depois dos casos de uso,
cada um deles terá de ser reaberto — e o requisito mais detalhado do cliente vira remendo frágil.*

### 4. Autenticação
Auth.js com credenciais, sessão em banco, hash Argon2id, troca obrigatória de senha, bloqueio por
tentativas. *Depende de 2 e 3; bloqueia todo o restante, porque não há tela sem usuário.*

### 5. Autorização
Middleware por perfil, guardas nos casos de uso, filtro de escopo nos repositórios, testes da matriz
de permissões. *Logo após a autenticação — implantar autorização depois de já existirem 20 rotas
significa auditar 20 rotas.*

### 6. Estrutura base da interface
Layouts do motorista e do administrador, navegação, tabela paginada, barra de filtros, estados vazio
e de carregamento, modal de confirmação, sistema de toast.
*Antes das telas de negócio: componentes criados sob demanda dentro de cada tela geram cinco tabelas
ligeiramente diferentes.*

### 7. Cadastros base
Usuários → veículos → rotas → pontos de parada.
*Nesta ordem: usuários precisam existir para que qualquer registro tenha autor; veículos e rotas
precisam existir para que a jornada possa referenciá-los. Também é o primeiro CRUD completo — ele
consolida na prática o padrão que os demais seguirão.*

### 8. Núcleo operacional
Jornada → corrida → localização → eventos → encerramentos.
*Estritamente nesta ordem: corrida não existe sem jornada; evento não existe sem corrida; o
encerramento depende de todos os anteriores para calcular os totais.*

### 9. Consultas e painel
Listagens com filtros, detalhe da jornada, dashboard.
*Depois do núcleo, porque só faz sentido exibir o que já pode ser registrado — e porque construir
telas sobre dados fictícios esconde problemas de desempenho e de modelagem.*

### 10. Relatórios e Excel
Resumo do dia → exportação → geração automática agendada.
*O resumo precede a exportação: a planilha é a materialização do resumo, não uma consulta paralela.
Construir os dois em separado duplicaria a regra de consolidação.*

### 11. Notificações e integrações
Fila de notificações → envio pelo WhatsApp → alerta de pendências.
*Depois dos relatórios, porque a mensagem carrega o resumo e o link da planilha. A fila vem antes do
canal: assim o envio é intercambiável e a falha externa nunca bloqueia a operação.*

### 12. Auditoria — telas de consulta
Consulta de logs e histórico por registro.
*A gravação já está pronta desde a etapa 3; aqui entra apenas a leitura, que não bloqueia nada.*

### 13. Operação offline
Service worker, fila local, sincronização idempotente.
*Deliberadamente tarde: sincronizar exige que os casos de uso online estejam estáveis. Construir
offline sobre regras que ainda vão mudar significa implementar duas vezes.*

### 14. Importação e configuração
Importação por planilha, tela de parâmetros.
*Complementares; dependem dos cadastros e das regras já consolidadas.*

### 15. Testes e ajuste fino
Cobertura completa dos fluxos críticos, testes de carga, acessibilidade, revisão de segurança.
*Testes unitários e de integração acompanham cada etapa desde o início — o que se concentra aqui são
os testes ponta a ponta, de carga e de segurança, que exigem o sistema inteiro montado.*

### 16. Homologação
Carga inicial, roteiro de validação com o cliente, treinamento, correções.

### 17. Deploy em produção
Domínio, TLS, backup com restauração testada, monitoramento, checklist de segurança do doc 17,
go-live com grupo-piloto.

---

## Dependências críticas de ordem

| Se for feito antes de… | Consequência |
|---|---|
| Auditoria depois dos casos de uso | Reabrir e reescrever todos os serviços já entregues |
| Autorização depois das rotas | Auditoria manual de cada rota existente; risco alto de escape |
| Telas antes do modelo de dados | Refazer componentes a cada ajuste de esquema |
| Corrida antes de jornada | Modelo sem o vínculo que sustenta o relatório do dia |
| Excel antes do resumo | Regra de consolidação duplicada em dois lugares |
| Offline antes das regras estáveis | Implementar a mesma regra duas vezes, com risco de divergência |
| Deploy antes do backup testado | Risco de perda de dados reais sem recuperação comprovada |
| Piloto antes do treinamento | Rejeição dos motoristas por dificuldade de uso, não por defeito do sistema |

---

## Passagem para o desenvolvimento

Concluída esta documentação e satisfeito o checklist bloqueante, o desenvolvimento segue o
protocolo do prompt-mestre. Antes de cada grande funcionalidade:

> **User Story sendo implementada:**
> **Objetivo:**
> **Arquivos envolvidos:**
> **Banco/API envolvidos:**
> **Critérios de aceitação:**

E ao concluir:

> **O que foi feito:**
> **Como testar:**
> **Critérios atendidos:**
> **Possíveis pendências:**

Uma funcionalidade por vez, seguindo o backlog aprovado, sem alterar requisitos sem comunicar e sem
criar o que não foi solicitado.
