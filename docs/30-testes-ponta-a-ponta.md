# 30 · Testes completos pela API HTTP

A suíte `tests/integracao/fluxos-http.test.mjs` executa a aplicação compilada,
com PostgreSQL real, migrações versionadas e armazenamento local descartável.
O executor usa `fetch` e o test runner do Node 22; nenhuma dependência nova foi adicionada.

A suíte complementar foi criada nesta máquina a partir dos contratos atuais.
Os roteiros originais do outro PC chegaram pelo commit `746d7b4` e estão em
`tests/ponta-a-ponta/`. O mesmo executor roda os dois conjuntos na CI: primeiro
os cenários complementares, depois `tests/ponta-a-ponta/todos.mjs` com o suporte
a TypeScript do Node 22 atualizado (22.6 ou superior).

## Executar localmente

```powershell
docker compose -f compose.teste.yml up -d --wait
npm run test:fluxos
docker compose -f compose.teste.yml down
```

O compose exclusivo dos testes publica o PostgreSQL somente em `127.0.0.1:55433`
e usa dados temporários em `tmpfs`, sem volumes de produção. A conta é
`bordo_ci`, senha `bordo_ci_apenas_testes`, banco `bordo_ci`.

Também é possível usar uma instância PostgreSQL 16 descartável instalada
localmente, com esse banco e conta. Para mudar as portas:

```powershell
$env:TESTE_POSTGRES_PORTA = '55433'
$env:TESTE_HTTP_PORTA = '3107'
npm run test:fluxos
```

As únicas opções do executor são as duas portas. Ele não aceita URLs de banco ou
servidor externos. Cada execução cria um schema `ci_fluxos_<aleatório>` e o remove
ao terminar, inclusive se houver falha; o banco `public` não é limpo ou alterado.
As credenciais E2E do administrador e o segredo do cron são fixtures exclusivas
desse schema, fornecidas pelo executor; nenhuma senha real precisa ser configurada.

O Next e o Prisma rodam em uma cópia temporária contendo apenas os arquivos
necessários. A cópia não inclui `.env`, `.env.producao`, storage ou dados existentes;
o ambiente do processo usa uma lista explícita de variáveis. Isso evita carregar
automaticamente credenciais reais. O build original do projeto também é preservado.
O Prisma Client e seu pacote de runtime são cópias físicas dentro do diretório
temporário, para que o loader interno de dotenv não siga um link até o `.env`
original. Os demais pacotes instalados podem ser reutilizados por links.
Só na configuração copiada, o empacotamento `standalone` é desligado; os testes
continuam usando `next build` de produção seguido de `next start`.
Os testes de proteção, que não precisam de PostgreSQL, podem ser rodados sozinhos:

```powershell
npm run test:fluxos:protecoes
```

## O que é verificado

Os roteiros originais verificam o fluxo completo do administrador e motorista,
as três planilhas, importação XLSX, proteção de telas, bloqueio/revogação de
contas, limites de login, o dia sem conexão e o primeiro acesso. A chamada
autenticada do cron usa um segredo fictício. A busca pública no Nominatim pode
aparecer como `PULADO` quando o serviço externo estiver indisponível; isso não
substitui nem invalida os testes dos fluxos locais.

A suíte complementar abaixo acrescenta os casos de dia anterior, isolamento
de download e tarefa, lote embaralhado, preservação após erro e exportação de
5.001 linhas em segundo plano. O volume sintético é da data anterior para não
alterar as exportações diárias que os roteiros originais conferem.

| Fluxo | Evidência |
|---|---|
| Autenticação | visitante e cookie inválido recebem 401; login incorreto é recusado; login com cookie inválido não entra em ciclo |
| Primeiro acesso | criação pelo administrador, senha temporária, bloqueio antes da troca e do aceite vigente |
| Autorização | motorista não administra cadastros; CPF duplicado é recusado; hash não aparece na resposta |
| Jornada online | abertura e reenvio idempotentes; veículo ocupado é recusado; retrato offline mostra a jornada |
| Corrida e paradas | GPS, corrida em andamento, chegada/saída, reenvio sem duplicar e isolamento entre motoristas |
| Encerramento | erro de odômetro não encerra; corrida aberta impede fechamento; cancelada fica fora dos totais; odômetro da van é atualizado |
| Dia anterior | pendência aparece e a tela de encerramento abre; a API fecha a jornada antiga |
| Sincronização | lote embaralhado de abertura/corrida/parada/encerramentos, referências locais e idempotência dos cinco tipos; erro individual não interrompe o restante |
| Relatórios | filtros de data, motorista, status e rota, paginação e resumo pessoal |
| Exportação | filtros efetivos, XLSX aberto pelo ExcelJS, valores numéricos, cabeçalhos e autorização de download; filtro incompatível e recorte vazio são recusados |
| Segundo plano | 5.001 corridas sintéticas, admissão 202, conclusão pelo processamento após resposta, isolamento da tarefa e XLSX de 5.001 linhas |
| Logout | cookie anterior é revogado no banco e novo login cria outra sessão |

O bootstrap do administrador, a jornada antiga e o volume de 5.001 corridas são
fixtures inseridas diretamente somente no schema descartável. As ações funcionais,
as exportações e os downloads passam pelas rotas HTTP da aplicação.

Esta suíte não controla cliques num navegador e não substitui a homologação no
celular: permissões reais de GPS, IndexedDB, service worker, instalação PWA,
modo avião e rede instável continuam exigindo o roteiro do doc 25. O ensaio de
5.001 linhas na CI verifica o fluxo, não mede os limites da Vercel em produção.
A regra para impedir jornadas abertas em dias diferentes não foi alterada.

## Integração contínua

O job `fluxos-http` em `.github/workflows/ci.yml` sobe PostgreSQL 16 isolado,
instala as dependências, gera o Prisma Client e executa `npm run test:fluxos`
em todo push para `main`, `develop` e branches `codex/**`, além dos pull requests
para `main`/`develop`. Isso permite conferir a entrega antes de publicá-la em
produção. Não usa secrets de produção.

`output/testes-http/execucao.log` (inclui os roteiros originais) e
`output/testes-http/junit.xml` (cenários complementares) são guardados
como artefato do GitHub Actions durante 14 dias. Uma falha de qualquer cenário
faz o job falhar. Para bloquear merges, o repositório deve exigir esse check na
proteção de branch; a existência do workflow não altera essa configuração.
