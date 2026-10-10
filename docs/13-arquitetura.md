# 13 · Arquitetura

## Princípio orientador

60 usuários, ~200 corridas por dia, um único domínio de negócio, equipe pequena e cliente sem
infraestrutura própria. Isso pede **monólito modular bem organizado**, não microsserviços.

O que seria overengineering aqui e está **descartado**: microsserviços, fila externa (Kafka/RabbitMQ),
Redis para cache, event sourcing, CQRS, GraphQL, Kubernetes, múltiplos bancos. Nenhum resolve um
problema que este projeto tem — todos criam problemas de operação que ele não precisa ter.

## Visão geral

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  PWA do motorista (celular)  │     │  Painel admin (desktop)      │
│  · registro em poucos toques │     │  · dashboard, consultas      │
│  · GPS pontual               │     │  · relatórios e exportação   │
│  · fila local offline        │     │  · auditoria                 │
└──────────────┬───────────────┘     └───────────────┬──────────────┘
               │            HTTPS (TLS 1.2+)         │
               └──────────────────┬──────────────────┘
                                  ▼
                 ┌────────────────────────────────────┐
                 │        Aplicação Next.js           │
                 │  ┌──────────────────────────────┐  │
                 │  │ Camada de apresentação       │  │  React Server Components,
                 │  │ (rotas, telas, componentes)  │  │  Client Components onde há
                 │  └──────────────┬───────────────┘  │  interação
                 │  ┌──────────────▼───────────────┐  │
                 │  │ Middleware: sessão + perfil  │  │  RF041
                 │  └──────────────┬───────────────┘  │
                 │  ┌──────────────▼───────────────┐  │
                 │  │ Camada de aplicação          │  │  Server Actions +
                 │  │ (casos de uso / serviços)    │  │  Route Handlers (API)
                 │  └──────────────┬───────────────┘  │
                 │  ┌──────────────▼───────────────┐  │
                 │  │ Domínio: regras de negócio   │  │  RN001…RN032
                 │  └──────────────┬───────────────┘  │
                 │  ┌──────────────▼───────────────┐  │
                 │  │ Repositórios (Prisma)        │  │
                 │  └──────────────┬───────────────┘  │
                 └─────────────────┼──────────────────┘
                                   │
        ┌──────────────┬───────────┴────────┬──────────────────┐
        ▼              ▼                    ▼                  ▼
┌──────────────┐ ┌────────────┐  ┌────────────────────┐ ┌──────────────┐
│ PostgreSQL   │ │ Storage    │  │ Agendador (pg-boss)│ │ Integrações  │
│ dados + fila │ │ arquivos   │  │ consolidado diário │ │ WhatsApp     │
│ + auditoria  │ │ .xlsx      │  │ alertas, expurgo   │ │ Mapas (OSM)  │
└──────────────┘ └────────────┘  └────────────────────┘ └──────────────┘
```

## Camadas

| Camada | Responsabilidade | Não pode |
|---|---|---|
| **Apresentação** | Renderizar telas, validar formulários no cliente, exibir estados | Conter regra de negócio ou acessar o banco diretamente |
| **Aplicação** | Orquestrar casos de uso, controlar transação, autorizar, registrar auditoria | Conter SQL ou detalhe de UI |
| **Domínio** | Regras de negócio puras (cálculo de km, validação de odômetro, transições de status) | Depender de framework, banco ou HTTP |
| **Infraestrutura** | Prisma, storage, envio de mensagens, geração de planilha | Decidir regra de negócio |

A validação de entrada acontece **duas vezes**: no cliente por experiência de uso, no servidor por
segurança — sempre com o mesmo esquema Zod, compartilhado entre as duas pontas.

## Frontend

- **Next.js (App Router)** com React Server Components: as listagens administrativas renderizam no
  servidor, o que reduz o JavaScript enviado ao celular do motorista (RNF011).
- Componentes interativos (formulários, mapa, cronômetro, fila offline) são Client Components isolados.
- **PWA**: manifesto + service worker com cache dos recursos estáticos e fila de sincronização em
  IndexedDB para as ações offline (RF022).
- Estado de servidor via TanStack Query nas telas que precisam de revalidação e otimismo controlado;
  o restante usa o próprio ciclo do App Router.

## Backend

- **Server Actions** para as mutações originadas na interface (formulários) — menos código e
  validação de tipo de ponta a ponta.
- **Route Handlers (`/api/*`)** para o que precisa ser um contrato HTTP real: sincronização offline,
  downloads, integrações e futuros consumidores externos. Documentados em [`16-api.md`](16-api.md).
- Toda mutação passa por um *wrapper* único que: verifica sessão → verifica perfil e escopo →
  valida esquema → executa em transação → grava auditoria → devolve resultado tipado.
  Esse ponto único é o que garante que RF037 não dependa de disciplina do desenvolvedor.

## Banco de dados

PostgreSQL 16 como banco único, acessado exclusivamente por **Prisma** com migrações versionadas.
Regras críticas de unicidade são garantidas por **constraint no banco**, não apenas por código
(uma jornada por motorista/dia, uma corrida em andamento por jornada, CPF único entre ativos) —
condição de corrida em ambiente com múltiplas requisições não se resolve com verificação prévia.

O usuário da aplicação no banco **não tem permissão de `UPDATE`/`DELETE` na tabela de auditoria** (RN027).

## Autenticação

> **Desvio registrado na implementação (Sprint 0).** O doc 14 previa **Auth.js
> (NextAuth v5)**. Na implementação constatou-se que o Auth.js **não suporta
> estratégia de sessão em banco junto com o provedor de credenciais** — apenas
> JWT. Como a revogação imediata de acesso (RN006) é requisito e um JWT válido
> continuaria sendo aceito até expirar, a camada de sessão foi implementada
> diretamente (`src/lib/sessao.ts`): token opaco de 256 bits em cookie
> `HttpOnly`, com apenas o SHA-256 persistido na tabela `sessao`. São ~150
> linhas, sem dependência externa de autenticação.

- **Sessão própria** com provedor de credenciais: CPF + senha.
- Hash **Argon2id** (`@node-rs/argon2`).
- **Sessão persistida em banco** (tabela `sessao`), com token opaco em cookie `HttpOnly`, `Secure`,
  `SameSite=Lax`. A escolha por sessão em banco — em vez de JWT autocontido — é deliberada: permite
  **revogar acesso imediatamente** ao bloquear um usuário (RN006), o que um JWT válido não permite.
- Expiração distinta por perfil (RN007): 12 h para motorista, 8 h com 60 min de inatividade para admin.

## Autorização

Três camadas complementares:

1. **Middleware de rota** — bloqueia áreas inteiras por perfil antes de renderizar.
2. **Guarda no caso de uso** — toda função de aplicação recebe o contexto do usuário e valida
   perfil + escopo antes de qualquer efeito.
3. **Filtro no repositório** — consultas de motorista já saem filtradas por `motorista_id`, de modo
   que um esquecimento na camada acima não vaza dado de terceiro (RN009).

## Armazenamento de arquivos

- Arquivos **fora do banco** e **fora da pasta pública**: nada é servido por URL direta.
- Download sempre por rota autenticada que verifica permissão, busca no storage e devolve o binário.
- Abstração `StorageService` com duas implementações: sistema de arquivos local (padrão inicial) e
  S3/MinIO (quando houver mais de uma instância). Trocar uma pela outra não afeta o restante do código.
- Upload valida extensão, MIME real, tamanho (5 MB) e grava com nome gerado, nunca com o nome enviado.

> **Nota da Sprint 6.** A abstração existe em [`src/lib/armazenamento.ts`](../src/lib/armazenamento.ts)
> com o driver local implementado; `STORAGE_DRIVER=s3` falha na primeira gravação com mensagem
> explícita, em vez de silenciar. A chave do arquivo é **sempre gerada** (`<tipo>/<ano>/<mês>/<uuid>.xlsx`)
> e resolvida contra a raiz configurada antes de qualquer leitura — nome vindo de fora é o caminho
> clássico de travessia de diretório, e `chaveArmazenamento` está na lista de campos que a auditoria
> nunca registra.

## Tarefas agendadas

**pg-boss** — fila e agendador sobre o próprio PostgreSQL. Evita introduzir Redis só para três rotinas:

| Tarefa | Frequência | Referência |
|---|---|---|
| Geração do consolidado diário | Diária (padrão 23h) | RF033 |
| Alerta de pendências | Diária (padrão 20h) | RF026 |
| Processamento da fila de notificações | A cada 5 min | RF027 |
| Expurgo por retenção | Semanal | RNF007 |
| Limpeza de sessões expiradas | Diária | RN007 |

## Integrações

| Integração | Abordagem | Isolamento |
|---|---|---|
| **WhatsApp** ⚠️ *V-05* | Interface `NotificadorWhatsApp` em [`whatsapp.ts`](../src/modulos/notificacao/whatsapp.ts): `NotificadorPorLink` (V-05a, padrão) e `NotificadorPorCloudApi` (V-05b, escrito e **não exercitado** contra a Meta) | A troca é a variável `WHATSAPP_CANAL`. Nenhum caso de uso e nenhuma tela mudam |
| **Mapas** ⚠️ *V-06* | MapLibre GL + tiles OpenStreetMap; geocodificação reversa sob demanda com cache | Componente único `<MapaTrajeto>`; troca de provedor não afeta telas |
| **Excel** | ExcelJS no servidor, gerando `.xlsx` nativo | Serviço `PlanilhaService` com um construtor por tipo de relatório |
| **Microsoft** ⚠️ *V-04* | Fora do escopo além do formato `.xlsx` | — |

Toda integração externa tem tempo limite, número máximo de tentativas e **degradação controlada**:
falha externa nunca impede o registro operacional (RNF015).

## Infraestrutura

Ambiente único de produção + ambiente de homologação, ambos em contêineres:

```
Internet
   │  HTTPS (Let's Encrypt, renovação automática)
   ▼
[ Nginx / Caddy ]  reverse proxy · TLS · rate limit básico · compressão
   ▼
[ App Next.js ]    contêiner Node 22
   ▼
[ PostgreSQL 16 ]  contêiner com volume persistente
[ Storage ]        volume de arquivos
[ Backup ]         pg_dump diário + cópia externa
```

Recurso inicial sugerido: **2 vCPU, 4 GB RAM, 60 GB SSD** — folgado para 60 usuários e com margem
para o crescimento de RNF016.

## Deploy

- Repositório Git com branches `main` (produção) e `develop` (homologação).
- Pipeline: lint → verificação de tipos → testes → build → imagem Docker → deploy.
- Migrações de banco aplicadas no deploy, com backup automático imediatamente antes.
- Variáveis de ambiente injetadas pelo ambiente, nunca versionadas (RNF005).
- `/api/health` verificando aplicação e banco, consumido pelo monitoramento externo.
- Rollback pela imagem anterior; migrações escritas de forma compatível com a versão anterior
  (adicionar coluna antes de usá-la, remover só depois).

## Decisões arquiteturais registradas

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| AD-1 | Monólito modular Next.js | Backend separado (NestJS) + SPA | Um único deploy, um único repositório, tipos compartilhados; separar traria custo de operação sem benefício nesta escala |
| AD-2 | Sessão em banco, implementada no projeto | JWT autocontido; Auth.js com credenciais | Revogação imediata ao bloquear usuário (RN006) — o Auth.js só oferece JWT com credenciais |
| AD-8 | `APP_AMBIENTE` separado de `NODE_ENV` | Usar `NODE_ENV` para detectar produção | `next build` roda como `production` também na máquina do desenvolvedor e na CI; amarrar as verificações estritas a ele barraria todo build local |
| AD-3 | pg-boss sobre PostgreSQL | Redis + BullMQ | Evita um serviço a mais para 5 rotinas |
| AD-4 | PWA | Aplicativo nativo | Sem custo de loja, atualização instantânea, atende o que foi pedido |
| AD-5 | MapLibre + OSM | Google Maps | Sem chave de faturamento nem custo por carregamento; precisão suficiente para exibir pontos |
| AD-6 | Totais persistidos | Agregação em tempo de consulta | Desempenho e imutabilidade do consolidado |
| AD-7 | Auditoria em ponto único de escrita | Triggers no banco | Contexto do usuário e justificativa só existem na aplicação |
| AD-9 | Agendador em **processo separado** (`npm run agendador`) | `instrumentation.ts` dentro do servidor Next | O servidor do Next reinicia a cada alteração em desenvolvimento e pode subir replicado em produção — o consolidado sairia N vezes. Também evita o pg-boss manter o Neon acordado durante o desenvolvimento |
| AD-10 | Modo `sistema` no `definirAcao` | Rotina agendada escrevendo direto pelo repositório | Mantém a regra 3 do projeto (*toda mutação passa pelo wrapper*) quando não há sessão: a tarefa herda transação e auditoria, com `usuarioId` nulo representando "sistema" |
