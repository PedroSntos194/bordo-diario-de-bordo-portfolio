# 17 · Segurança

O cliente declarou que o sistema guarda **informações confidenciais** e que é necessário **controlar
quem vê o quê** e **registrar quem fez o quê**. Somam-se a isso dois dados pessoais sensíveis pela
natureza: **CPF** e **geolocalização de trabalhadores**.

---

## Autenticação

| Medida | Implementação |
|---|---|
| Identificador | CPF normalizado (somente dígitos) e validado por dígitos verificadores (RN001, RN002) |
| Hash de senha | **Argon2id**, salt por usuário, parâmetros de memória e iterações revisados anualmente (RNF001) |
| Política de senha | Mínimo 8 caracteres com letra e número; proibida igualdade a CPF, matrícula ou senha anterior (RN004) |
| Senha temporária | Uso único, expira em 72 h, força troca no primeiro acesso (RN005) |
| Mensagem de falha | Genérica — "CPF ou senha inválidos" — para não permitir enumeração de contas |
| Bloqueio | 5 falhas consecutivas → 15 min de bloqueio, por CPF **e** por IP (RN003, RNF004) |
| Tempo constante | Comparação de hash sempre executada, mesmo com CPF inexistente, evitando *timing attack* |
| Sessão | Token opaco de 256 bits, armazenado como hash no banco; o valor original só existe no cookie |
| Cookie | `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem dado do usuário no conteúdo |
| Expiração | 12 h (motorista) · 8 h com 60 min de inatividade (administrador) — RN007 |
| Revogação | Bloqueio, desativação ou troca de senha encerram todas as sessões ativas (RN006) |

## Autorização

Defesa em três camadas, descrita em [`13-arquitetura.md`](13-arquitetura.md):

1. **Middleware** bloqueia áreas por perfil antes de renderizar.
2. **Casos de uso** validam perfil e escopo antes de qualquer efeito.
3. **Repositórios** aplicam o filtro de propriedade na própria consulta.

Regras invioláveis:
- **Negação por padrão**: rota sem regra declarada é inacessível.
- **404 em vez de 403** para registro de outro motorista (RN009) — não revela existência.
- **Nada de autorização baseada em parâmetro do cliente**: o `motorista_id` vem sempre da sessão,
  nunca do corpo da requisição.
- Ação administrativa sobre dado de terceiro é sempre auditada com identificação de quem agiu.

## Proteção de rotas

- Todas as rotas, exceto `/login`, `/api/auth/login` e `/api/health`, exigem sessão válida.
- `middleware.ts` intercepta antes da renderização e antes de qualquer consulta.
- Rotas de API revalidam a sessão independentemente do middleware — não confiam na camada anterior.
- Redirecionamento após login usa apenas caminhos internos, com validação contra *open redirect*.

## Validação de dados

- **Zod em toda entrada**, no cliente e no servidor, com o mesmo esquema.
- O servidor **nunca** confia em validação feita no cliente.
- Listas brancas para enumerações (perfil, status, tipo) — nunca aceitar valor livre.
- Limite de tamanho em todo campo de texto, coerente com a coluna do banco.
- Coerção explícita de tipos: `"12"` não vira `12` implicitamente em campo numérico.
- Corpo de requisição limitado a 1 MB (exceto upload, limitado a 5 MB).
- Campos calculados (km, duração, totais) são **ignorados** quando enviados pelo cliente — o
  servidor recalcula sempre (RN018).

## Armazenamento de senha

Ver RNF001. Complementarmente: a senha nunca aparece em log, em resposta de API, na auditoria, em
mensagem de erro nem em URL. A senha temporária é exibida **uma única vez** e não fica recuperável.

## Upload de arquivos

| Risco | Mitigação |
|---|---|
| Arquivo executável disfarçado | Validação de extensão **e** MIME real por assinatura de bytes |
| Arquivo gigante | Limite de 5 MB, verificado antes de gravar em disco |
| Path traversal no nome | Nome original descartado; grava-se com UUID gerado |
| Execução no servidor | Storage fora da pasta pública, sem permissão de execução |
| Acesso indevido | Download apenas por rota autenticada que verifica permissão sobre o conteúdo |
| Bomba de descompressão | Limite de linhas e de células na leitura da planilha |
| Fórmula maliciosa em planilha (*CSV injection*) | Ao **gerar** arquivos, prefixar com apóstrofo valores iniciados por `=`, `+`, `-`, `@` |

## SQL Injection

Prisma gera consultas parametrizadas por padrão. `$queryRaw` só é permitido com template tag e
parâmetros vinculados; concatenação de string em SQL é proibida e verificada em revisão de código.
O usuário do banco tem apenas as permissões necessárias — sem `SUPERUSER`, sem DDL em runtime, e
**sem `UPDATE`/`DELETE` na tabela de auditoria** (RN027).

## XSS

- React escapa a saída por padrão; `dangerouslySetInnerHTML` é proibido no projeto.
- Content Security Policy restritiva, sem `unsafe-inline` para scripts, montada
  **por requisição com um `nonce`** em `src/middleware.ts`.

- Conteúdo enviado pelo usuário (observações, justificativas, descrição de ocorrência) é tratado
  sempre como texto, nunca como HTML.
- Cabeçalhos: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: DENY`, `Permissions-Policy` liberando apenas geolocalização para a própria origem.

> **Aprendizado registrado.** A primeira versão declarava `script-src 'self'` como cabeçalho
> estático no `next.config.ts`. Isso bloqueia os scripts inline que o Next injeta para hidratar o
> React: as páginas continuavam renderizando normalmente — vindas do servidor — mas **nenhum botão
> do sistema funcionava**. A falha é silenciosa; não aparece erro na tela, só uma interface inerte,
> e não é detectada por teste que use `curl` ou leia apenas o HTML do servidor.
>
> Duas consequências para o projeto: a CSP precisa de nonce por requisição (por isso vive no
> middleware, não em cabeçalho estático), e **toda funcionalidade com interação precisa ser
> exercitada num navegador de verdade** antes de ser dada como pronta.

## CSRF

Cookies com `SameSite=Lax`, token anti-CSRF nas mutações, verificação de origem (`Origin`/`Referer`)
e nenhuma operação de alteração exposta em `GET`.

## Rate limiting

Ver a tabela em [`16-api.md`](16-api.md#limites-de-requisição-rnf004). O limitador atua no proxy
reverso (proteção grosseira por IP) e na aplicação (proteção fina por usuário e por ação).

## Exposição de dados

- **CPF mascarado** em listagens; completo apenas na tela de detalhe para o administrador (RN029).
- Coordenadas visíveis somente ao próprio motorista e a administradores.
- Respostas de API retornam apenas os campos necessários à tela — sem "devolver o objeto inteiro".
- `senha_hash`, `token_hash` e `chave_armazenamento` nunca são serializados.
- Mensagens de erro em produção não expõem stack trace, SQL, nome de tabela nem versão de biblioteca.
- Listagem de diretórios desabilitada; cabeçalhos de identificação do servidor removidos.

## Variáveis de ambiente

- `.env` fora do controle de versão; `.env.example` documenta as chaves sem valores.
- Validação das variáveis na inicialização (`lib/env.ts`): faltando uma, a aplicação não sobe —
  melhor falhar no start do que em produção com valor indefinido.
- Segredos de produção sob acesso restrito, rotacionáveis, e nunca compartilhados por mensagem.
- Chaves mínimas previstas: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `STORAGE_PATH`,
  `WHATSAPP_*` (se V-05b), `TZ=America/Sao_Paulo`.

> **Achado da Sprint 7 — o `.env` entra na imagem Docker sem ninguém pedir.**
>
> `next build` com `output: 'standalone'` **copia o `.env` do diretório para
> dentro de `.next/standalone/`**. Um `COPY --from=builder /app/.next/standalone ./`
> — que é a instrução recomendada na documentação do Next — assa a string de
> conexão do banco e o `SESSAO_SECRET` numa camada da imagem, de onde qualquer
> pessoa com acesso ao registro os extrai com `docker history`.
>
> Não versionar o arquivo, que é o que a RNF005 pede, **não protege disto**:
> são riscos irmãos e independentes.
>
> O `.dockerignore` já excluía `.env` desde a Sprint 0, então a instalação nunca
> esteve exposta — mas a exclusão estava lá por higiene geral, não por causa
> deste mecanismo, e nada registrava a consequência de afrouxá-la. Agora são
> duas defesas explicadas: o `.dockerignore` mantém o arquivo fora do contexto
> de build, e o estágio final do `Dockerfile` o remove de novo, caso escape.
>
> O mesmo vale para a grafia: o `.gitignore` cobria `.env.production`, em
> inglês, mas o arquivo usado no servidor chama-se `.env.producao` — e ficaria
> versionável. Corrigido.

## Logs

- Formato JSON estruturado com identificador de requisição.
- **Nunca registrar:** senha, hash, token, cookie, CPF completo, coordenadas exatas.
- Registrar: rota, método, status, duração, identificador do usuário, IP.
- Falhas de autenticação e negações de acesso são registradas — inclusive as tentativas (RF037).
- Retenção de 6 meses para log técnico e 5 anos para auditoria de negócio (RNF007).

## LGPD

| Exigência | Como o sistema atende |
|---|---|
| **Base legal** | ⚠️ **V-09** — a definir com o cliente. Provável combinação de execução de contrato de trabalho e legítimo interesse na gestão da frota. Não é o desenvolvimento que define isso; é preciso registro formal. |
| **Finalidade** | Declarada no aviso de privacidade: controle operacional da frota |
| **Transparência** | Aviso apresentado e aceito no primeiro acesso, com registro de data/hora e versão (RF042) |
| **Minimização** | Coleta apenas dos dados necessários; GPS somente com jornada aberta (RNF006) |
| **Retenção** | Prazos definidos e aplicados por rotina automática (RNF007, US044) |
| **Acesso do titular** | Tela de perfil e exportação dos próprios registros (US035) |
| **Correção** | Solicitação ao administrador, com alteração auditada |
| **Segurança** | Medidas técnicas deste documento |
| **Rastreabilidade** | Trilha de auditoria imutável (RN026, RN027) |
| **Incidente** | Procedimento de resposta a ser definido com o cliente ⚠️ |

> **Ponto de atenção jurídico, não técnico:** monitorar a localização de empregados exige
> transparência prévia e, preferencialmente, previsão em política interna e no contrato de trabalho.
> Recomenda-se validação com a assessoria jurídica do cliente antes do go-live.

## Checklist de segurança pré-produção

- [ ] HTTPS ativo com certificado válido e renovação automática
- [ ] HSTS habilitado
- [ ] `AUTH_SECRET` de produção gerado com entropia adequada e distinto do de homologação
- [ ] Usuário do banco com privilégios mínimos e sem escrita na auditoria
- [ ] Backup executado, e **restauração testada** com sucesso
- [ ] Cabeçalhos de segurança verificados na resposta
- [ ] Rate limiting ativo e testado no login
- [ ] Nenhuma credencial no repositório (varredura de segredos executada)
- [ ] **Nenhuma credencial na imagem**: `docker history --no-trunc bordo:<versão>` e
      `docker run --rm bordo:<versão> ls -a /app` não revelam `.env` nem segredo em camada
- [ ] Dependências sem vulnerabilidade crítica conhecida (`npm audit`)
- [ ] Usuário administrador inicial criado com senha forte, entregue por canal seguro
- [ ] Aviso de privacidade publicado, versionado e aprovado pelo cliente
- [ ] Logs verificados: nenhum dado pessoal sendo registrado
- [ ] Testes de permissão por perfil aprovados (US010)
