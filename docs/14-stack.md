# 14 · Stack tecnológica

Critério de escolha, nesta ordem: **custo total para o cliente** → **simplicidade de operação** →
**disponibilidade de mão de obra** → maturidade. Popularidade isolada não foi critério.

---

## Base

### TypeScript
**Para quê:** toda a aplicação, do banco à interface.
**Por que é adequado:** o requisito de auditoria e cálculo de quilometragem não tolera erro de tipo
silencioso; com Prisma e Zod, o tipo do banco chega tipado até o componente.
**Alternativas:** JavaScript puro (mais barato de começar, mais caro de manter); Python/Django
(excelente para o admin, porém sem tipos compartilhados com o frontend e sem PWA integrada).

### Next.js 15 (App Router) + React 19
**Para quê:** frontend do motorista, painel administrativo e backend HTTP no mesmo projeto.
**Por que é adequado:** um repositório e um deploy para dois públicos muito diferentes; Server
Components reduzem o JavaScript no celular (RNF011); Server Actions eliminam a camada de API
manual nos formulários; suporte nativo a PWA.
**Alternativas:** React + Vite com backend NestJS separado (mais flexível, dois deploys, dois
repositórios, contratos manuais); Remix (equivalente, ecossistema menor); Laravel + Livewire
(ótimo custo-benefício, mas fora do ecossistema TypeScript).

### Node.js 22 LTS
**Para quê:** runtime do servidor.
**Por que é adequado:** LTS com suporte longo, compatível com todo o restante da stack.
**Alternativas:** Bun (mais rápido, menos maduro em produção para este perfil de cliente).

---

## Dados

### PostgreSQL 16
**Para quê:** banco de dados único — operação, auditoria, fila de tarefas.
**Por que é adequado:** gratuito, maduro, com `jsonb` (ideal para o "valor anterior × valor novo" da
auditoria), índices parciais (essenciais para as regras RN012/RN013/RN014), constraints fortes e
suporte a particionamento quando a auditoria crescer.
**Alternativas:** MySQL/MariaDB (sem `jsonb` equivalente e sem índice parcial); SQLite (inviável com
escrita concorrente); MongoDB (dispensável — o domínio é fortemente relacional).

### Prisma ORM
**Para quê:** acesso a dados e migrações versionadas.
**Por que é adequado:** consultas parametrizadas por padrão (mitiga SQL Injection — RNF003), tipos
gerados a partir do esquema, migrações rastreadas no repositório.
**Alternativas:** Drizzle (mais próximo do SQL, mais leve, ecossistema menor); Knex ou SQL puro
(mais controle, muito mais código para manter).

---

## Autenticação e segurança

### Camada de sessão própria (`src/lib/sessao.ts`)
**Para quê:** login por CPF e senha, sessão e proteção de rotas.

> **Revisado na Sprint 0.** A escolha original era **Auth.js (NextAuth v5)**. Ao implementar,
> confirmou-se que o Auth.js **não suporta sessão em banco com o provedor de credenciais** — só
> JWT. Um JWT válido continua sendo aceito depois de o usuário ser bloqueado, o que contraria a
> RN006. Como a alternativa era carregar a biblioteca e ainda assim escrever a revogação por fora,
> optou-se pela implementação direta.

**Por que é adequado:** token opaco de 256 bits, apenas o SHA-256 no banco, revogação imediata por
`DELETE` na tabela `sessao`, e nenhuma dependência de autenticação para acompanhar em atualizações.
São ~150 linhas de código auditável, sem criptografia própria — só `randomBytes` e `sha256` da
biblioteca padrão do Node.
**Alternativas:** Auth.js com JWT + lista de revogação (mesma complexidade, mais uma dependência);
Clerk/Auth0 (excelentes, com custo mensal por usuário e dependência externa — desproporcional para
uso interno); Lucia (descontinuada como biblioteca em 2025).
**Se o V-04 evoluir para SSO Microsoft**, o Auth.js volta a ser a escolha natural para o provedor
OIDC, convivendo com a sessão própria.

### Argon2id (`@node-rs/argon2`)
**Para quê:** hash de senha (RNF001).
**Por que é adequado:** vencedor da Password Hashing Competition, resistente a GPU.
**Alternativas:** bcrypt (aceitável, amplamente suportado); nunca SHA/MD5.

### Zod
**Para quê:** validação de entrada compartilhada entre cliente e servidor.
**Por que é adequado:** um único esquema define validação, mensagem de erro e tipo TypeScript,
eliminando divergência entre as validações das duas pontas.
**Alternativas:** Yup, Valibot (menor, ecossistema mais restrito).

---

## Interface

### Tailwind CSS + shadcn/ui
**Para quê:** estilos e biblioteca de componentes.
**Por que é adequado:** o estilo pedido é "minimalista e simples" — shadcn entrega componentes
acessíveis (Radix por baixo, atendendo RNF022) que ficam **dentro do repositório**, então podem ser
ajustados à identidade visual sem lutar contra o tema da biblioteca.
**Alternativas:** MUI (visual mais opinativo, pacote maior); Chakra; CSS Modules puro (mais trabalho
para acessibilidade).

### Lucide React
**Para quê:** ícones. Conjunto consistente, sem peso relevante.

### TanStack Query
**Para quê:** cache e revalidação nas telas com dados vivos (dashboard, corrida em andamento) e
suporte à fila offline.
**Alternativas:** SWR (mais simples, menos recursos de mutação offline).

---

## Recursos específicos do produto

### ExcelJS
**Para quê:** geração dos arquivos `.xlsx` (RF032, RF033) e leitura na importação (RF035).
**Por que é adequado:** gera `.xlsx` nativo com formatação (cabeçalho congelado, largura de coluna,
tipos de célula), o que importa porque o entregável do cliente **é** a planilha.
**Alternativas:** SheetJS/xlsx (leitura excelente; versão gratuita mais limitada em formatação);
CSV puro (perderia formatação e tipos, e o cliente pediu Excel explicitamente).

### MapLibre GL JS + tiles OpenStreetMap
**Para quê:** exibir os pontos e o trajeto (RF034) e selecionar coordenadas dos pontos de parada (RF012).
**Por que é adequado:** biblioteca livre, sem chave nem custo por carregamento — relevante num
sistema interno cuja necessidade é "mostrar onde a van esteve", não navegação assistida.
**Alternativas:** Google Maps (melhor geocodificação e imagens, exige conta de faturamento e custo
por mil carregamentos); Leaflet (mais simples, sem renderização vetorial); Mapbox (bom, pago).
⚠️ *V-06 — se o cliente exigir precisão de endereço nível Google, a alternativa paga precisa ser
avaliada com o custo mensal estimado.*

> **Nota da Sprint 3.** O estilo do mapa é **raster declarado em linha**, apontando direto para os
> tiles do OSM. Sem isso o MapLibre buscaria um JSON de estilo em servidor externo, que a CSP
> bloqueia. A consequência é que a renderização vetorial — a vantagem do MapLibre sobre o Leaflet —
> não está em uso; se num futuro o peso da biblioteca incomodar, trocar por Leaflet é uma decisão
> defensável, isolada no componente `SeletorCoordenada`.
>
> A biblioteca é carregada **sob demanda** (`import()` dentro do efeito): ela não entra no pacote
> da área do motorista, que se manteve em ~106 kB.
>
> **Nota da Sprint 8.** O host dos tiles precisa estar em **`connect-src`**, não apenas em
> `img-src`: o MapLibre busca cada tile pela Fetch API para manipular o bitmap, e não por `<img>`.
> Com o host liberado só em `img-src`, o mapa sobe, desenha marcadores e fica com o fundo cinza —
> falha silenciosa que passou despercebida desde a Sprint 3.

### Geocodificação: sempre pelo servidor
A consulta ao Nominatim passa por `/api/geocodificacao`, nunca direto do navegador. A política de
uso do provedor exige um `User-Agent` identificável, que o navegador não deixa definir; além disso,
o cache no servidor faz sessenta pessoas procurando o mesmo terminal gerarem **uma** consulta.

### Serviço de geocodificação reversa
**Para quê:** converter coordenadas em endereço aproximado nos relatórios.
**Proposta:** Nominatim (OSM) com cache local por coordenada arredondada, respeitando o limite de uso.
**Alternativas:** Google Geocoding, LocationIQ, Photon (todas pagas acima de um volume baixo).

### pg-boss
**Para quê:** agendamento e fila (consolidado diário, alertas, notificações, expurgo).
**Por que é adequado:** roda sobre o PostgreSQL já existente — zero serviço adicional para manter.
**Alternativas:** BullMQ + Redis (mais recursos, mais um serviço); cron do sistema operacional
(sem visibilidade, sem repetição controlada, sem histórico).

### WhatsApp ⚠️ *V-05*
**MVP — link `wa.me` / Web Share API:** custo zero, sem aprovação, sem dependência de terceiro; o
envio é confirmado pelo usuário.
**Evolução — WhatsApp Cloud API (Meta):** envio automático; exige Meta Business verificado, número
dedicado, templates aprovados e custo por conversa.
**Alternativas para a evolução:** Twilio, 360dialog, Infobip (todos revendem a API oficial com
margem, em troca de integração mais simples).
**Não recomendado:** bibliotecas não oficiais que automatizam o WhatsApp Web — violam os Termos de
Uso e podem resultar em banimento do número da empresa.

### E-mail
Fora do escopo por decisão do cliente. Caso V-07 mude, a recomendação é **Resend** ou **Amazon SES**
(baixo custo por volume), com a mesma interface de notificação já existente.

---

## Qualidade

| Ferramenta | Uso |
|---|---|
| **Vitest** | Testes unitários das regras de negócio e utilitários |
| **Testing Library** | Testes de componentes e comportamento de tela |
| **Playwright** | Testes ponta a ponta dos fluxos críticos, incluindo emulação de celular e de GPS |
| **ESLint + Prettier** | Padronização automática, verificada no pipeline |
| **TypeScript strict** | Verificação de tipos como etapa obrigatória do build |
| **Testcontainers** *(opcional)* | Banco real e descartável nos testes de integração |

**Alternativas:** Jest (equivalente ao Vitest, mais lento neste ecossistema); Cypress (alternativa ao
Playwright, sem emulação de dispositivo tão completa).

---

## Infraestrutura e hospedagem ⚠️ *V-01, V-02*

| Item | Proposta | Alternativas |
|---|---|---|
| **Servidor** | VPS Linux 2 vCPU / 4 GB (Hetzner, DigitalOcean, Contabo, Magalu Cloud) | Vercel + Neon (deploy trivial, custo em dólar e dependência de terceiros); servidor próprio na empresa (sem custo recorrente, exige TI interna e link estável) |
| **Contêineres** | Docker + Docker Compose | Deploy direto com PM2 (mais simples, menos reprodutível) |
| **Proxy e TLS** | Caddy (HTTPS automático) | Nginx + Certbot |
| **Banco** | PostgreSQL no mesmo servidor, volume dedicado | Banco gerenciado (Neon, RDS, Supabase) — menos operação, mais custo |
| **Arquivos** | Volume local com abstração de storage | MinIO ou S3 quando houver mais de uma instância |
| **Backup** | `pg_dump` diário + cópia externa (Backblaze B2 ou S3) | Snapshot do provedor (mais caro, restauração menos granular) |
| **Monitoramento** | Uptime Kuma + logs estruturados | Sentry para erros de aplicação (plano gratuito atende) |

**Custo mensal estimado da infraestrutura:** faixa de **R$ 60 a R$ 250**, conforme provedor e se o
banco será autogerenciado ou gerenciado. Não inclui WhatsApp Cloud API, caso V-05 evolua para a
opção (b). ⚠️ *Estimativa preliminar, a confirmar na definição de V-02.*

---

## O que foi deliberadamente descartado

| Tecnologia | Por que não |
|---|---|
| Kubernetes | Um contêiner de aplicação e um de banco não justificam orquestração |
| Microsserviços | Domínio único, equipe pequena — só acrescentaria latência e complexidade |
| GraphQL | Consumidor único e telas conhecidas; REST + Server Actions bastam |
| Redis | Nada no projeto exige cache distribuído nesta escala |
| React Native / Flutter | PWA atende ao pedido, sem custo de loja e sem ciclo de publicação |
| Firebase | Traria dependência de nuvem estrangeira e modelo de dados não relacional para um domínio relacional |
| Data warehouse / BI dedicado | O cliente pediu Excel; Power BI só entra se V-04 apontar nessa direção |
