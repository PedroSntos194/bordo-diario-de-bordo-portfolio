# 24 · Implantação e operação

Runbook de produção (**US046** · RNF002, RNF013, RNF014, RNF018). Este documento
é escrito para ser lido às duas da manhã, com o sistema fora do ar e pressa: os
comandos vêm inteiros, na ordem, sem exigir que se leia o resto antes.

> ⚠️ **Nada aqui foi executado contra uma infraestrutura real.** Os artefatos
> foram escritos, revisados e validados até onde a máquina de desenvolvimento
> permite — ver a seção 9, que diz exatamente o que foi verificado e o que não
> foi. A primeira execução precisa acontecer acompanhada.

---

## 1. O que sobe

Cinco contêineres, uma imagem para dois processos:

```
                       Internet
                          │  443
                    ┌─────▼─────┐
                    │   caddy   │  TLS automático · proxy reverso
                    └─────┬─────┘
                          │  3000
   ┌──────────────┬───────▼───────┐
   │  agendador   │      app      │  mesma imagem, comandos diferentes
   └──────┬───────┴───────┬───────┘
          │               │  5432
          └───────┬───────┘
             ┌────▼────┐        ┌─────────┐
             │  banco  │◄───────│ backup  │  pg_dump diário
             └─────────┘        └─────────┘
```

`app` e `agendador` são **o mesmo artefato**, o que garante que nunca fiquem em
versões diferentes. O agendador roda em processo separado por decisão registrada
(**AD-9**): o servidor do Next reinicia a cada alteração e pode subir replicado,
e a planilha do dia sairia mais de uma vez.

Rede: `banco` e `backup` ficam numa rede fechada, sem rota para a internet nem
vinda dela. `app` e `agendador` ficam nas duas — precisam **sair** para a
geocodificação e para o WhatsApp. A porta do PostgreSQL nunca é publicada.

---

## 2. Antes da primeira subida

| Pré-requisito | Como confirmar |
|---|---|
| Servidor com Docker e Compose v2 | `docker compose version` |
| **DNS já apontando** para o IP do servidor | `dig +short bordo.exemplo.com.br` |
| Portas 80 e 443 abertas | O desafio da Let's Encrypt usa a 80 |
| 2 vCPU · 4 GB · 60 GB SSD | Recomendação do doc 13 para 60 usuários |

O DNS é o único que **precisa** estar pronto antes: sem ele, a emissão do
certificado falha em laço e o Caddy fica reiniciando.

```bash
git clone <url-do-repositorio> bordo
cd bordo
cp .env.producao.example .env.producao
chmod 600 .env.producao
```

Preencha `.env.producao`. Os dois segredos:

```bash
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -base64 48   # SESSAO_SECRET
```

---

## 3. Primeira subida

```bash
docker compose --env-file .env.producao build
docker compose --env-file .env.producao up -d banco
docker compose --env-file .env.producao run --rm migrador
docker compose --env-file .env.producao up -d
```

A ordem importa: o banco precisa estar de pé e saudável antes da migração, e a
migração antes da aplicação. `migrador` está no perfil `manutencao` justamente
para **não** subir sozinho junto com o resto.

Criar o administrador inicial:

```bash
docker compose --env-file .env.producao run --rm \
  -e SEED_ADMIN_CPF -e SEED_ADMIN_NOME -e SEED_ADMIN_TELEFONE \
  migrador npx tsx prisma/seed.ts
```

A senha é gerada aleatoriamente e **impressa uma única vez**. Entregue por canal
seguro — nunca pelo mesmo WhatsApp que o sistema usa. A troca é obrigatória no
primeiro acesso.

> Se o seed avisar que o telefone é de exemplo, corrija o cadastro em
> **Usuários** antes do go-live: sem número discável, o resumo do dia não tem
> destinatário (RF025).

Conferir:

```bash
curl -fsS https://bordo.exemplo.com.br/api/health
docker compose --env-file .env.producao ps
```

O health check responde `{"status":"ok","banco":"ok",...}`. Todos os serviços
devem aparecer como `running`, e `app` como `healthy`.

---

## 4. Publicar uma versão nova

```bash
cd bordo
git fetch --tags && git checkout v1.1.0

# 1 · backup ANTES da migração (doc 13)
docker compose --env-file .env.producao exec backup /usr/local/bin/backup.sh

# 2 · construir a versão nova
VERSAO=1.1.0 docker compose --env-file .env.producao build

# 3 · migrar
VERSAO=1.1.0 docker compose --env-file .env.producao run --rm migrador

# 4 · trocar a aplicação e o agendador
VERSAO=1.1.0 docker compose --env-file .env.producao up -d app agendador

# 5 · conferir
curl -fsS https://bordo.exemplo.com.br/api/health
docker compose --env-file .env.producao logs --tail=50 app agendador
```

Atualize também `VERSAO=` dentro de `.env.producao`, senão o próximo comando sem
a variável na frente volta para a etiqueta antiga.

---

## 5. Voltar atrás

Rollback é **da imagem**, não do banco:

```bash
VERSAO=1.0.0 docker compose --env-file .env.producao up -d app agendador
```

Isso funciona porque as migrações são escritas de forma compatível com a versão
anterior — acrescentar coluna antes de usá-la, remover só depois (doc 13). É uma
disciplina de quem escreve a migração, não uma garantia do sistema: uma migração
destrutiva torna o rollback impossível sem restaurar backup.

Se a migração for o problema, o caminho é a seção 6, não este.

---

## 6. Cópias de segurança

O serviço `backup` roda `pg_dump` a cada 24 h, guarda em formato custom
comprimido e expurga o que passar de `BACKUP_RETENCAO_DIAS`.

```bash
docker compose --env-file .env.producao exec backup ls -lh /backups
docker compose --env-file .env.producao logs --tail=20 backup
```

### Replicar para fora do servidor

O volume local **não é backup suficiente**: um servidor perdido leva junto o
banco e as cópias. Configure uma sincronização para destino externo — o script
avisa sobre isso a cada execução, de propósito.

```bash
# Exemplo com rclone para um bucket; adapte ao destino escolhido.
0 4 * * * rclone sync /var/lib/docker/volumes/bordo_copias-de-seguranca/_data remoto:bordo-backups
```

### Ensaio de restauração — mensal, obrigatório

O critério da US046 é *restauração testada*. Cópia nunca restaurada é suposição.
O ensaio usa um banco descartável e **não toca** em produção:

```bash
docker compose --env-file .env.producao run --rm \
  -e ALVO=bordo_ensaio backup \
  /usr/local/bin/restaurar.sh /backups/bordo_2026-08-26_0300.dump
```

Ao final o script imprime a contagem de usuários, jornadas, corridas e registros
de auditoria. Confira contra a produção; números muito diferentes significam
cópia velha ou incompleta. Depois, descarte:

```bash
docker compose --env-file .env.producao exec banco \
  psql -U bordo -d postgres -c 'DROP DATABASE bordo_ensaio;'
```

### Restauração real

```bash
docker compose --env-file .env.producao stop app agendador
docker compose --env-file .env.producao run --rm \
  -e ALVO=bordo -e CONFIRMO=sim backup \
  /usr/local/bin/restaurar.sh /backups/bordo_2026-08-26_0300.dump
docker compose --env-file .env.producao start app agendador
```

Parar a aplicação e o agendador antes é **obrigatório**: restaurar por baixo de
processos que estão escrevendo produz um estado que não corresponde a nenhum
instante real. O `CONFIRMO=sim` existe para que um comando repetido do histórico
do shell não apague o banco.

---

## 7. Monitoramento

`GET /api/health` é público e verifica aplicação **e** banco:

```json
{ "status": "ok", "banco": "ok", "versao": "1.0.0", "horario": "…" }
```

| O quê | Como | Alerta |
|---|---|---|
| Disponibilidade | Serviço externo consultando `/api/health` a cada minuto | 2 falhas seguidas |
| Certificado | O mesmo serviço, avisando 14 dias antes do vencimento | 14 dias |
| Contêineres | `docker compose ps` — `app` precisa estar `healthy` | fora de `running` |
| Espaço em disco | O banco e as planilhas crescem juntos | acima de 80 % |
| Backup | Idade do arquivo mais recente em `/backups` | mais de 26 h |

O último é o que mais falha na prática: o backup para de rodar, ninguém percebe,
e a descoberta acontece no dia do incidente.

O log sai em JSON no `stdout` de cada contêiner (RNF018), pronto para qualquer
coletor. Nada de senha, token, CPF completo ou coordenada entra nele — a proteção
está em `src/lib/logger.ts` e não depende de disciplina de quem escreve o log.

---

## 8. Diagnóstico rápido

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Caddy reiniciando, sem certificado | DNS não aponta para o servidor, ou porta 80 fechada | `dig +short $DOMINIO`; conferir o firewall |
| `app` sobe e morre | Variável de ambiente ausente ou inválida | `docker compose logs app` — `src/lib/env.ts` diz qual chave falhou |
| Interface carrega mas nenhum botão funciona | CSP sem nonce | Conferir se `middleware.ts` está ativo; foi o defeito da Sprint 0 |
| Consolidado do dia não aparece | Agendador parado | `docker compose logs agendador`; forçar com `run --rm agendador node agendador.mjs --agora` |
| Download responde 410 | Registro no banco sem o binário no disco | Conferir se o volume `arquivos-gerados` está montado nos **dois** serviços |
| Resumo do WhatsApp sem destinatário | Nenhum administrador com telefone discável | Corrigir o cadastro em **Usuários** |
| Data aparecendo um dia antes | Regressão do defeito da Sprint 5 | Conferir `TZ` nos contêineres e o uso de `formatarDataOperacional` |

---

## 9. O que foi verificado, e o que não foi

Honestidade sobre o alcance dos testes, porque isso muda o risco da primeira
subida.

**Verificado nesta máquina:**

- O `standalone` do Next foi montado no **layout exato** que o Dockerfile produz
  — `server.js`, `node_modules`, `.next/static`, `public` — e o servidor subiu
  com as variáveis injetadas, **sem nenhum `.env`**. Respondeu `/api/health`
  com `banco: ok`, serviu página, JS, CSS e o manifest, e devolveu CSP com
  nonce, HSTS e X-Frame-Options.
- O agendador empacotado (`dist/agendador.mjs`) executou nos dois modos: geração
  única (`--agora`) e residente, registrando o cron no fuso da operação.
- `docker-compose.yml` teve a sintaxe e a estrutura validadas (âncoras, redes,
  volumes, comandos).
- `backup.sh` e `restaurar.sh` passaram na verificação de sintaxe do shell.

**Verificado em 29/08/2026, na rodada de fechamento:**

- **O ensaio de restauração aconteceu de verdade** e fecha o critério
  "restauração testada" da US046. Instalado o PostgreSQL 16.15 — a mesma versão
  do banco gerenciado —, rodaram os **scripts reais**, não uma reimplementação:
  - `backup.sh` contra o banco de produção-espelho: dump de 134 KB em formato
    custom, aprovado na verificação de integridade e na varredura de retenção;
  - `restaurar.sh` para um banco limpo: 22 tabelas, 2 usuários, 2 jornadas,
    3 corridas e 197 registros de auditoria — idêntico à origem;
  - **a aplicação subiu contra o banco restaurado**, autenticou com o hash
    Argon2 vindo do backup e leu os dados operacionais. É a prova de que a
    cópia é *funcional*, não só de que as linhas voltaram;
  - as duas travas foram exercitadas: recusa de sobrescrever o banco em uso sem
    `CONFIRMO=sim`, e recusa de dump corrompido antes de tocar em qualquer coisa.
- **O `docker compose` foi validado por inteiro** com `docker compose config`,
  que não precisa do daemon: âncoras resolvidas, `DATABASE_URL` composta,
  `migrador` acessível pelo perfil `manutencao`, rede `interna` fechada, e as
  variáveis obrigatórias falhando com a mensagem certa quando ausentes.
- **O `standalone` foi remontado no layout exato do Dockerfile** — quatro
  sprints depois da primeira verificação — e executado **sem nenhum `.env`**:
  respondeu `/api/health` com `banco: ok`, serviu com CSP por nonce e HSTS,
  **gerou e serviu um `.xlsx` de verdade**, e o agendador empacotado processou a
  fila de exportações.
- **O vazamento de `.env` que o Dockerfile previne foi confirmado como real:**
  a build local reproduziu `next build` copiando o `.env` para dentro de
  `.next/standalone/`. As duas defesas cobrem o caso — o `.dockerignore` impede
  que ele chegue ao contexto, e o `rm -f .env` do estágio final apaga o caminho
  exato onde ele cairia.

**Verificado em 23/09/2026 — a imagem foi construída e executada.**

Com a virtualização habilitada na BIOS, o que faltava foi feito:

- **`docker build` concluiu**: `bordo:1.0.0`, **390 MB**, os quatro estágios
  (`dependencias`, `construcao`, `migrador`, `producao`) sem erro.
- **Nenhum segredo de build chegou à imagem final.** O `docker build` emite o
  aviso `SecretsUsedInArgOrEnv` por causa do `ENV SESSAO_SECRET` da linha 49, e
  ele é **falso positivo**: aquele `ENV` vive no estágio `construcao`, que é
  descartado. Conferido em vez de presumido — `docker inspect` mostra só
  `NODE_ENV`, `NEXT_TELEMETRY_DISABLED`, `TZ`, `PORT` e `HOSTNAME`, e não existe
  `.env` dentro de `/app`.
- **A pilha subiu inteira**: `banco` saudável, `migrador` aplicou as cinco
  migrações num banco do zero, `app` ficou *healthy* pelo `HEALTHCHECK` do
  próprio Dockerfile, `agendador` registrou as **cinco filas** — incluindo
  `exportacoes-em-segundo-plano` — no fuso da operação, e o `backup` gerou um
  dump de 67 KB no volume **logo na subida**, sem esperar as 24 h do laço.
- **O Argon2 nativo resolveu no Alpine**, que era o risco real do
  `libc6-compat`: o login pela aplicação em contêiner autenticou e encaminhou
  para a troca de senha obrigatória, conferido também pelo navegador.
- **A rede `interna` fechada funcionou**: o banco não publica porta nenhuma, e
  a aplicação o alcança pelo nome do serviço.

**NÃO verificado — precisa acontecer acompanhado:**

- **A emissão do certificado e o Caddy**, que dependem de domínio real (V-02).
  O ensaio local subiu sem o Caddy, publicando a porta da aplicação por uma
  sobreposição de compose — sem domínio não há como emitir certificado, e
  tentar queima cota na Let's Encrypt.
- **O alerta de indisponibilidade**, que depende do serviço de monitoramento
  escolhido.

---

## 10. O que ainda falta para o go-live

| Item | Depende de |
|---|---|
| Servidor provisionado e domínio registrado | **V-02** — quem contrata e paga. O provisionamento em si está automatizado em [`scripts/provisionar.sh`](../scripts/provisionar.sh) |
| Serviço de monitoramento contratado e alertando | V-02 |
| Roteiro de homologação aprovado pelo cliente | Executado com o cliente; não incluído nesta versão de portfólio |
| Base legal decidida e aviso validado juridicamente | **V-09** — o inventário e as dez decisões estão em [`26-lgpd-base-legal.md`](26-lgpd-base-legal.md) |
| Decisão sobre o canal de WhatsApp | **V-05** — a oficial leva semanas na Meta |

> ~~Ensaio de restauração executado~~ — **feito em 29/08/2026**, com os scripts
> reais e a aplicação subindo contra o banco restaurado.
>
> ~~Imagem construída e executada~~ — **feita em 23/09/2026**: `bordo:1.0.0`,
> 390 MB, com a pilha inteira de pé e o login funcionando em contêiner.
>
> Ambas na seção 9.
