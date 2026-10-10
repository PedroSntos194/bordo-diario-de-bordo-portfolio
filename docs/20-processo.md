# 20 · Processo — DoR, DoD e controle de mudanças

---

## Definition of Ready

Uma User Story só entra em desenvolvimento quando **todos** os itens abaixo estão satisfeitos.
Story que não atende à DoR volta para refinamento — não entra na sprint "para não parar o time".

- [ ] Descrição no formato "Como… quero… para…", com o valor explícito para o usuário
- [ ] Critérios de aceitação escritos, objetivos e verificáveis
- [ ] Requisitos funcionais (RF) e regras de negócio (RN) relacionados identificados
- [ ] Dependências mapeadas, e as bloqueantes já concluídas
- [ ] Nenhum ⚠️ *Necessário validar com o cliente* pendente que afete esta story
- [ ] Perfis envolvidos e permissões definidos (consta na matriz do doc 08)
- [ ] Comportamento definido para: estado vazio, erro, carregamento e acesso indevido
- [ ] Impacto no banco de dados conhecido (nova tabela, coluna ou migração)
- [ ] Contrato de API definido quando houver endpoint novo
- [ ] Layout definido quando a tela for nova ou mudar de forma relevante
- [ ] Estimativa em Story Points atribuída pelo time
- [ ] Cabe em uma sprint — se não couber, foi quebrada em stories menores

**Exceção controlada:** story de investigação técnica (*spike*) entra sem critérios de aceitação
de produto, mas com **pergunta a responder**, **prazo máximo** e **entregável** definidos.

---

## Definition of Done

Uma tarefa só é considerada concluída quando **todos** os itens abaixo estão verdadeiros. Não existe
"concluído, faltando testar" — isso é "em andamento".

### Funcional
- [ ] Todos os critérios de aceitação atendidos e demonstráveis
- [ ] Fluxo principal e fluxos alternativos funcionando
- [ ] Validações implementadas no cliente **e** no servidor
- [ ] Regras de negócio aplicadas conforme o doc 06
- [ ] Estados de carregamento, vazio e erro implementados
- [ ] Ações irreversíveis com modal de confirmação (RN024)

### Técnico
- [ ] Código revisado e aprovado por outra pessoa
- [ ] Sem erro de lint e sem erro de tipo
- [ ] Sem `console.log`, código comentado ou `TODO` sem issue vinculada
- [ ] Migração de banco criada, versionada e reversível
- [ ] Autorização verificada no servidor (RF041)
- [ ] Auditoria registrada quando a ação altera dados (RF037)
- [ ] Erros tratados conforme o padrão do doc 18
- [ ] Nenhum segredo ou dado sensível em código ou em log

### Testes
- [ ] Testes unitários das regras novas, aprovados
- [ ] Teste de integração do caso de uso, quando houver
- [ ] Testes de permissão por perfil, quando a story cria rota
- [ ] Todos os testes existentes continuam passando
- [ ] Teste ponta a ponta atualizado quando a story altera um fluxo crítico

### Interface
- [ ] Verificado em 360, 768 e 1280 px
- [ ] Navegável por teclado, com foco visível
- [ ] Contraste conforme RNF022
- [ ] Textos em português, sem termo técnico exposto ao usuário
- [ ] Feedback visual em toda ação

### Entrega
- [ ] Mesclado na branch de integração sem conflito
- [ ] Implantado em homologação
- [ ] Documentação atualizada quando a story alterou contrato, modelo ou regra
- [ ] Validado por quem escreveu a story

---

## Controle de mudanças

### Princípio

O escopo aprovado é o que está em [`03-escopo-e-mvp.md`](03-escopo-e-mvp.md) e no backlog do
[`07-backlog.md`](07-backlog.md). **Qualquer funcionalidade, alteração de regra ou mudança de
comportamento não prevista ali é uma Solicitação de Mudança**, mesmo quando parecer pequena — e
especialmente quando parecer pequena, porque é assim que o *scope creep* acontece.

Isso não é burocracia contra o cliente: é o que protege prazo, orçamento e qualidade dos dois lados.

### O que é e o que não é mudança de escopo

| É mudança de escopo | Não é mudança de escopo |
|---|---|
| Funcionalidade nova não prevista | Correção de defeito no que já foi entregue |
| Alteração de regra de negócio já aprovada | Ajuste de texto, rótulo ou mensagem |
| Nova integração externa | Ajuste visual dentro das diretrizes do doc 11 |
| Novo perfil de usuário | Esclarecimento de requisito ambíguo já listado nos ⚠️ V-xx |
| Novo relatório ou nova exportação | Melhoria de desempenho dentro dos alvos de RNF010 |
| Mudança de plataforma (ex.: app nativo) | Refatoração interna sem alteração de comportamento |
| Antecipação de item marcado como "Futuro" | Implementação de item já previsto no MVP |

### Fluxo de uma Solicitação de Mudança

```
1. Registro
   Cliente ou time registra a solicitação por escrito, com o objetivo pretendido
   (o problema, não a solução).

2. Análise
   O time avalia: impacto em requisitos, regras, banco, telas, API, testes e
   segurança; e verifica conflito com o que já foi construído.

3. Estimativa
   Complexidade em Story Points e conversão em esforço.

4. Impacto no prazo
   Efeito na sprint atual e na data de entrega. Se a mudança entra, algo sai ou a
   data se move — as duas coisas não podem ser evitadas ao mesmo tempo.

5. Impacto no valor
   Custo adicional, quando houver, e custo recorrente, quando houver.

6. Decisão do cliente
   Aprovar · aprovar com troca de escopo (algo previsto sai no lugar) · adiar para
   fase seguinte · recusar.

7. Aprovação formal
   Somente após o registro do aceite por escrito o item entra no backlog.

8. Atualização da documentação
   Requisitos, regras, backlog e roadmap são atualizados. Rastreabilidade preservada.
```

**Nenhum desenvolvimento começa antes da etapa 7.** Implementar antes de aprovar retira do cliente a
chance de decidir e transfere o custo silenciosamente para o prazo.

### Registro de mudanças

| ID | Data | Solicitante | Descrição | Impacto (pontos) | Impacto no prazo | Custo | Decisão |
|---|---|---|---|---|---|---|---|
| SM-001 | — | — | — | — | — | — | — |

### Casos especiais

**Urgência.** Mudança urgente pode ser implementada antes da aprovação formal apenas mediante
autorização expressa do responsável pelo projeto, com registro imediato e regularização em até 48 h.

**Descoberta durante o desenvolvimento.** Se surgir um requisito implícito e indispensável ao
funcionamento (algo sem o qual a funcionalidade aprovada não opera), ele é comunicado imediatamente e
tratado como esclarecimento — não como mudança — desde que não amplie o escopo aprovado.

**Resposta a um ⚠️ V-xx.** As respostas do cliente aos pontos de validação **não** são mudança de
escopo: são a definição pendente. Mas se a resposta contrariar a premissa adotada e já implementada,
o retrabalho decorrente é estimado e comunicado.

**Acúmulo de pequenas mudanças.** Solicitações individualmente triviais são agrupadas e avaliadas em
conjunto a cada sprint. Cinco ajustes de 2 pontos consomem uma sprint inteira sem que ninguém perceba.
