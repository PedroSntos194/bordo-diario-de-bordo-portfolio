# =============================================================================
# Bordo — imagem de produção (US046 · doc 13)
#
# Evolução do Dockerfile da Sprint 0. O que mudou: o **agendador** (AD-9) passou
# a existir e precisa viajar na mesma imagem, e as migrações ganharam um estágio
# próprio, já que a CLI do Prisma é dependência de desenvolvimento e não existe
# na imagem final.
#
# Uma imagem, dois processos — o que garante que nunca fiquem em versões
# diferentes:
#
#   aplicação : node server.js
#   agendador : node agendador.mjs
#
# Construir:  docker build -t bordo:1.0.0 .
# =============================================================================

ARG NODE_VERSION=22-alpine

# --- dependências ------------------------------------------------------------
FROM node:${NODE_VERSION} AS dependencias
WORKDIR /app

# `libc6-compat` é o que permite os módulos nativos — `@node-rs/argon2`, que faz
# o hash das senhas — resolverem seus binários no Alpine, que usa musl.
RUN apk add --no-cache libc6-compat

# Só o manifesto primeiro: enquanto ele não mudar, o Docker reaproveita a camada
# de instalação, que é de longe a mais cara.
COPY package.json package-lock.json ./
RUN npm ci

# --- build -------------------------------------------------------------------
FROM node:${NODE_VERSION} AS construcao
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY --from=dependencias /app/node_modules ./node_modules
COPY . .

# O cliente do Prisma é gerado para a plataforma da imagem, não para a máquina
# de quem construiu — por isso nasce aqui dentro e não é copiado.
RUN npx prisma generate

# `next build` precisa das variáveis validadas por `src/lib/env.ts`, senão a
# aplicação não sobe nem para ser compilada. Os valores abaixo são de
# construção, descartáveis: nenhum deles chega à imagem final, e
# `APP_AMBIENTE=local` mantém as verificações estritas fora do build (AD-8).
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    APP_AMBIENTE=local \
    APP_URL=http://localhost:3000 \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    SESSAO_SECRET=segredo-usado-apenas-durante-o-build-desta-imagem

RUN npm run build && npm run build:agendador

# --- migração ----------------------------------------------------------------
# Estágio próprio porque a CLI do Prisma é dependência de desenvolvimento. As
# migrações são aplicadas como passo deliberado do deploy, com backup
# imediatamente antes (doc 13), nunca na subida do contêiner: a aplicação pode
# ter mais de uma réplica, e duas migrando ao mesmo tempo é problema garantido.
FROM construcao AS migrador
WORKDIR /app
CMD ["npx", "prisma", "migrate", "deploy"]

# --- execução ----------------------------------------------------------------
FROM node:${NODE_VERSION} AS producao
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=America/Sao_Paulo \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 bordo

# `output: 'standalone'` traz o `server.js` e apenas os `node_modules` que a
# aplicação realmente usa. `.next/static` e `public` ficam de fora dele por
# design e precisam ser copiados à parte.
COPY --from=construcao --chown=bordo:nodejs /app/.next/standalone ./
COPY --from=construcao --chown=bordo:nodejs /app/.next/static ./.next/static
COPY --from=construcao --chown=bordo:nodejs /app/public ./public

# O esquema e as migrações acompanham a imagem para conferência — quem as
# **aplica** é o estágio `migrador`, que tem a CLI.
COPY --from=construcao --chown=bordo:nodejs /app/prisma ./prisma

# O agendador é um bundle único: ele não faz parte do grafo de importação da
# aplicação, então o rastreamento do `standalone` não o alcançaria. `pg-boss` vai
# embutido; `@prisma/client` fica externo e é resolvido dos `node_modules` acima.
COPY --from=construcao --chown=bordo:nodejs /app/dist/agendador.mjs ./agendador.mjs

# Segunda linha de defesa contra vazamento de segredo.
#
# O `.dockerignore` já mantém o `.env` fora do contexto de build — essa é a
# defesa principal e existe desde a Sprint 0. Este `rm` cobre o caso de alguém
# afrouxar aquele arquivo sem perceber a consequência: `next build` com
# `output: 'standalone'` **copia o `.env` para dentro de `.next/standalone/`**,
# e o `COPY` acima o traria junto, assando a senha do banco numa camada da
# imagem (doc 17).
RUN rm -f .env .env.local .env.production .env.producao

# Arquivos gerados ficam fora da imagem e fora da pasta pública (doc 17). Em
# produção este caminho recebe um volume nomeado — sem ele, cada deploy apagaria
# as planilhas, e planilha gerada é registro rastreável (RN030).
RUN mkdir -p /dados/storage && chown -R bordo:nodejs /dados

USER bordo
EXPOSE 3000

# Health check sem `curl`: usar o Node que já está na imagem evita instalar um
# pacote a mais só para isto — menos superfície, imagem menor.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
