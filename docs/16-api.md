# 16 · API

## Convenções

- Base: `/api` · corpo e resposta em `application/json; charset=utf-8`
- Autenticação por **cookie de sessão** (`HttpOnly`, `Secure`, `SameSite=Lax`) — não há token em header
- Datas em **ISO 8601 com fuso** (`2026-08-23T07:15:00-03:00`)
- Identificadores em `uuid`
- Paginação: `?pagina=1&tamanho=20` (máximo 100) — RNF012
- Ordenação: `?ordenar=data&direcao=desc`
- Mutações exigem cabeçalho `X-CSRF-Token`

### Envelope de resposta

Sucesso com coleção:
```json
{
  "dados": [],
  "paginacao": { "pagina": 1, "tamanho": 20, "total": 143, "totalPaginas": 8 }
}
```

Erro (padrão único — ver [`18-tratamento-de-erros.md`](18-tratamento-de-erros.md)):
```json
{
  "erro": {
    "codigo": "ODOMETRO_INVALIDO",
    "mensagem": "O odômetro não pode ser menor que o último valor registrado para esta van.",
    "campos": { "odometroInicial": "Último valor registrado: 84320 km" },
    "referencia": "err_01JB3K9X2M"
  }
}
```

### Códigos de status utilizados

| Código | Uso |
|---|---|
| 200 | Consulta ou atualização bem-sucedida |
| 201 | Recurso criado |
| 204 | Ação sem corpo de resposta |
| 400 | Dados inválidos (falha de esquema) |
| 401 | Sem sessão válida |
| 403 | Perfil sem permissão para a ação |
| 404 | Recurso inexistente **ou fora do escopo do usuário** (RN009) |
| 409 | Conflito de estado (corrida já aberta, CPF duplicado, jornada encerrada) |
| 422 | Regra de negócio violada (odômetro incoerente, horário inválido) |
| 429 | Limite de requisições excedido |
| 500 | Erro interno — sem detalhe técnico no corpo |

---

## Autenticação

### `POST /api/auth/login` · RF001
Autentica por CPF e senha.
**Permissão:** pública · **Limite:** 10 tentativas por IP a cada 15 min

```json
{ "cpf": "12345678900", "senha": "string" }
```

| Status | Situação |
|---|---|
| 200 | Autenticado — cookie de sessão emitido; corpo com `{ perfil, deveTrocarSenha, aceitouPrivacidade }` |
| 400 | CPF inválido |
| 401 | Credenciais incorretas (mensagem genérica) |
| 403 | Conta inativa ou bloqueada |
| 429 | Excesso de tentativas — RN003 |

### `POST /api/auth/logout` · RF008
Invalida a sessão no servidor. **Permissão:** autenticado. **Respostas:** 204, 401.

### `POST /api/auth/trocar-senha` · RF003, RF009
```json
{ "senhaAtual": "string", "novaSenha": "string", "confirmacao": "string" }
```
`senhaAtual` é dispensada quando o usuário está no fluxo de senha temporária.
**Respostas:** 204 · 400 (política de senha) · 401 (senha atual incorreta) · 422 (igual à anterior).

### `POST /api/privacidade/aceite` · RF042
```json
{ "versaoTexto": "1.0" }
```
**Respostas:** 204 · 401 · 409 (já aceita).

---

## Usuários

### `GET /api/usuarios` · RF007
**Permissão:** ADMIN
**Parâmetros:** `busca`, `perfil`, `status`, `pagina`, `tamanho`, `ordenar`
**Respostas:** 200 (CPF mascarado — RN029) · 401 · 403

### `POST /api/usuarios` · RF004
**Permissão:** ADMIN
```json
{
  "nome": "string",
  "cpf": "12345678900",
  "telefone": "+5511999999999",
  "perfil": "MOTORISTA",
  "matricula": "string?",
  "cnhNumero": "string?",
  "cnhCategoria": "D?",
  "cnhValidade": "2028-05-10?"
}
```
**Respostas:** 201 com `{ id, senhaTemporaria }` (exibida uma única vez) · 400 · 403 ·
409 (`CPF_DUPLICADO`) · 422 (CPF inválido)

### `GET /api/usuarios/{id}` · `PUT /api/usuarios/{id}` · RF005
**Permissão:** ADMIN. `PUT` recusa alteração de CPF quando houver jornadas (409).
**Respostas:** 200 · 401 · 403 · 404 · 409 · 422

### `PATCH /api/usuarios/{id}/status` · RF006
```json
{ "status": "BLOQUEADO", "motivo": "string?" }
```
Encerra as sessões ativas do usuário.
**Respostas:** 200 · 403 · 404 · 409 (`ULTIMO_ADMINISTRADOR`, `ACAO_SOBRE_PROPRIA_CONTA`)

### `POST /api/usuarios/{id}/redefinir-senha` · RF002
**Permissão:** ADMIN
**Respostas:** 200 com `{ senhaTemporaria }` · 403 · 404

### `GET /api/perfil` · RF009
**Permissão:** autenticado. **Respostas:** 200 · 401

---

## Veículos e rotas

### `GET /api/veiculos` · RF010
**Permissão:** ADMIN (todos) · MOTORISTA (somente ativos, para seleção)
**Parâmetros:** `busca`, `status`, `pagina`

### `GET /api/veiculos/disponiveis` · RF014
Veículos ativos **sem jornada em andamento** (RN013). **Permissão:** autenticado.

### `POST /api/veiculos` · `PUT /api/veiculos/{id}` · `PATCH /api/veiculos/{id}/status`
**Permissão:** ADMIN
```json
{ "placa": "ABC1D23", "modelo": "Sprinter 416", "marca": "Mercedes-Benz",
  "ano": 2022, "capacidadePassageiros": 16, "odometroAtual": 84320 }
```
**Respostas:** 201/200 · 400 · 403 · 409 (`PLACA_DUPLICADA`, `VEICULO_EM_JORNADA`)

### `GET /api/rotas` · `POST /api/rotas` · `PUT /api/rotas/{id}` · RF011
**Permissão:** leitura autenticada; escrita ADMIN
```json
{ "codigo": "R-014", "nome": "Centro → Fábrica", "origem": "Terminal Centro",
  "destino": "Planta Industrial", "turno": "MANHA", "distanciaEstimadaKm": 27.5 }
```

### `PUT /api/rotas/{id}/pontos` · RF012
Substitui a lista completa de pontos de parada, preservando a ordem enviada.
```json
{ "pontos": [
  { "ordem": 1, "nome": "Terminal Centro", "endereco": "Av. Central, 100",
    "latitude": -23.5505, "longitude": -46.6333 }
] }
```
**Respostas:** 200 · 400 · 403 · 404

---

## Operação

### `GET /api/jornadas/hoje` · RF014
Estado do dia do usuário autenticado: jornada aberta, corrida em andamento e totais parciais.
Base da tela T04.
**Respostas:** 200 (`{ "jornada": null }` quando o dia ainda não foi iniciado) · 401

### `POST /api/jornadas` · RF014
**Permissão:** MOTORISTA (própria) · ADMIN (em nome de terceiro, auditado)
```json
{ "veiculoId": "uuid", "odometroInicial": 84320,
  "confirmaDivergencia": false, "clientUuid": "uuid" }
```
| Status | Situação |
|---|---|
| 201 | Jornada criada |
| 200 | Já existia jornada aberta no dia — retorna a existente (RN012) |
| 409 | `VEICULO_EM_USO` |
| 422 | `ODOMETRO_MENOR_QUE_ULTIMO` · `DIVERGENCIA_ODOMETRO_NAO_CONFIRMADA` |

### `POST /api/jornadas/{id}/encerrar` · RF019
```json
{ "odometroFinal": 84512, "observacoes": "string?" }
```
| Status | Situação |
|---|---|
| 200 | Encerrada — devolve os totais consolidados |
| 409 | `CORRIDA_EM_ANDAMENTO` (informa qual) · `JORNADA_JA_ENCERRADA` |
| 422 | `ODOMETRO_INCOERENTE` |

### `GET /api/jornadas` · RF029
**Parâmetros:** `dataInicio`, `dataFim`, `motoristaId`, `veiculoId`, `status`, `pagina`
Motorista recebe apenas as próprias jornadas, independentemente do filtro enviado (RN009).
**Respostas:** 200 · 401 · 422 (período maior que 12 meses)

### `GET /api/jornadas/{id}` · RF029
Detalhe com corridas, ocorrências e totais. **404** quando o registro é de outro motorista.

### `POST /api/corridas` · RF015
```json
{ "jornadaId": "uuid", "rotaId": "uuid?",
  "origemDescricao": "string?", "destinoDescricao": "string?",
  "odometroInicial": 84320,
  "localizacao": { "latitude": -23.55, "longitude": -46.63, "precisaoMetros": 12.4 },
  "clientUuid": "uuid" }
```
`rotaId` ou o par origem/destino é obrigatório.
| Status | Situação |
|---|---|
| 201 | Corrida iniciada |
| 409 | `CORRIDA_JA_EM_ANDAMENTO` · `JORNADA_NAO_ABERTA` |
| 422 | `ROTA_INATIVA` |

### `POST /api/corridas/{id}/eventos` · RF017
```json
{ "tipo": "CHEGADA", "pontoParadaId": "uuid?", "descricao": "string?",
  "ocorridoEm": "2026-08-23T08:12:00-03:00",
  "localizacao": { "latitude": -23.55, "longitude": -46.63 },
  "clientUuid": "uuid" }
```
**Respostas:** 201 · 404 · 409 (corrida já encerrada) · 422 (horário anterior ao início)

### `POST /api/corridas/{id}/encerrar` · RF018
```json
{ "odometroFinal": 84347, "quantidadePassageiros": 14, "observacoes": "string?",
  "confirmaExcessoPassageiros": false,
  "localizacao": { "latitude": -23.59, "longitude": -46.68 } }
```
**Respostas:** 200 com `{ kmPercorrido, duracaoMinutos }` · 409 · 422
(`ODOMETRO_MENOR_QUE_INICIAL`, `EXCESSO_PASSAGEIROS_NAO_CONFIRMADO`)

### `POST /api/corridas/{id}/cancelar`
```json
{ "motivo": "string" }
```
**Respostas:** 200 · 409 · 422 (motivo com menos de 10 caracteres)

### `PATCH /api/corridas/{id}` · RF023
Correção com justificativa obrigatória.
```json
{ "odometroFinal": 84350, "quantidadePassageiros": 12, "justificativa": "string" }
```
**Respostas:** 200 · 403 (`FORA_DA_JANELA_DE_EDICAO` — RN019) · 422 (justificativa curta)

### `POST /api/ocorrencias` · RF020
```json
{ "jornadaId": "uuid", "corridaId": "uuid?", "tipo": "PANE",
  "descricao": "string", "ocorridoEm": "…",
  "localizacao": { "latitude": -23.55, "longitude": -46.63 } }
```
**Respostas:** 201 · 400 · 404

### `POST /api/sincronizacao` · RF022
Recebe em lote as ações criadas offline, processadas em ordem cronológica e de forma idempotente
por `clientUuid` (RN025).
```json
{ "operacoes": [
  { "tipo": "ABRIR_JORNADA", "clientUuid": "uuid", "ocorridoEm": "…", "dados": {} },
  { "tipo": "INICIAR_CORRIDA", "clientUuid": "uuid", "ocorridoEm": "…", "dados": {} }
] }
```
Resposta 200 com o resultado individual de cada operação:
```json
{ "resultados": [
  { "clientUuid": "uuid", "situacao": "APLICADA", "id": "uuid" },
  { "clientUuid": "uuid", "situacao": "JA_PROCESSADA", "id": "uuid" },
  { "clientUuid": "uuid", "situacao": "CONFLITO", "codigo": "JORNADA_JA_ENCERRADA" }
] }
```
Uma operação em conflito **não** interrompe as demais.

> **Nota da Sprint 10 — implementado.** Há uma quarta situação, `FALHA`, para o que
> vale repetir mais tarde: erro interno, serviço indisponível, limite excedido e sessão
> expirada. A distinção importa para o aplicativo: `CONFLITO` **para** e espera uma
> decisão do motorista; `FALHA` volta para a fila e é tentado de novo. Repetir um
> conflito em segundo plano só produziria a mesma recusa, para sempre.
>
> O lote **não** é uma transação única, justamente para honrar "não interrompe as
> demais": cada operação é delegada ao caso de uso normal — o mesmo que a tela usa com
> rede — e cada um traz a própria transação, autorização e auditoria.
>
> A idempotência tem duas camadas. As operações que **criam** já eram idempotentes pela
> coluna `client_uuid` de jornada, corrida e evento. As que **atualizam** não têm onde
> carimbar o identificador, e para elas existe a tabela `operacao_sincronizada`.
>
> `dados` aceita `corridaClientUuid` além de `corridaId`: a corrida iniciada sem rede só
> é conhecida pelo identificador do aparelho até subir.

### `GET /api/offline/retrato` · RF022
**Permissão:** sessão válida. Devolve, numa chamada só, o que o aparelho precisa guardar
para trabalhar sem rede: data operacional, jornada aberta, corrida em andamento, veículos
disponíveis e rotas ativas.

Nunca é servido pelo cache do service worker — um retrato velho apresentado como atual
seria pior do que nenhum retrato.

---

## Painel, relatórios e arquivos

### `GET /api/dashboard` · RF028
**Permissão:** ADMIN. Indicadores do dia, corridas em andamento, ocorrências e pendências.

### `GET /api/resumo/{data}` · RF030
**Permissão:** ADMIN (todos) · MOTORISTA (o próprio, com `?escopo=proprio` implícito)
**Respostas:** 200 · 401 · 422 (data inválida)

### `GET /api/relatorios/periodo` · RF031
**Parâmetros:** `dataInicio`, `dataFim`, `agrupamento` (`motorista` | `veiculo` | `rota`)
**Respostas:** 200 · 403 · 422

> O 202 previsto originalmente **não se aplica a este endpoint**: o relatório agrega em SQL e
> devolve no máximo uma linha por motorista, veículo ou rota — dezenas, não milhares. O
> processamento em segundo plano existe em `POST /api/exportacoes`, que é onde o volume aparece.

### `POST /api/exportacoes` · RF032
Gera o `.xlsx` de uma consulta filtrada. `tipo` aceita `JORNADAS`, `CORRIDAS` ou `RESUMO_DIA`.
```json
{ "tipo": "JORNADAS", "filtros": { "dataInicio": "2026-08-01", "dataFim": "2026-08-23" } }
```
**Respostas:** 201 com `{ modo: "sincrono", arquivoId, nome, url, totalDeLinhas }` · 202 com
`{ modo: "segundo-plano", tarefaId, totalDeLinhas, aviso }` · 400 (filtro que não pertence ao
relatório) · 403 · 422 (`SEM_RESULTADOS_PARA_EXPORTAR`, `PERIODO_MUITO_LONGO`) · 429
(`LIMITE_EXCEDIDO`)

> **Nota da Sprint 6.** `filtros` é validado pelos **mesmos campos** da listagem correspondente e é
> `strict`: um `rotaId` numa exportação de jornadas responde 400 apontando o campo, em vez de ser
> descartado em silêncio — descarte silencioso devolveria a frota inteira com cara de recorte.

> **O que decide o desfecho é a contagem, feita antes de qualquer leitura:**
>
> | Linhas | Resposta |
> |---|---|
> | até 5.000 | **201** — a planilha já existe e `url` baixa |
> | 5.001 a 200.000 | **202** — admitida como tarefa; acompanhe por `tarefaId` |
> | acima de 200.000 | **422** `PERIODO_MUITO_LONGO` |
>
> O cliente decide pelo campo **`modo`**, não pelo código: o `modo` é o contrato do caso de uso, e o
> código HTTP é a tradução dele para quem consome a API de fora.
>
> O 429 aqui não é o limite por hora (RNF004), que continua valendo: é o teto de **três exportações
> em preparo ao mesmo tempo** por usuário. Dez cliques em sequência cabem no limite por hora e
> ocupariam o agendador por meia hora.

### `GET /api/exportacoes/{tarefaId}` · US031
Situação de uma exportação admitida para segundo plano. É o que a tela consulta enquanto espera.
```json
{ "tarefaId": "…", "tipo": "CORRIDAS", "status": "CONCLUIDA", "linhasPrevistas": 6600,
  "linhasGeradas": 6600, "nome": "bordo_corridas_2026-08-28.xlsx",
  "url": "/api/arquivos/…/download", "erro": null, "criadoEm": "…", "concluidaEm": "…" }
```
`status` é `PENDENTE`, `PROCESSANDO`, `CONCLUIDA` ou `FALHA`; `nome` e `url` só vêm com `CONCLUIDA`.

**Respostas:** 200 · 401 · 404

> **404 também para a tarefa de outra pessoa**, e não 403. Distinguir "não existe" de "não é sua"
> confirmaria a existência do pedido alheio a quem chutou um identificador — e o recorte pedido diz
> de quem é o dado.

### `GET /api/arquivos` · RF036 · `GET /api/arquivos/{id}/download`
O download verifica a permissão sobre o conteúdo antes de servir o binário; o caminho no storage
nunca é exposto (RN030).
**Respostas:** 200 · 401 · 403 · 404 · 410 (arquivo expirado)

### `POST /api/importacoes` · RF035
`multipart/form-data`: `arquivo` (`.xlsx`/`.csv`, máx. 5 MB) e `tipoDestino`.
| Status | Situação |
|---|---|
| 200 | Pré-visualização: `{ linhasTotal, linhasOk, linhasErro, erros[] }` |
| 422 | `CABECALHO_INVALIDO` — nada gravado (RN031) |
| 413 | Arquivo acima do limite |
| 415 | Tipo de arquivo não permitido |

### `POST /api/importacoes/{id}/confirmar` · RF035
Grava as linhas válidas. **Respostas:** 200 · 409 (já confirmada) · 422 (nenhuma linha válida)

### `GET /api/importacoes/modelo?tipoDestino=USUARIO` · RF035
Modelo `.xlsx` para preencher: uma aba de dados com cabeçalho fixo e linha de exemplo, e
uma aba de instruções. Montado a cada pedido a partir da definição em código — um modelo
gravado ficaria desatualizado no dia em que uma coluna mudasse, e a planilha antiga
passaria a ser recusada pelo próprio sistema que a distribuiu.

> **Nota da Sprint 10 — implementado.** A confirmação **revalida o arquivo inteiro** em
> vez de confiar na análise: um CPF pode ter sido cadastrado à mão entre uma etapa e
> outra. As duplicidades contra o cadastro atual são verificadas **antes** das inserções,
> nunca capturadas em volta delas: no PostgreSQL um erro deixa a transação abortada, e
> capturar a violação levaria junto as linhas boas — o oposto exato da RN032.
>
> A resposta da confirmação inclui o `arquivoId` de um relatório `.xlsx` com **todas** as
> linhas, importadas e recusadas. Na importação de usuários ele carrega a senha
> temporária de cada um — é assim que sessenta acessos são entregues de uma vez — e por
> isso expira em poucos dias, ao contrário dos demais arquivos gerados.

---

## Notificações, auditoria e configuração

### `POST /api/notificacoes/resumo-dia` · RF025
```json
{ "jornadaId": "uuid" }
```
Na abordagem V-05a, devolve `{ "url": "https://wa.me/…?text=…", "situacao": "PREPARADA" }` para
abertura no cliente; na V-05b, o servidor envia e devolve `situacao: "ENVIADA"` com `url` nula.
A resposta traz ainda `notificacaoId`, `destinatario`, `mensagem` e `jaEnviado`.
**Respostas:** 200 · 404 · 409 (jornada não encerrada, ou nenhum administrador com telefone válido)

> **RN028.** Falha do canal externo **não** vira erro HTTP: a notificação é gravada com status
> `FALHA` e a resposta sai 200 com `situacao: "FALHA"`. O encerramento da jornada não pode ser
> invalidado por um serviço de terceiro fora do ar.
>
> No canal de link, o envio é confirmado pelo motorista ao voltar do WhatsApp — o servidor não tem
> como observá-lo. A confirmação é uma Server Action (`confirmarEnvio`), não uma rota.

### `GET /api/notificacoes` · `POST /api/notificacoes/{id}/reenviar` · RF027
**Permissão:** ADMIN. **Respostas:** 200 · 403 · 409 (limite de tentativas atingido)

### `GET /api/auditoria` · RF038
**Permissão:** ADMIN
**Parâmetros:** `usuarioId`, `dataInicio`, `dataFim`, `acao`, `entidade`, `entidadeId`, `pagina`
Não existem endpoints de escrita, alteração ou exclusão para esta entidade (RN027).

### `GET /api/configuracoes` · `PUT /api/configuracoes` · RF040
**Permissão:** ADMIN. **Respostas:** 200 · 403 · 422 (valor fora da faixa permitida)

### `GET /api/health`
**Permissão:** pública. Verifica aplicação e banco.
```json
{ "status": "ok", "banco": "ok", "versao": "1.0.0", "horario": "…" }
```
**Respostas:** 200 · 503

---

## Limites de requisição (RNF004)

| Escopo | Limite |
|---|---|
| `POST /api/auth/login` | 10 por IP a cada 15 min · 5 falhas por CPF (RN003) |
| Mutações em geral | 120 por usuário por minuto |
| `POST /api/exportacoes` | 10 por usuário por hora |
| `POST /api/importacoes` | 5 por usuário por hora |
| `POST /api/sincronizacao` | 30 por usuário por minuto · máximo 100 operações por lote |
