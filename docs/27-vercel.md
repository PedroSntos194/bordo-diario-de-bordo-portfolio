# 27 · Publicação na Vercel

> **Site público de portfólio:** o `vercel.json` deste repositório executa
> `npm run build:portfolio` e publica somente a apresentação com a demonstração em memória,
> sem banco, APIs, login ou cron. As instruções a seguir descrevem a alternativa de hospedar o
> **sistema completo**: ela exige um projeto próprio com framework Next.js, build `npm run build`,
> saída padrão do framework e cron `0 * * * *` apontando para `/api/cron`, além dos serviços abaixo.

> Substitui, **para o ambiente publicado**, o runbook de contêiner do
> [doc 24](24-implantacao.md). Aquele continua válido e testado — é a porta de
> saída, se um dia a operação voltar para servidor próprio.

Endereço: **`bordo.exemplo.com.br`**, subdomínio do site institucional, que
segue no ar e intocado.

---

## 1. O que muda em relação ao contêiner

| Peça | Contêiner | Vercel |
|---|---|---|
| Aplicação | `node server.js` | função sem servidor |
| Banco | PostgreSQL no compose | **Neon** — o mesmo de hoje |
| Agendador | processo residente com pg-boss | `GET /api/cron` de hora em hora |
| Arquivos gerados | volume em disco | balde S3 privado (`STORAGE_DRIVER=s3`) |
| TLS | Caddy | automático |

As três primeiras linhas do sistema **não mudam**: mesmo código, mesmo banco,
mesmas regras. O que muda é onde o processo vive e onde o arquivo é gravado.

---

## 2. O agendador virou uma URL

### Por que de hora em hora, e não nos horários exatos

Duas razões, e as duas estão no `despacho.regras.ts`:

1. **O cron da Vercel dispara em UTC.** `0 23 * * *` lá seriam 20h em São
   Paulo. Converter na expressão funcionaria hoje e quebraria no dia em que o
   horário de verão voltasse.
2. **O horário é configurável em banco** (RF040). Expressão de cron é estática
   e só muda com deploy; a configuração precisa continuar valendo.

Então o cron passa a cada hora e o **código** decide o que venceu, usando o
fuso da operação e a configuração. O administrador continua mudando o
fechamento pela tela.

### Repetir é seguro

Uma passagem repetida não duplica trabalho: a cobrança de pendências reconhece
o dia já cobrado pela `referencia_chave` (US038), e o consolidado gera arquivo
novo sem sobrescrever o anterior (US033).

### A rota apaga dados

`GET /api/cron` dispara, entre outras coisas, o **expurgo por retenção**. Ela
exige `Authorization: Bearer ${CRON_SECRET}`, compara em tempo constante e
responde **404** — não 401 — para quem não tem o segredo: confirmar que o
endpoint existe já é informação demais.

**Sem `CRON_SECRET` configurado a rota recusa tudo**, inclusive em
desenvolvimento.

### Exportação grande não espera o cron

A fila de exportações é processada por `after()` do Next 15, logo depois de a
resposta 202 sair — o usuário não espera até uma hora. O cron é **rede de
segurança**, para tarefa que falhou ou cujo processo morreu no meio.

Isso funciona porque a reclamação da tarefa é atômica (`updateMany` condicional
em `PENDENTE`): se o `after()` e o cron correrem juntos, exatamente um ganha.

---

## 3. Variáveis de ambiente

Além das que o [`.env.producao.example`](../.env.producao.example) já lista:

| Variável | Valor |
|---|---|
| `APP_AMBIENTE` | `producao` |
| `APP_URL` | `https://bordo.exemplo.com.br` |
| `DATABASE_URL` | string do Neon **com pool** — ver a seção 4 |
| `CRON_SECRET` | `openssl rand -base64 36` |
| `STORAGE_DRIVER` | `s3` |
| `S3_BUCKET`, `S3_REGIAO`, `S3_ENDPOINT`, `S3_CHAVE_ID`, `S3_CHAVE_SECRETA` | do balde privado |

> `STORAGE_PATH` deixa de ser usado: não há disco que sobreviva entre duas
> invocações.

---

## 4. Banco: usar a string **com pool**

Cada invocação sem servidor é um cliente novo. Apontar o Prisma para o endpoint
direto do Neon esgota as conexões no primeiro pico — sintoma clássico, e que só
aparece com mais de um motorista registrando ao mesmo tempo.

A string precisa ser a do **pooler** (tem `-pooler` no host).

---

## 5. Arquivos: o balde é privado

O download **continua passando pela rota autenticada** que confere permissão
sobre o conteúdo (RN030). O balde nunca é servido direto, e o
`chaveArmazenamento` nunca chega ao navegador.

Vale para qualquer alvo compatível com S3 — Cloudflare R2, Backblaze B2, AWS.
O `S3_ENDPOINT` é explícito justamente para a escolha continuar reversível.

> **Não usar URL pública com nome difícil de adivinhar.** É a tentação óbvia e
> troca autenticação por obscuridade, sobre planilha que tem CPF e trajeto de
> empregado.

---

## 6. Primeira publicação

```bash
# 1 · segredos
openssl rand -base64 36   # CRON_SECRET
openssl rand -base64 36   # SESSAO_SECRET, se ainda não houver
```

2. Criar o projeto na Vercel a partir do repositório e preencher as variáveis.
3. Migrar o banco **antes** do primeiro deploy:

```bash
npx prisma migrate deploy
```

4. Adicionar o domínio `bordo.exemplo.com.br` na Vercel e criar o registro DNS
   que ela indicar, no painel de `exemplo.com.br`. O site institucional não é
   afetado.
5. Conferir:

```bash
curl -fsS https://bordo.exemplo.com.br/api/health
```

6. Disparar o cron à mão uma vez, para não descobrir problema às 23h:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://bordo.exemplo.com.br/api/cron
```

---

## 7. O que precisa ser conferido nesta hospedagem

### O agendamento, e por que o projeto está no plano Pro

**O plano Hobby permite cron uma vez por dia.** O `0 * * * *` deste projeto é
horário, e isso fazia a Vercel **reprovar o deploy inteiro** — não era
retenção antifraude, como se supôs a princípio. Confirmado pelo status de
falha no commit `79b967b`, com link para os
[limites oficiais](https://vercel.com/docs/cron-jobs/usage-and-pricing).

**Reduzir a frequência não era opção.** Uma passagem por dia não alcança dois
horários: a cobrança de pendências vence às 20h e o consolidado às 23h.
Cobrar pendência junto com o fechamento é cobrar o que já não tem conserto.

**O GitHub Actions foi tentado como saída gratuita, e não serve.** Entre
28/09 e 29/09 ele disparou **6 passagens em ~26 horas** — descartou cerca de
75% das execuções agendadas, e nenhuma caiu na hora das 23h. O fluxo supunha
que o GitHub *atrasaria*; ele *descarta*. A cobrança das 20h virava sorteio, e
o consolidado só sairia pela passagem diária da própria Vercel.

**Decisão, em 30/09: plano Pro**, com o cron de volta ao `vercel.json`, de
hora em hora. Duas razões, e a primeira bastaria sozinha:

1. **O Hobby é restrito a uso pessoal e não comercial.** O Bordo é
   sistema de operação de uma empresa; rodar no Hobby é estar fora dos termos,
   com risco de suspensão do projeto.
2. **Agendamento confiável.** O cron da Vercel é garantido; o do GitHub, não.

Custo: US$ 20/mês, com US$ 20 de crédito de uso incluso. O limite de gasto
sob demanda (*Spend Management*) está em US$ 200 — é um teto de segurança, não
uma previsão: o uso deste sistema deve caber folgado no crédito incluso.

> **Conta pessoal.** Se o plano for contratado numa conta pessoal, a Vercel
> permite transferir o projeto para uma equipe em nome da empresa depois,
> sem reconstruir nada — vale fazer antes de o sistema virar dependência
> diária, para a empresa não depender de uma conta pessoal.

### Outros itens que dependem do plano e **ainda não foram medidos**:

- **Duração máxima da função.** A exportação medida foi de ~1 s para 6.600
  linhas; o teto de 200 mil sairia em torno de meio minuto. Cabe com folga nos
  limites usuais do Pro, mas ainda não foi medido na hospedagem.
- **Região.** `gru1` (São Paulo) está fixada no `vercel.json` — importa para
  latência e para a análise do [doc 26](26-lgpd-base-legal.md).

## 8. O que a mudança tira

**O ensaio de restauração com `pg_dump` deixa de ser o procedimento.** O Neon
tem cópia própria com restauração por ponto no tempo, que é melhor
operacionalmente — mas é **outra coisa**, e o critério "restauração testada" da
US046 precisa ser refeito contra ela antes do go-live.

Os scripts `backup.sh` e `restaurar.sh` continuam no repositório, válidos para
o caminho de contêiner.
