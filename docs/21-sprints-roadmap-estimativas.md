# 21 · Sprints, roadmap e estimativas

## Premissas de planejamento

| Premissa | Valor | Observação |
|---|---|---|
| Duração da sprint | 2 semanas | Sprint 0 tem 1 semana |
| Time considerado | 2 pessoas desenvolvedoras | ⚠️ Se o time for de 1 pessoa, **dobre** a duração |
| Velocidade estimada | ~26 pontos por sprint | Estabiliza a partir da Sprint 2 |
| Total do backlog | **260 pontos** · 46 stories | Ver [`07-backlog.md`](07-backlog.md) |
| MVP (somente Must Have) | **163 pontos** | Inclui a story de produção (US046) |

> ⚠️ **V-11 — não há prazo nem orçamento informados.** As seções 11 e 12 do questionário não constam
> do documento recebido. O planejamento abaixo é uma proposta técnica, não um compromisso contratual.

---

## Organização das sprints

### Sprint 0 — Preparação (1 semana)
**Objetivo:** deixar o ambiente pronto para que a primeira funcionalidade não precise resolver
decisões de infraestrutura.

**Entregas técnicas** (sem User Story de produto):
- Repositório, padrão de branches, lint, formatação, verificação de tipos
- Projeto Next.js + TypeScript + Tailwind + shadcn/ui com o tema do doc 11
- Docker Compose (aplicação + PostgreSQL) e ambiente de desenvolvimento reprodutível
- Esquema Prisma completo do doc 12 + primeira migração + seed (admin inicial e configurações)
- Camada transversal: `acao-segura.ts` (sessão → permissão → validação → transação → **auditoria**),
  `erros.ts`, `logger.ts`, `env.ts`, componentes de layout e de estado (vazio, carregando, erro)
- Pipeline de CI e ambiente de homologação publicado com uma página de saúde

**Dependências:** V-01 e V-02 respondidos (onde hospedar e quem paga).
**Resultado esperado:** `git clone` → um comando → aplicação rodando; deploy automático em homologação.

> A camada de auditoria entra aqui de propósito: se ela nascer depois, cada caso de uso já escrito
> precisará ser revisitado, e o requisito mais detalhado do cliente vira remendo.

---

### Sprint 1 — Acesso e rastreabilidade (29 pts)
**Objetivo:** entrar no sistema com segurança e registrar tudo desde o primeiro dia.
**Stories:** US001 (5) · US002 (3) · US003 (2) · US010 (8) · US039 (8) · **US043 (3)**
**Dependências:** Sprint 0.
**Resultado:** login por CPF funcionando, troca obrigatória de senha, aviso de privacidade aceito,
controle de acesso por perfil validado por testes e trilha de auditoria gravando.

> **Ajuste durante a execução.** A **US043 (aviso de privacidade)** foi antecipada da Sprint 2
> para cá. Motivo: a tela inicial redireciona para `/privacidade/aceite` logo após o login, e
> deixar essa rota inexistente criaria um link morto no fluxo principal de entrada. Sprint 1 passa
> de 26 para 29 pontos; Sprint 2 cai de 25 para 22. O total do projeto não muda.

### Sprint 2 — Gestão de usuários (22 pts)
**Objetivo:** o administrador consegue cadastrar e administrar a equipe sozinho.
**Stories:** US004 (5) · US005 (3) · US006 (5) · US007 (3) · US008 (3) · US009 (3)
**Dependências:** Sprint 1.
**Resultado:** os 60 usuários podem ser cadastrados; aviso de privacidade em vigor.

### Sprint 3 — Cadastros e abertura do dia (26 pts)
**Objetivo:** ter os dados que o motorista vai apenas selecionar, e iniciar a jornada.
**Stories:** US011 (5) · US012 (5) · US013 (8) · US016 (8)
**Dependências:** Sprint 2 (permissões e usuários).
**Resultado:** veículos e rotas com pontos de parada cadastrados; motorista já abre a jornada do dia
pelo celular.

### Sprint 4 — Corridas e localização (26 pts) 🔑
**Objetivo:** o núcleo do produto — registrar a corrida de ponta a ponta.
**Stories:** US018 (8) · US019 (5) · US020 (8) · US017 (5)
**Dependências:** Sprint 3; V-06 respondido antes do início.

> **Executada com o V-06 ainda em aberto.** Construída sob a premissa documentada no doc 01:
> **captura pontual** de GPS (início e encerramento da corrida), em PWA. Se o cliente responder que
> quer rastreamento contínuo, esta sprint precisa ser refeita como aplicativo nativo — o risco foi
> assumido conscientemente para não paralisar o projeto.
**Resultado:** **o papel pode ser abandonado em teste-piloto** — o motorista abre o dia, roda
corridas com GPS e encerra tudo pelo celular.

### Sprint 5 — Painel do administrador (26 pts)
**Objetivo:** dar visibilidade ao gestor.
**Stories:** US026 (8) · US027 (5) · US028 (5) · US030 (8)
**Dependências:** Sprint 4 (precisa existir dado real para exibir).
**Resultado:** dashboard do dia, consulta com filtros, detalhe da jornada e resumo diário.

### Sprint 6 — Excel e envio (21 pts)
**Objetivo:** entregar o que o cliente descreveu como fim do processo.
**Stories:** US032 (5) · US033 (8) · US036 (8)
**Dependências:** Sprint 5; V-05 respondido antes do início.
**Resultado:** exportação em Excel, planilha consolidada gerada automaticamente e resumo enviado ao
administrador pelo WhatsApp. **MVP funcionalmente completo.**

> **Executada sem a resposta do V-05.** A dependência foi tratada como as demais premissas do
> projeto: valeu a recomendação já registrada no doc 01 — **(a) link `wa.me` no MVP, com a
> arquitetura preparada para (b)**. A abordagem oficial (Cloud API) está escrita e isolada em
> `NotificadorPorCloudApi`, atrás de `WHATSAPP_CANAL=cloud`, mas **não foi exercitada contra a
> Meta**: isso exige conta verificada, número dedicado e template aprovado, que são atos do
> cliente. Se a resposta vier "(b)", o trabalho restante é o processo na Meta e uma rodada de
> homologação do canal — não reescrita.
>
> Entrou junto uma parte da **US034** (histórico de arquivos): a US033 exige que o consolidado
> "fique disponível no histórico, com data, parâmetros e link de download", e sem uma tela isso não
> era verificável. O que ficou para a Sprint 8 é o resto da US034 — filtro por período e tratamento
> de arquivo expirado.

### Sprint 7 — Homologação e go-live do MVP (13 pts + estabilização)
**Objetivo:** colocar em produção com segurança.
**Stories:** US046 (13) + correções decorrentes da homologação
**Atividades:** roteiro de homologação com o cliente, carga inicial de cadastros, treinamento dos
motoristas, ajuste fino de desempenho, checklist de segurança do doc 17, backup testado.
**Dependências:** Sprints 1–6; infraestrutura provisionada (V-02).
**Resultado:** **sistema em produção com um grupo-piloto de motoristas.**

### Sprint 8 — Complementos da operação (27 pts)
**Objetivo:** cobrir o que o piloto revelar e enriquecer o registro.
**Stories:** US021 (5) · US022 (5) · US023 (3) · US029 (8) · US034 (3) · US035 (3)
**Resultado:** paradas detalhadas, correção com justificativa, ocorrências, mapa do trajeto e
histórico de arquivos.

### Sprint 9 — Gestão e análise (26 pts)
**Objetivo:** dar autonomia de configuração e profundidade de análise.
**Stories:** US031 (8) · US037 (5) · US040 (5) · US041 (3) · US042 (5)
**Resultado:** relatórios por período, consulta de logs, histórico por registro, parâmetros
configuráveis e reenvio de notificações.

### Sprint 10 — Campo e carga (26 pts)
**Objetivo:** resolver a realidade da rua e a entrada de dados em massa.
**Stories:** US025 (13) · US015 (8) · US038 (5)
**Dependências:** V-08 respondido; piloto já rodando (para saber onde o sinal falha).
**Resultado:** operação offline com sincronização, importação por planilha e cobrança automática de
quem não registrou.

### Sprint 11 — Fechamento da v1.0 (18 pts)
**Objetivo:** encerrar o escopo contratado.
**Stories:** US014 (5) · US024 (3) · US044 (5) · US045 (5)
**Resultado:** escala, abastecimento, retenção automática de dados e instalação como aplicativo.
Documentação final e passagem de conhecimento.

### Resumo

| Sprint | Foco | Pontos | Acumulado |
|---|---|---|---|
| 0 | Preparação | — | — |
| 1 | Acesso e auditoria | 29 | 29 |
| 2 | Usuários | 22 | 51 |
| 3 | Cadastros e jornada | 26 | 77 |
| 4 | Corridas e GPS 🔑 | 26 | 103 |
| 5 | Painel | 26 | 129 |
| 6 | Excel e WhatsApp | 21 | 150 |
| 7 | Homologação e go-live | 13 | 163 · **MVP** |
| 8 | Complementos | 27 | 190 |
| 9 | Gestão e análise | 26 | 216 |
| 10 | Campo e carga | 26 | 242 |
| 11 | Fechamento | 18 | **260 · v1.0** |

---

## Roadmap

### Fase 1 — Fundação (Sprint 0 · ~1 semana)
Ambiente, arquitetura, banco, camada de segurança e auditoria, pipeline. Nada visível ao cliente,
tudo o que sustenta o restante. **Marco:** ambiente de homologação no ar.

### Fase 2 — Acesso e cadastros (Sprints 1–3 · ~6 semanas)
Autenticação, perfis, usuários, veículos, rotas e abertura de jornada. **Marco:** o cliente já
consegue cadastrar a operação real no sistema.

### Fase 3 — MVP operacional (Sprints 4–6 · ~6 semanas)
Corridas, localização, encerramento, painel, Excel e WhatsApp. **Marco:** um dia inteiro de trabalho
registrado de ponta a ponta, sem papel.

### Fase 4 — Homologação e piloto (Sprint 7 · ~2 semanas)
Validação com o cliente, treinamento, carga inicial e produção com grupo reduzido de motoristas.
**Marco:** sistema em produção, com uso real monitorado.

### Fase 5 — Expansão da v1.0 (Sprints 8–11 · ~8 semanas)
Complementos, análise, operação offline, importação e conformidade. Adoção estendida a toda a frota.
**Marco:** escopo contratado concluído e papel eliminado da operação.

### Fase 6 — Evolução (após a v1.0)
Itens de [`03-escopo-e-mvp.md`](03-escopo-e-mvp.md#possíveis-evoluções-futuras), priorizados com
base no uso real: WhatsApp automático, integração Microsoft, escala planejada × realizada,
manutenção por quilometragem.

**Linha do tempo agregada (2 pessoas):** MVP em produção em **~15 semanas** · v1.0 completa em
**~23 semanas**.
Com 1 pessoa: aproximadamente o dobro. Com 3 pessoas: **não** cai proporcionalmente — o ganho
realista fica em torno de 25%, por causa da coordenação e das dependências entre sprints.

---

## Estimativas

### Escala de complexidade

| Pontos | Tamanho | Referência prática |
|---|---|---|
| 1 | XS | Ajuste de texto, campo simples em formulário existente |
| 2 | S | Tela estática, ação sem regra |
| 3 | S/M | CRUD simples de uma entidade sem regra especial |
| 5 | M | Tela com formulário, validação e regra de negócio |
| 8 | L | Funcionalidade com múltiplas regras, integração ou cálculo |
| 13 | XL | Funcionalidade sistêmica que atravessa várias camadas |
| > 13 | — | Deve ser quebrada antes de entrar na sprint |

### Estimativa por épico

| Épico | Pontos | Tamanho | Comentário |
|---|---|---|---|
| E1 · Acesso e usuários | 40 | L | Volume vem da matriz de permissões e dos testes de acesso |
| E2 · Cadastros base | 31 | L | Editor de pontos de parada com mapa é a parte cara |
| E3 · Operação do motorista | 63 | XL | Núcleo do produto; contém a story mais complexa (offline) |
| E4 · Painel e acompanhamento | 26 | L | Mapa e agregações do dashboard |
| E5 · Relatórios e planilhas | 35 | L | Excel bem formatado custa mais do que parece |
| E6 · Notificações | 18 | M | Depende fortemente da resposta ao V-05 |
| E7 · Auditoria e administração | 21 | M | Barato porque a base entra na Sprint 0 |
| E8 · Qualidade e conformidade | 26 | L | Metade é a preparação de produção |
| **Total** | **260** | — | — |

### Fatores que podem alterar significativamente o esforço

| Fator | Impacto | Referência |
|---|---|---|
| WhatsApp Cloud API oficial em vez de link | **+13 a +21 pontos** e dependência de aprovação da Meta (prazo externo, semanas) | V-05 |
| Rastreamento GPS contínuo em vez de pontual | **+34 pontos ou mais** — muda de PWA para app nativo, com todo o ciclo de loja | V-06 |
| Integração Microsoft (SSO, OneDrive, Power BI) | **+13 a +34 pontos** conforme a interpretação | V-04 |
| Sistema restrito à rede interna com VPN | Reescrita do fluxo do motorista; risco de inviabilizar o produto | V-01 |
| Offline completo em vez de rascunho local | **+13 pontos** sobre US025 | V-08 |
| Layout de importação complexo ou variável | **+8 pontos** por formato adicional | V-10 |
| Identidade visual detalhada, com manual de marca | **+5 a +8 pontos** de ajuste fino | V-18 |
| Prazo comprimido | Não reduz esforço — reduz escopo ou qualidade. A alavanca disponível é o escopo. | V-11 |

> **O que esta estimativa não é:** um orçamento. Ela expressa **complexidade relativa**, não horas.
> A conversão em horas e valor depende do time efetivamente alocado e das respostas aos pontos de
> validação — apresentar precisão maior do que a informação disponível permite seria falso.
