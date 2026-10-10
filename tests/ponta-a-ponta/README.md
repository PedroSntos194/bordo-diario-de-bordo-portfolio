# Testes ponta a ponta

Roteiros que exercitam o sistema **pelo HTTP, com sessões reais** de
administrador e de motorista — o mesmo caminho do navegador e do aplicativo.
Nasceram do teste de 30/09/2026, que
achou dois defeitos que os testes unitários e o build não pegavam.

| Arquivo | O que cobre |
|---|---|
| `roteiro.mjs` | Público e proteção, sessão vencida, acesso do administrador, cadastros, o dia inteiro do motorista, painel, as três planilhas (abertas e conferidas), importação, segurança e todas as telas |
| `offline.mjs` | Um dia registrado sem sinal sincronizado de uma vez, sem duplicar no reenvio |
| `primeiro-acesso.mjs` | Troca de senha temporária e aceite do aviso pelas telas, e sair com pendência |
| `todos.mjs` | Os três em sequência, num relatório só |
| `apoio.mjs` | Configuração, travas de segurança, cliente HTTP e relatório |

## ⚠️ Só contra servidor local

Os roteiros **gravam dados**: vans, rotas, motoristas, administradores,
jornadas e planilhas, com placas e CPFs gerados na hora. Por isso:

- o endereço precisa ser `localhost`, `127.0.0.1`, `::1` ou `*.localhost` —
  qualquer outro é recusado antes da primeira requisição, e nenhum
  redirecionamento pode levar para fora dele;
- o roteiro se recusa a rodar com `APP_AMBIENTE=producao` ou com um
  `DATABASE_URL` que aponte para o mesmo banco do `.env.producao` (o arquivo é
  lido só para comparar o host);
- use um banco **de teste**: o do Docker local (`compose.teste.yml`) ou o de
  desenvolvimento. Os dados ficam lá, acumulando a cada execução.

**Nunca rode contra produção.** Em produção, só verificações de leitura.

## Credenciais

Nenhuma fica no código:

| Variável | Para quê | Padrão |
|---|---|---|
| `E2E_ADMIN_CPF` | CPF do administrador do banco local — o que o seed mostrou | `SEED_ADMIN_CPF`, se definido; senão, obrigatória |
| `E2E_ADMIN_SENHA` | Senha **definitiva** desse administrador | — (obrigatória) |
| `E2E_BASE_URL` | Endereço do servidor local | `http://localhost:3000` |
| `CRON_SECRET` | Para testar o despacho do agendador | Vem do `.env`; sem ele, o teste é pulado |

Os motoristas e o administrador de teste que o roteiro cria têm senha gerada
na hora, aleatória a cada execução.

## Como rodar

### Execução isolada e CI

```powershell
docker compose -f compose.teste.yml up -d --wait
npm run test:fluxos
docker compose -f compose.teste.yml down
```

Esse executor compila a aplicação numa cópia temporária sem `.env` ou
`.env.producao`, cria um schema PostgreSQL descartável e um administrador
fictício, executa os cenários complementares e estes três roteiros originais,
e limpa os dados ao terminar. Não exige credenciais de um administrador real.
O job `fluxos-http` da CI executa o mesmo comando em PostgreSQL 16 isolado.
O log dos dois conjuntos fica em `output/testes-http/execucao.log`.
Detalhes das proteções e da cobertura estão no
[`doc 30`](../../docs/30-testes-ponta-a-ponta.md).

### Execução manual contra um banco local já preparado

Os passos abaixo usam o `.env` do seu desenvolvimento. Confira primeiro que
ele aponta para o PostgreSQL local pretendido. Para rodar os testes sem
carregar esse arquivo nem acumular dados, prefira o executor acima.

1. **Banco local com o seed.** Com o Docker:

   ```bash
   docker compose -f compose.teste.yml up -d --wait
   npx prisma migrate deploy
   npm run seed
   ```

   O seed mostra o CPF e a **senha temporária** do administrador uma única
   vez.

2. **Primeiro acesso do administrador**, pela tela: entre em
   `http://localhost:3000` com essa senha temporária, defina a senha
   definitiva e aceite o aviso de privacidade. O CPF vai em `E2E_ADMIN_CPF`;
   a senha definitiva, em `E2E_ADMIN_SENHA`. Se ela se perder:
   `npx tsx --env-file=.env scripts/redefinir-acesso-admin.ts <cpf> --confirmar`.

3. **Servidor local:** `npm run dev`.

4. **Em outro terminal**, com as credenciais só na sessão do terminal:

   ```powershell
   $env:E2E_ADMIN_CPF = '<CPF que o seed mostrou>'
   $env:E2E_ADMIN_SENHA = '<senha definitiva do admin local>'
   npm run test:ponta-a-ponta
   ```

   ```bash
   E2E_ADMIN_CPF='<CPF que o seed mostrou>' E2E_ADMIN_SENHA='<senha definitiva do admin local>' npm run test:ponta-a-ponta
   ```

   Servidor em outra porta: `E2E_BASE_URL=http://localhost:3001`. Um roteiro
   só: `npx tsx --env-file-if-exists=.env tests/ponta-a-ponta/offline.mjs`.

O comando sai com código **0** se tudo passou, **1** se algum item falhou e
**2** se a configuração foi recusada. Itens que dependem de algo fora do
sistema — o Nominatim na busca de endereço, o `CRON_SECRET` — aparecem como
`PULADO` e não reprovam.

## O que estes roteiros não cobrem

O que só se vê num celular de verdade: o pedido de permissão de localização, a
prévia do km ao digitar, a instalação do aplicativo, o mapa desenhando e o
registro sem sinal feito **pela tela** (aqui ele é simulado pela rota de
sincronização).
