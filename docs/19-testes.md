# 19 · Plano de testes

## Estratégia

Pirâmide deliberadamente estreita no topo: muitos testes unitários nas **regras de negócio** (onde
está o risco real deste sistema — cálculo de km, odômetro, transições de estado), testes de
integração nos casos de uso e um conjunto pequeno e estável de testes ponta a ponta nos fluxos que,
se quebrarem, param a operação.

```
        ╱ e2e (8–12 cenários) ╲            Playwright · fluxos críticos
      ╱  api / permissões       ╲          contratos e matriz de acesso
    ╱   integração (casos de uso) ╲        banco de teste real
  ╱     unitários (regras puras)    ╲      Vitest · rápido, sem I/O
```

**Metas de cobertura:** ≥ 90% em `*.regras.ts` · ≥ 70% em `*.servico.ts` · sem meta global
artificial — cobrir formatação de data não reduz risco nenhum.

## Testes unitários — Vitest

Alvo: funções puras em `src/modulos/**/*.regras.ts` e `src/utilitarios/**`.

| Módulo | Casos essenciais |
|---|---|
| `cpf` | Válido, inválido, com máscara, todos os dígitos iguais, tamanho incorreto, normalização |
| `placa` | Formato antigo, Mercosul, minúsculas, com e sem hífen, inválido |
| `usuario.regras` | Política de senha (RN004), proibição de senha igual ao CPF, último administrador (RN010), autoação (RN011) |
| `jornada.regras` | Odômetro menor que o último (RN015), divergência acima de 500 km, cálculo de totais (RN018), bloqueio de encerramento com corrida aberta (RN014) |
| `corrida.regras` | Km negativo, horário final anterior ao inicial (RN016), sobreposição de corridas, excesso de passageiros, transições de status válidas e inválidas |
| `edicao.regras` | Dentro e fora da janela de 12 h (RN019), justificativa curta, fronteira exata do prazo |
| `data` | Conversão UTC ↔ America/Sao_Paulo, virada de dia às 00h, horário de verão histórico |
| `auditoria.regras` | Cálculo do delta entre valores, exclusão de campos sensíveis |

Cada regra é testada com **valor válido, valor inválido e valor de fronteira** — a fronteira é onde
a maioria dos defeitos aparece (odômetro exatamente igual ao anterior, prazo exatamente em 12 h).

## Testes de integração

Executados contra um PostgreSQL descartável (Docker ou Testcontainers), com transação revertida
ao final de cada teste.

| Caso de uso | Verificação |
|---|---|
| Abrir jornada | Persistência correta; segunda abertura no mesmo dia retorna a existente (RN012); constraint única impede duplicidade sob concorrência |
| Iniciar corrida | Bloqueio de segunda corrida simultânea via índice parcial (RN014) |
| Encerrar corrida | Cálculo e persistência de km e duração; atualização do odômetro do veículo |
| Encerrar jornada | Consolidação dos totais; recusa com corrida aberta |
| Correção com justificativa | Gravação da auditoria com valor anterior, novo e justificativa (RN026) |
| Auditoria | Toda mutação gera exatamente um registro; tentativa de `UPDATE`/`DELETE` é negada pelo banco (RN027) |
| Sincronização offline | Reenvio do mesmo `clientUuid` não duplica (RN025); lote com conflito processa os demais itens |
| Importação | Cabeçalho inválido não grava nada (RN031); linhas válidas passam e inválidas são relatadas (RN032) |
| Geração de planilha | Arquivo criado, registrado e com conteúdo correspondente ao filtro |
| Expurgo por retenção | Remove apenas o que passou do prazo, preservando os consolidados |

## Testes de API

Para cada endpoint de [`16-api.md`](16-api.md):

- **Contrato:** formato da resposta de sucesso e de erro conforme o padrão único.
- **Códigos de status:** ao menos um caso para cada status documentado.
- **Validação:** campo obrigatório ausente, tipo incorreto, valor fora da enumeração, texto acima
  do limite, payload acima de 1 MB.
- **Paginação:** valor padrão, limite máximo, página inexistente.
- **Rate limiting:** limite atingido retorna 429 com `Retry-After`.
- **Idempotência:** `POST /api/sincronizacao` repetido não duplica.

## Testes de permissões

Matriz obrigatória — para **cada** rota protegida, um caso por perfil:

| Cenário | Esperado |
|---|---|
| Sem sessão em rota protegida | 401 |
| Motorista em rota administrativa | 403 |
| Motorista consultando jornada de outro motorista | **404**, não 403 (RN009) |
| Motorista alterando o próprio registro dentro da janela | 200 |
| Motorista alterando o próprio registro fora da janela | 403 |
| Motorista exportando dados gerais | Retorna apenas os próprios |
| Administrador em qualquer rota | 200 |
| Administrador excluindo o último administrador | 409 |
| Usuário agindo sobre a própria conta | 409 |
| Usuário bloqueado com sessão previamente ativa | 401 na requisição seguinte |
| Requisição com `motoristaId` de terceiro no corpo | Ignorado — usa o da sessão |

Este bloco é **obrigatório na Definition of Done** de qualquer story que crie rota nova.

## Testes de interface

Testing Library, focados em comportamento observável:

- Formulário exibe erro no campo e move o foco para o primeiro campo inválido.
- Botão de envio desabilita durante a submissão e não permite duplo clique.
- Estado vazio de filtro difere do estado vazio de ausência de dados.
- Modal de confirmação: `Esc` fecha, foco fica preso dentro, retorna ao gatilho ao fechar.
- Tabela renderiza skeleton durante o carregamento, nunca tela em branco.
- Componentes críticos passam em verificação automática de acessibilidade (`axe`).
- Cartão de corrida em andamento atualiza o cronômetro.

## Testes ponta a ponta — Playwright

Cenários mínimos, executados em desktop e em emulação de celular com GPS simulado:

| # | Cenário | Cobre |
|---|---|---|
| E2E-1 | Primeiro acesso: login com senha temporária → troca de senha → aceite de privacidade → tela inicial | US001, US002, US043 |
| E2E-2 | **Dia completo do motorista:** abrir jornada → iniciar corrida → registrar 2 paradas → encerrar corrida → encerrar jornada → ver resumo | US016–US021, US030 |
| E2E-3 | Administrador acompanha o dia: dashboard → abre jornada → vê mapa → exporta Excel | US026, US028, US029, US032 |
| E2E-4 | Cadastro completo: criar usuário → criar veículo → criar rota com 3 paradas | US004, US011, US012 |
| E2E-5 | Correção com justificativa e verificação do histórico de alterações | US022, US041 |
| E2E-6 | Tentativa de acesso indevido: motorista tenta abrir `/admin` e a jornada de um colega | US010 |
| E2E-7 | Offline: perder conexão no meio da corrida, encerrar, reconectar e confirmar sincronização | US025 |
| E2E-8 | Importação: baixar modelo → enviar arquivo com 2 linhas inválidas → conferir relatório → confirmar | US015 |
| E2E-9 | Bloqueio por tentativas: 5 senhas erradas → conta bloqueada → mensagem correta | US001 |
| E2E-10 | Envio do resumo do dia ao administrador | US036 |

O download do `.xlsx` em E2E-3 é validado abrindo o arquivo e conferindo cabeçalho e primeira
linha — verificar apenas que "baixou algo" não prova nada sobre o entregável principal do cliente.

## Cenários derivados dos critérios de aceitação

Exemplos do formato adotado (um por regra crítica):

**CT-01 · Odômetro menor que o último registrado**
> **Dado** um veículo com odômetro registrado em 84.320 km
> **Quando** o motorista tentar abrir a jornada informando 84.000 km
> **Então** o sistema recusa, exibe "O odômetro não pode ser menor que 84.320 km" e **não** cria a jornada.

**CT-02 · Encerramento com corrida em andamento**
> **Dado** um motorista com jornada aberta e uma corrida em andamento
> **Quando** tentar encerrar a jornada
> **Então** o sistema bloqueia, informa qual corrida está aberta e oferece atalho para encerrá-la.

**CT-03 · Acesso a registro de terceiro**
> **Dado** o motorista A autenticado
> **Quando** requisitar a jornada do motorista B pela API
> **Então** o sistema responde **404** e registra a tentativa na auditoria.

**CT-04 · Correção fora da janela**
> **Dado** uma corrida encerrada há 13 horas e janela configurada em 12 horas
> **Quando** o motorista tentar corrigi-la
> **Então** a ação não é exibida na interface e a API responde 403 com `FORA_DA_JANELA_DE_EDICAO`.

**CT-05 · Sincronização sem duplicidade**
> **Dado** uma corrida criada offline com `clientUuid` X, já sincronizada
> **Quando** o mesmo lote for reenviado
> **Então** o servidor responde `JA_PROCESSADA` com o mesmo id e não cria segundo registro.

**CT-06 · Auditoria com valor anterior**
> **Dado** uma corrida com 27 km encerrada
> **Quando** o administrador corrigir para 32 km com justificativa
> **Então** a auditoria registra `valor_anterior = 27`, `valor_novo = 32`, o autor, o horário e a
> justificativa, e o registro passa a exibir a marcação "editado".

**CT-07 · GPS negado não bloqueia**
> **Dado** um motorista que negou a permissão de localização
> **Quando** iniciar e encerrar uma corrida
> **Então** a corrida é registrada normalmente, marcada como "sem localização", com aviso não bloqueante.

**CT-08 · Exportação respeita o filtro**
> **Dado** uma consulta filtrada por um motorista e um período de 7 dias
> **Quando** exportar em Excel
> **Então** o arquivo contém exatamente as linhas exibidas, com cabeçalho de identificação e período.

## Testes não funcionais

| Tipo | Como |
|---|---|
| Carga | 15 usuários simultâneos por 10 min, verificando os alvos de RNF010 |
| Volume | Banco com 12 meses de dados sintéticos (~50 mil corridas) antes de medir consultas e relatórios |
| Responsividade | Verificação manual e automatizada em 360, 768 e 1280 px |
| Acessibilidade | `axe` no pipeline + verificação manual por teclado nas telas críticas |
| Segurança | Varredura de dependências, teste dos limites de requisição, verificação de cabeçalhos, tentativa de acesso direto a arquivo |
| Recuperação | Restauração de backup em ambiente limpo, cronometrada (RNF014) |

## Automação

Pipeline em cada push: lint → verificação de tipos → unitários → integração → build.
Ponta a ponta: em pull request para `main` e no deploy de homologação.
Falha em qualquer etapa bloqueia a mesclagem.
