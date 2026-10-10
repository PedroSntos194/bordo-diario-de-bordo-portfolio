# 18 · Tratamento de erros

## Princípios

1. **O usuário lê o que fazer, não o que quebrou.** Nenhuma mensagem expõe stack trace, SQL, nome de
   tabela, nome de biblioteca ou versão.
2. **Todo erro tem um responsável de camada.** Regra de negócio produz erro de negócio; falha de
   infraestrutura produz erro técnico. Não se misturam.
3. **Erro previsível não é exceção.** Odômetro incoerente é resultado esperado de uma validação, e o
   fluxo trata isso normalmente — não como falha do sistema.
4. **Nada falha em silêncio.** Toda falha registra log; toda falha visível ao usuário oferece próximo passo.
5. **Referência de suporte.** Erro inesperado gera um identificador curto exibido ao usuário e
   presente no log, permitindo rastrear o caso sem expor detalhe técnico.

---

## Taxonomia (backend)

| Classe | Origem | HTTP | Registrado como |
|---|---|---|---|
| `ErroDeValidacao` | Esquema Zod rejeitou a entrada | 400 | `warn` |
| `ErroDeAutenticacao` | Sem sessão ou sessão expirada | 401 | `info` |
| `ErroDePermissao` | Perfil sem direito à ação | 403 | `warn` + auditoria |
| `ErroNaoEncontrado` | Recurso inexistente ou fora do escopo | 404 | `info` |
| `ErroDeConflito` | Estado incompatível (corrida aberta, CPF duplicado) | 409 | `warn` |
| `ErroDeNegocio` | Regra RN violada | 422 | `warn` |
| `ErroDeLimite` | Rate limit excedido | 429 | `warn` |
| `ErroDeIntegracao` | Falha em serviço externo (WhatsApp, mapa) | 502 / degradação | `error` |
| `ErroInterno` | Qualquer exceção não prevista | 500 | `error` + alerta |

Nenhuma outra exceção chega ao usuário: o *handler* global converte o desconhecido em `ErroInterno`.

## Contrato de erro

```json
{
  "erro": {
    "codigo": "ODOMETRO_MENOR_QUE_ULTIMO",
    "mensagem": "O odômetro não pode ser menor que 84.320 km, último valor registrado para esta van.",
    "campos": { "odometroInicial": "Último valor registrado: 84.320 km" },
    "referencia": "err_01JB3K9X2M"
  }
}
```

- `codigo` — estável, em maiúsculas, consumido pelo frontend para decidir o comportamento
- `mensagem` — texto final para o usuário, em português, já pronto para exibição
- `campos` — presente apenas em erro de formulário; a chave é o nome do campo
- `referencia` — presente apenas em 500, para suporte

## Catálogo de códigos

| Código | HTTP | Mensagem ao usuário |
|---|---|---|
| `CREDENCIAIS_INVALIDAS` | 401 | CPF ou senha inválidos. |
| `CONTA_BLOQUEADA` | 403 | Muitas tentativas. Tente novamente em 15 minutos. |
| `CONTA_INATIVA` | 403 | Seu acesso está indisponível. Procure o administrador. |
| `SENHA_TEMPORARIA_EXPIRADA` | 403 | Sua senha temporária expirou. Solicite uma nova ao administrador. |
| `SENHA_FRACA` | 400 | A senha precisa ter ao menos 8 caracteres, com letra e número. |
| `SENHA_REPETIDA` | 422 | A nova senha não pode ser igual à anterior. |
| `CPF_DUPLICADO` | 409 | Já existe um usuário ativo com este CPF. |
| `CPF_INVALIDO` | 422 | CPF inválido. Confira os números digitados. |
| `ULTIMO_ADMINISTRADOR` | 409 | Não é possível remover o último administrador do sistema. |
| `ACAO_SOBRE_PROPRIA_CONTA` | 409 | Você não pode executar esta ação na sua própria conta. |
| `PLACA_DUPLICADA` | 409 | Já existe um veículo com esta placa. |
| `VEICULO_EM_USO` | 409 | Esta van já está em uma jornada em andamento. |
| `VEICULO_INATIVO` | 422 | Este veículo não está disponível para uso. |
| `ROTA_INATIVA` | 422 | Esta rota não está mais disponível. |
| `JORNADA_NAO_ABERTA` | 409 | Inicie seu dia antes de registrar uma corrida. |
| `JORNADA_JA_ENCERRADA` | 409 | Este dia já foi encerrado. |
| `JORNADA_NAO_ENCERRADA` | 409 | Encerre o dia antes de enviar o resumo ao administrador. |
| `CORRIDA_JA_EM_ANDAMENTO` | 409 | Você já tem uma corrida em andamento. Encerre-a para iniciar outra. |
| `CORRIDA_EM_ANDAMENTO` | 409 | Encerre a corrida em andamento antes de finalizar o dia. |
| `ODOMETRO_MENOR_QUE_ULTIMO` | 422 | O odômetro não pode ser menor que o último valor registrado. |
| `ODOMETRO_MENOR_QUE_INICIAL` | 422 | O odômetro final não pode ser menor que o inicial da corrida. |
| `DIVERGENCIA_ODOMETRO_NAO_CONFIRMADA` | 422 | A diferença de quilometragem é grande. Confirme para prosseguir. |
| `EXCESSO_PASSAGEIROS_NAO_CONFIRMADO` | 422 | A quantidade informada excede a capacidade da van. Confirme para prosseguir. |
| `HORARIO_INVALIDO` | 422 | O horário de encerramento precisa ser posterior ao de início. |
| `FORA_DA_JANELA_DE_EDICAO` | 403 | O prazo para corrigir este registro expirou. Procure o administrador. |
| `JUSTIFICATIVA_OBRIGATORIA` | 422 | Descreva o motivo da correção (mínimo de 10 caracteres). |
| `SEM_RESULTADOS_PARA_EXPORTAR` | 422 | Não há dados para exportar com os filtros aplicados. |
| `PERIODO_MUITO_LONGO` | 422 | Selecione um período de no máximo 12 meses. Na exportação, também cobre o teto de 5.000 linhas por arquivo, até a US031 trazer o processamento em segundo plano. |
| `CABECALHO_INVALIDO` | 422 | A planilha não segue o modelo. Baixe o modelo e tente novamente. |
| `ARQUIVO_MUITO_GRANDE` | 413 | O arquivo excede o limite de 5 MB. |
| `TIPO_ARQUIVO_NAO_PERMITIDO` | 415 | Envie um arquivo .xlsx ou .csv. |
| `ARQUIVO_EXPIRADO` | 410 | Este arquivo passou do prazo de retenção e foi removido. Gere o relatório novamente. |
| `LIMITE_EXCEDIDO` | 429 | Muitas solicitações. Aguarde um instante e tente novamente. |
| `SERVICO_INDISPONIVEL` | 502 | Serviço temporariamente indisponível. Seu registro foi salvo. |
| `ERRO_INTERNO` | 500 | Não conseguimos concluir agora. Tente novamente em alguns instantes. |

## Backend — onde cada erro nasce

```
Requisição
  → middleware        → 401 sem sessão
  → guarda de perfil  → 403 (registra auditoria)
  → validação Zod     → 400 com mapa de campos
  → caso de uso
       ├─ regra de negócio → 422 ErroDeNegocio
       ├─ conflito de estado / constraint do banco → 409 ErroDeConflito
       └─ escopo de outro usuário → 404 ErroNaoEncontrado
  → repositório
       └─ falha de conexão → 500 ErroInterno (com nova tentativa quando aplicável)
  → handler global
       └─ converte, registra com identificador e responde no contrato único
```

Violações de constraint do banco são traduzidas para código de negócio — `unique_violation` em
`(motorista_id, data)` vira `JORNADA_JA_ABERTA`, não "erro do Prisma". O banco é a última linha de
defesa contra condição de corrida, e sua mensagem nunca vaza.

Toda operação com efeito colateral roda em **transação**: falha em qualquer etapa desfaz tudo. A
gravação da auditoria participa da mesma transação da operação auditada.

## Frontend — como cada erro aparece

| Tipo | Apresentação |
|---|---|
| Validação de campo (400) | Mensagem sob o campo, borda vermelha, foco no primeiro campo inválido, `aria-describedby` |
| Regra de negócio (422) | Alerta no topo do formulário, com o campo relacionado destacado quando houver |
| Conflito (409) | Alerta com **ação de saída** — "Você já tem uma corrida em andamento" acompanha o botão "Ir para a corrida" |
| Permissão (403) | Tela T31 dedicada, ou toast quando a ação for pontual |
| Não encontrado (404) | Tela T32, com atalho para a listagem de origem |
| Sessão expirada (401) | Redirecionamento para o login com aviso e retorno ao destino original após autenticar |
| Limite (429) | Toast com o tempo de espera; botão desabilitado durante a contagem |
| Falha de conexão | Faixa persistente "Sem conexão"; ação enfileirada localmente quando o fluxo permite (RF022) |
| Erro interno (500) | Tela T33 com a referência do erro e botão "Tentar novamente" |

**Error boundary** por área (motorista, admin): um componente com defeito não derruba a aplicação
inteira. **Fallback de rota** (`error.tsx`) para exceções de renderização no servidor.

## Erros específicos do produto

**GPS indisponível ou negado** — não é erro: aviso não bloqueante, registro segue marcado como
"sem localização" (RN022). Bloquear o registro por falta de GPS faria o motorista voltar ao papel.

**Falha ao enviar WhatsApp** — não invalida o encerramento (RN028). A jornada fica encerrada, a
notificação vai para a fila com status de falha e o administrador vê a pendência.

**Falha ao gerar planilha** — o encerramento permanece válido; a geração entra em nova tentativa
automática e o administrador é notificado.

**Conflito na sincronização offline** — nunca descartar dado do motorista em silêncio: apresentar o
conflito com as duas versões e deixar a decisão explícita.

**Falha ao gravar auditoria** — não desfaz a operação principal, mas é registrada como **erro
crítico** com alerta imediato: auditoria falhando é um problema de conformidade, não de conveniência.

## Registro em log

| Nível | Uso |
|---|---|
| `error` | 500, falha de integração, falha de auditoria, falha de tarefa agendada |
| `warn` | 403, 409, 422, 429 — erros esperados que indicam padrão de uso ou tentativa indevida |
| `info` | 401, 404, login, logout, início e fim de tarefa agendada |
| `debug` | Somente em desenvolvimento |

Cada entrada carrega: identificador da requisição, rota, método, status, duração, identificador do
usuário e código do erro. **Nunca** carrega senha, token, CPF completo ou coordenadas (RNF018).
