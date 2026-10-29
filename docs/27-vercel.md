# 27 · Publicação na Vercel

O `vercel.json` deste repositório publica o **sistema completo** como aplicação Next.js:
login, áreas de motorista e administração, APIs e registros persistidos. O build é
`npm run build`, com a saída padrão do framework e região `gru1` (São Paulo).
**Não há cron configurado neste deploy.**

Endereço da instalação de portfólio:
[https://bordo-diario-de-bordo-portfolio.vercel.app](https://bordo-diario-de-bordo-portfolio.vercel.app).
Essa instalação usa serviços próprios e dados fictícios, separados da instalação da empresa.
Configurar o projeto não confirma a disponibilidade: concluir os serviços e a verificação da
seção 6 antes de compartilhar o acesso.

O [runbook de contêiner](24-implantacao.md) continua válido para hospedagem em servidor próprio.

## 1. Sistema completo e apresentação estática

| Peça | Sistema completo na Vercel | Apresentação estática alternativa |
| --- | --- | --- |
| Build | `npm run build` | `npm run build:portfolio` |
| Saída | padrão do Next.js | `output/portfolio-build/out` |
| Entrada | `/login`; a raiz encaminha conforme a sessão | apresentação |
| Apresentação | `/apresentacao` | `/` e `/apresentacao` |
| Dados | PostgreSQL e arquivos privados persistidos | simulação em memória no navegador |
| Serviços externos | banco e armazenamento configurados | nenhum serviço obrigatório |

O build estático continua disponível para hospedagem separada. Para usá-lo em outro projeto,
escolher framework sem detecção automática, build `npm run build:portfolio` e saída
`output/portfolio-build/out`. A configuração padrão deste repositório usa o sistema completo.

## 2. Serviços e configuração do projeto

Usar o projeto Vercel **da instalação de portfólio**, ligado a este repositório. Não reutilizar
banco, armazenamento, domínio ou segredos da instalação da empresa.

- Framework: Next.js.
- Instalação: `npm ci`.
- Build: `npm run build`.
- Output Directory: padrão do framework, sem o override do antigo build estático.
- PostgreSQL: banco próprio; Neon é uma opção compatível.
- Arquivos: store **privado** do Vercel Blob conectado ao projeto, ou bucket S3 privado.
- Região da aplicação: `gru1`; escolher a região do banco considerando a latência.

Criar e conectar os serviços e confirmar as variáveis antes do build. O projeto exige um banco
configurado; a publicação estática anterior não o fornecia.

## 3. Variáveis de ambiente

Usar os exemplos de [`.env.example`](../.env.example) como referência para os nomes. No deploy,
configurar as variáveis no ambiente Production do projeto correto. Não versionar arquivos com
credenciais nem expor segredos com prefixo `NEXT_PUBLIC_`.

| Variável | Valor ou origem |
| --- | --- |
| `APP_AMBIENTE` | `producao` |
| `APP_URL` | `https://bordo-diario-de-bordo-portfolio.vercel.app` |
| `TZ` | `America/Sao_Paulo` |
| `DATABASE_URL` | conexão PostgreSQL **com pool** |
| `DIRECT_URL` | conexão PostgreSQL **direta**, usada nas migrações |
| `SESSAO_SECRET` | segredo aleatório próprio, com pelo menos 32 caracteres |
| `STORAGE_DRIVER` | `blob` para Vercel Blob privado; `s3` para bucket compatível |
| `BLOB_STORE_ID` | identificador do store privado conectado, quando usar OIDC |
| `VERCEL_OIDC_TOKEN` | fornecido pela Vercel para autenticação OIDC do store |
| `BLOB_READ_WRITE_TOKEN` | credencial de servidor restrita ao store privado conectado |
| `BORDO_APRESENTACAO_PUBLICA` | ausente ou `false`, para mostrar o acesso ao sistema |
| `WHATSAPP_CANAL` | `link`, sem envio automático |
| `LOG_NIVEL` | `info` |

Esta instalação usa `BLOB_READ_WRITE_TOKEN`, restrito ao store privado do portfólio, para
autenticar o servidor. O driver também aceita OIDC quando configurado na instalação
(`BLOB_STORE_ID` e `VERCEL_OIDC_TOKEN`). Não copiar tokens para código, documentação ou
formulários do navegador.

Se escolher `STORAGE_DRIVER=s3`, preencher `S3_BUCKET`, `S3_REGIAO`, `S3_ENDPOINT`,
`S3_CHAVE_ID` e `S3_CHAVE_SECRETA`. O driver `local` e `STORAGE_PATH` continuam destinados à
execução local ou em contêiner: o disco de uma função Vercel não fornece armazenamento persistente.

`CRON_SECRET` é opcional enquanto não houver agendamento. Sem ele, `/api/cron` permanece fechado.

## 4. Banco e primeira carga

A aplicação usa `DATABASE_URL` com pool para compartilhar conexões entre invocações. No Neon,
o host dessa conexão contém `-pooler`. `DIRECT_URL` aponta à conexão direta, sem esse sufixo,
para o Prisma Migrate.

Depois de confirmar que as duas conexões pertencem ao novo banco da instalação de portfólio,
executar as migrações com as variáveis carregadas no processo:

```bash
npx prisma migrate deploy
```

Não executar migrações destrutivas, `migrate reset` ou seed como parte do build. O deploy deve
conseguir ser repetido sem recriar dados ou contas.

Para uma instalação de portfólio **vazia**, `npm run seed:demo` cria somente dados fictícios.
Ele recusa bancos com veículos ou jornadas e recusa `APP_AMBIENTE=producao`. Executá-lo uma única
vez com `APP_AMBIENTE=homologacao` somente no processo de seed, apontando ao banco novo e isolado.
O ambiente da aplicação publicada continua `producao`. Escolher uma senha própria com `DEMO_SENHA`
e entregar os acessos separadamente, sem gravá-los no repositório ou nos logs do deploy.

O seed de administrador inicial (`npm run seed`) é uma alternativa para instalação sem dados
de demonstração; não executar os dois seeds na mesma preparação.

## 5. Arquivos privados e exportações

O download passa por `/api/arquivos/{id}/download`, que verifica sessão e permissão sobre o
conteúdo. O identificador do objeto fica no servidor; o usuário não recebe uma URL pública do
store ou do bucket. Esse comportamento vale tanto para Vercel Blob privado quanto para S3.

A exportação grande usa uma tarefa persistida no PostgreSQL e `after()` do Next.js para processar
após a resposta 202. O processamento não espera o cron. A reclamação condicional da tarefa evita
processar o mesmo pedido simultaneamente. Conferir geração e download em requisições distintas
para validar também o armazenamento remoto.

## 6. Conferência da publicação

Concluir estes passos no endereço público após o deploy:

1. Abrir `/` sem sessão: deve encaminhar ao login. `/apresentacao` continua público.
2. Consultar `/api/health`: deve responder 200 com `status: ok` e `banco: ok`.
3. Abrir administração sem sessão e consultar uma API protegida: tela pede login; API responde 401.
4. Entrar com os dois perfis. Motorista não deve obter acesso administrativo.
5. Registrar uma operação fictícia e consultá-la novamente, inclusive por uma nova sessão.
6. Exportar uma planilha e baixá-la por outra requisição, confirmando o arquivo persistido.
7. Sair e confirmar que as rotas protegidas exigem autenticação novamente.

A variável `APP_AMBIENTE=producao` ativa cookies seguros e a exigência de HTTPS. Não remover a
validação de ambiente nem relaxar a autorização para fazer um deploy passar.

## 7. Rotinas agendadas opcionais

Este repositório não configura cron na Vercel. Assim, a publicação não executa automaticamente
cobrança de pendências, consolidação, fechamento ou expurgo de retenção.

A rota existente `GET /api/cron` exige `Authorization: Bearer ${CRON_SECRET}` e responde 404
sem autorização. Ela também executa expurgo, portanto a configuração do segredo e do agendamento
precisa ser deliberada. Não chamar essa rota como teste de saúde.

Se a instalação passar a exigir essas automações, conferir os
[limites atuais de cron da Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing) e configurar
a frequência compatível com o plano. O despachante usa o fuso de São Paulo e os horários salvos
no banco; uma frequência horária permite conferir separadamente as rotinas de 20h e 23h.

## 8. Dados e recuperação

Usar a política de cópias e recuperação do provedor do novo banco e verificar sua restauração.
Os scripts `backup.sh` e `restaurar.sh` do caminho em contêiner continuam válidos nesse ambiente,
mas não comprovam a recuperação do banco gerenciado.

Reverter um deploy não reverte migrações nem dados. Manter migrações compatíveis com a versão
anterior e preservar os registros entre publicações.
