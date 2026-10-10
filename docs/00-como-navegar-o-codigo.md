# 00 · Como navegar o código

Documento de orientação: o que é cada pasta, por onde uma requisição passa e onde mexer quando
você quiser mudar alguma coisa. Se você está abrindo este projeto pela primeira vez, comece aqui.

---

## 1. Onde está o backend

**Não existe pasta `backend/`** — e isso é intencional.

Este projeto é um **monólito modular** em Next.js: backend e frontend vivem na mesma árvore de
arquivos. O que define se um código roda no servidor não é a pasta, é o tipo do arquivo e onde ele
é importado.

| Papel | Onde está | Roda onde |
|---|---|---|
| Rotas HTTP (controllers) | `src/app/api/**/route.ts` | **Servidor** |
| Server Actions (mutações da interface) | `src/modulos/*/​*.acoes.ts` | **Servidor** |
| Casos de uso (services) | `src/modulos/*/​*.servico.ts` | **Servidor** |
| Regras de negócio | `src/modulos/*/​*.regras.ts` | **Servidor** |
| Acesso a dados (repositories) | `src/modulos/*/​*.repositorio.ts` | **Servidor** |
| Validação de entrada | `src/modulos/*/​*.schema.ts` | **Ambos** |
| Sessão, autorização, erros, log | `src/lib/` | **Servidor** |
| Proteção de rota | `src/middleware.ts` | **Servidor (Edge)** |
| Modelo de dados e migrações | `prisma/` | **Servidor** |
| Rotinas agendadas | `src/servidor/agendador.ts` | **Processo próprio** |
| Fila offline, sincronizador e service worker | `src/offline/`, `public/sw.js` | **Navegador** |
| Manifesto e ícones do aplicativo instalável | `public/manifest.webmanifest`, `public/icons/` | **Navegador** |
| Empacotamento e implantação | `Dockerfile`, `docker-compose.yml`, `Caddyfile` | Servidor |
| Telas | `src/app/**/page.tsx` | Servidor, envia HTML |
| Componentes interativos | arquivos com `'use client'` no topo | Navegador |
| Componentes visuais reutilizáveis | `src/componentes/` | Depende do `'use client'` |

> **Por que não separar em dois projetos?** Backend separado é obrigatório quando há vários
> consumidores da mesma API (site + app nativo + parceiros), times distintos ou linguagens
> diferentes. Nada disso existe aqui: um consumidor, uma pessoa, tudo em TypeScript. Separar
> custaria dois deploys, dois pipelines, CORS, autenticação entre origens e contratos mantidos à
> mão — para 60 usuários internos. A decisão está registrada como **AD-1** em
> [`13-arquitetura.md`](13-arquitetura.md).
>
> **E se um dia precisar separar?** As regras de negócio não importam React nem Next: são
> TypeScript puro. Extrair `src/modulos/` e `src/lib/` para um projeto próprio é recorte, não
> reescrita — desde que as regras da seção 5 continuem valendo.

---

## 2. As quatro camadas

O projeto tem a mesma separação de responsabilidades de qualquer backend profissional. Ela só não
está expressa em repositórios diferentes, e sim em **tipos de arquivo diferentes**:

```
┌─────────────────────────────────────────────────────────┐
│ APRESENTAÇÃO      page.tsx · componentes                │  não conhece banco
├─────────────────────────────────────────────────────────┤
│ APLICAÇÃO         *.acoes.ts · *.servico.ts · route.ts  │  orquestra, autoriza, transaciona
├─────────────────────────────────────────────────────────┤
│ DOMÍNIO           *.regras.ts                           │  regras puras, sem framework
├─────────────────────────────────────────────────────────┤
│ INFRAESTRUTURA    *.repositorio.ts · lib/               │  único lugar que fala com o Prisma
└─────────────────────────────────────────────────────────┘
```

A seta só aponta para baixo. Uma tela nunca chama o Prisma; uma regra de negócio nunca sabe que
existe HTTP.

---

## 3. O caminho de uma requisição

Exemplo real: **o motorista toca em "Encerrar corrida"**.

```
 1 · src/app/(autenticado)/app/corrida/[id]/encerrar/page.tsx
     A tela renderiza o formulário.
                        │
 2 · src/modulos/corrida/componentes/FormularioEncerramento.tsx   ('use client')
     Valida no navegador com o schema Zod e chama a Server Action.
                        │
 3 · src/modulos/corrida/corrida.acoes.ts
     Server Action — daqui em diante tudo roda no servidor.
                        │
 4 · src/lib/acao-segura.ts          ◄── PONTO CENTRAL DO SISTEMA
     ├─ verifica a sessão                    (401 se não houver)
     ├─ verifica o perfil                    (403 se não bastar)
     ├─ valida a entrada com o mesmo schema  (400 com erro por campo)
     ├─ abre uma transação
     │        │
 5 · │        src/modulos/corrida/corrida.servico.ts
     │        Caso de uso: carrega o estado, chama as regras, grava.
     │                 │
 6 · │                 src/modulos/corrida/corrida.regras.ts
     │                 Função pura: valida odômetro, calcula km e duração.
     │                 Se a regra for violada, lança ErroDeNegocio (422).
     │                 │
 7 · │                 src/modulos/corrida/corrida.repositorio.ts
     │                 Único lugar que chama o Prisma.
     │        │
     ├─ grava a auditoria na MESMA transação  (quem, quando, valor anterior)
     ├─ confirma ou desfaz tudo
     └─ devolve { sucesso: true, dados } ou { sucesso: false, erro }
                        │
 8 · A tela mostra o resultado ou o erro no campo certo.
```

**Se você entender só um arquivo deste projeto, que seja o
[`src/lib/acao-segura.ts`](../src/lib/acao-segura.ts).** Toda mutação passa por ele. É o que faz a
autorização (RF041) e a auditoria (RF037) serem estruturais em vez de dependerem de alguém lembrar
de escrevê-las em cada funcionalidade nova.

---

## 4. Onde mexer para cada tipo de mudança

| Você quer… | Mexa em |
|---|---|
| Mudar um texto, cor ou layout | `src/app/**/page.tsx`, `src/componentes/`, `src/estilos/globals.css` |
| Mudar uma regra de negócio (prazo, limite, cálculo) | `src/modulos/*/​*.regras.ts` — **e o teste correspondente** |
| Adicionar um campo em um cadastro | `prisma/schema.prisma` → migração → `*.schema.ts` → `*.servico.ts` → formulário |
| Criar um endpoint novo | `src/app/api/.../route.ts` chamando uma ação de `*.acoes.ts` |
| Criar uma tela nova | pasta em `src/app/(autenticado)/…` com `page.tsx` |
| Mudar quem pode fazer o quê | [`08-perfis-e-permissoes.md`](08-perfis-e-permissoes.md) → `src/lib/autorizacao.ts` → `*.servico.ts` |
| Mudar uma mensagem de erro | `src/lib/erros.ts` (catálogo em [`18`](18-tratamento-de-erros.md)) |
| Adicionar variável de ambiente | `.env.example` **e** `src/lib/env.ts` — sem os dois, a aplicação não sobe |
| Acrescentar uma ação que funcione sem rede | `sincronizacao.regras.ts` (tipo e estado local) → `sincronizacao.servico.ts` (delegação) → tela `/app/sem-conexao` |
| Mudar prazo/horário configurável | tela de configurações, não código — ver `prisma/seed.ts` |

---

## 5. Regras do projeto

Cinco regras. Elas são o que mantém a arquitetura de pé — e o que deixa a porta aberta para
extrair uma API separada no futuro.

1. **Prisma só dentro de `*.repositorio.ts`.**
   Nenhuma tela, ação ou rota importa o client diretamente.

2. **Regra de negócio só em `*.regras.ts`**, em função pura: sem banco, sem HTTP e sem
   `new Date()` interno — o instante atual entra sempre por parâmetro. É o que permite testar as
   fronteiras de prazo sem depender do relógio.

3. **Toda mutação passa por `definirAcao`.**
   Ninguém escreve no banco fora do wrapper.

4. **Um schema Zod por entrada**, reutilizado no formulário, na Server Action e na rota de API.
   Nunca duplicado — validação divergente entre cliente e servidor é bug garantido.

5. **`src/componentes/` não conhece domínio.**
   Se o componente precisa saber o que é uma "corrida", ele pertence a
   `src/modulos/corrida/componentes/`.

---

## 6. Nomes em português

Pastas, arquivos, funções e variáveis seguem a linguagem do negócio: `jornada`, `corrida`,
`odometroInicial`, `validarEncerramentoDaJornada`. Palavras-chave da linguagem e nomes de
bibliotecas permanecem em inglês, porque não são nossos.

O motivo é rastreabilidade: `validarOdometroDeAbertura` e a regra **RN015** do
[doc 06](06-regras-de-negocio.md) falam a mesma língua, e a conversa com o cliente também. Traduzir
"jornada" para "workday" no código criaria um dicionário mental entre a documentação e a
implementação — e é nesse dicionário que os mal-entendidos moram.

---

## 7. Comandos

```bash
npm run dev          # ambiente de desenvolvimento
npm run verificar    # formatação + lint + tipos + testes (o mesmo que a CI roda)
npm test             # só os testes
npm run seed         # cria o administrador inicial
npx prisma studio    # navegador visual do banco

npm run agendador                       # rotinas agendadas (processo à parte)
npm run agendador -- --agora            # gera o consolidado de hoje e sai
npm run agendador -- --agora=2026-08-23 # reprocessa um dia específico
npm run agendador -- --pendencias       # cobra as pendências de hoje e sai
npm run agendador -- --pendencias=2026-08-28  # cobra um dia específico
npm run agendador -- --expurgo          # aplica a retenção agora e sai
npm run agendador -- --exportacoes      # processa a fila de exportações e sai
```

Utilitários **apenas de desenvolvimento**, para devolver o ambiente a um estado
limpo antes de uma demonstração:

```bash
npx tsx --env-file-if-exists=.env scripts/limpar-jornadas.ts  # jornadas e corridas
npx tsx --env-file-if-exists=.env scripts/limpar-arquivos.ts  # planilhas e notificações
```

Os ícones do aplicativo instalável são **versionados**, e têm fonte: refazê-los
só é preciso quando a marca mudar.

```bash
npx tsx scripts/gerar-icones.ts
```

Para publicar, o runbook é o [`24-implantacao.md`](24-implantacao.md) (contêiner) ou o
[`27-vercel.md`](27-vercel.md) (Vercel + Neon).

> **O agendador é um segundo processo**, não faz parte do `npm run dev`. O porquê está em
> [`src/servidor/agendador.ts`](../src/servidor/agendador.ts) e registrado como **AD-9** no
> [doc 13](13-arquitetura.md): o servidor do Next reinicia a cada alteração e pode subir replicado
> em produção, o que geraria a planilha do dia mais de uma vez.

---

## 8. Por onde começar a ler

Em ordem, para entender o sistema em cerca de meia hora:

1. [`02-visao-do-produto.md`](02-visao-do-produto.md) — que problema isto resolve
2. [`06-regras-de-negocio.md`](06-regras-de-negocio.md) — as regras que o código implementa
3. [`prisma/schema.prisma`](../prisma/schema.prisma) — o modelo de dados, que dita quase tudo
4. [`src/lib/acao-segura.ts`](../src/lib/acao-segura.ts) — o caminho de toda mutação
5. [`src/modulos/jornada/jornada.regras.ts`](../src/modulos/jornada/jornada.regras.ts) — como uma
   regra de negócio se parece na prática
6. [`tests/unitarios/jornada.regras.test.ts`](../tests/unitarios/jornada.regras.test.ts) — e como
   ela é verificada
