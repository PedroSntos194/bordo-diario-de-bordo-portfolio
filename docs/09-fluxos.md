# 09 · Fluxos do sistema

Cada fluxo traz o caminho principal, os caminhos alternativos e o tratamento de erro.

---

## F01 — Autenticação

```
Usuário
→ abre o sistema
→ tela de login (CPF + senha)
→ informa credenciais
→ sistema normaliza o CPF e valida o formato
→ sistema verifica credenciais e status da conta
→ sistema cria a sessão e registra o acesso na auditoria
→ Motorista       → tela "Meu dia"
   Administrador  → Dashboard
```

**Alternativos**
- A1 — *Primeiro acesso ou senha temporária:* após validar, o sistema desvia para a troca obrigatória
  de senha (F02) e só então segue para a tela inicial.
- A2 — *Aviso de privacidade não aceito:* o sistema exibe o aviso antes da tela inicial e registra o aceite.
- A3 — *Sessão existente válida:* ao abrir o sistema, o usuário vai direto à tela inicial, sem login.

**Erros**
- E1 — Credenciais inválidas → mensagem genérica "CPF ou senha inválidos"; contador de tentativas +1.
- E2 — 5ª tentativa inválida → conta bloqueada por 15 min; mensagem informa o tempo restante.
- E3 — Conta inativa/bloqueada pelo administrador → "Seu acesso está indisponível. Procure o administrador."
- E4 — Senha temporária expirada (>72 h) → orientação para solicitar nova senha.
- E5 — Falha de conexão → "Sem conexão com o servidor. Tente novamente." com botão de repetir.

---

## F02 — Troca obrigatória de senha

```
Usuário autenticado com indicador "deve trocar senha"
→ tela de nova senha
→ informa nova senha e confirmação
→ sistema valida política de senha (RN004)
→ sistema grava o hash, remove o indicador e audita a ação
→ redireciona para a tela inicial do perfil
```

**Erros:** senha fraca → requisitos destacados; confirmação divergente → erro no campo; senha igual
ao CPF, à matrícula ou à anterior → erro específico.

---

## F03 — Abertura da jornada (motorista)

```
Motorista
→ tela "Meu dia"
→ toca em "Iniciar meu dia"
→ seleciona o veículo (lista de veículos ativos e livres)
→ informa o odômetro inicial
→ sistema valida odômetro contra o último registro do veículo
→ sistema cria a jornada com data/hora automáticas
→ tela "Meu dia" passa a exibir a jornada aberta e o botão "Iniciar corrida"
```

**Alternativos**
- A1 — *Escala definida:* veículo já vem pré-selecionado (US014).
- A2 — *Jornada já aberta hoje:* o sistema abre a existente, sem criar outra (RN012).
- A3 — *Sem conexão:* jornada gravada localmente e marcada como pendente de sincronização (F12).

**Erros**
- E1 — Odômetro menor que o último registrado → recusa e informa o último valor conhecido.
- E2 — Odômetro mais de 500 km acima → confirmação adicional obrigatória.
- E3 — Veículo já em jornada aberta → veículo não aparece na lista; se enviado via API, retorna 409.
- E4 — Nenhum veículo ativo disponível → estado vazio orientando procurar o administrador.

---

## F04 — Corrida completa (início → paradas → encerramento)

```
Motorista com jornada aberta
→ toca em "Iniciar corrida"
→ escolhe uma rota cadastrada  (ou "corrida avulsa" → informa origem e destino)
→ confirma
→ sistema pede permissão de localização (se ainda não concedida)
→ sistema registra horário de início + coordenadas
→ corrida em andamento exibida com cronômetro
      ↓  (durante o trajeto)
   → toca no ponto de parada da lista
   → sistema registra evento (chegada/saída) + horário + coordenadas
      ↓
→ toca em "Encerrar corrida"
→ informa odômetro final, passageiros e observações
→ sistema calcula km e duração e exibe no modal de confirmação
→ confirma
→ sistema registra horário e coordenadas de encerramento
→ corrida entra na lista do dia com totais
```

**Alternativos**
- A1 — *Permissão de localização negada:* corrida prossegue marcada como "sem localização" (RN022).
- A2 — *Corrida avulsa:* sem lista de pontos; paradas são registradas com nome livre.
- A3 — *Cancelamento:* motorista cancela a corrida informando o motivo; ela fica com status
  Cancelada e não entra nos totais.
- A4 — *Sem conexão:* eventos ficam na fila local e sincronizam depois (F12).

**Erros**
- E1 — Já existe corrida em andamento → bloqueio com atalho para a corrida aberta (RN014).
- E2 — Jornada não aberta → sistema conduz primeiro ao fluxo F03.
- E3 — Odômetro final menor que o inicial → recusa com destaque no campo.
- E4 — Passageiros acima da capacidade do veículo → exige confirmação explícita.
- E5 — GPS demora mais de 10 s → prossegue sem coordenadas, com aviso não bloqueante.

---

## F05 — Encerramento da jornada e envio do resumo

```
Motorista
→ toca em "Encerrar meu dia"
→ sistema verifica se há corrida em andamento
→ solicita odômetro final do dia
→ sistema consolida totais (corridas, km, tempo, passageiros, ocorrências)
→ exibe o resumo em modal de confirmação
→ motorista confirma
→ sistema encerra a jornada, gera a planilha do dia e audita a ação
→ oferece "Enviar resumo ao administrador"
→ motorista envia pelo WhatsApp
→ sistema registra o envio (ou a pendência, se não enviado)
→ tela "Meu dia" passa a exibir o dia encerrado, em modo leitura
```

**Alternativos**
- A1 — *Envio automático (V-05 opção b):* o servidor envia sem ação do motorista.
- A2 — *Motorista não envia agora:* fica pendente e o administrador vê a jornada mesmo assim.

**Erros**
- E1 — Corrida em andamento → bloqueio informando qual, com atalho para encerrá-la (RN014).
- E2 — Odômetro final incoerente com a última corrida → recusa com o valor esperado.
- E3 — Falha na geração da planilha → jornada permanece encerrada; geração entra em nova tentativa
  e o administrador é avisado (RN028).
- E4 — Falha no envio do WhatsApp → notificação marcada como falha, com reenvio disponível.

---

## F06 — Correção de registro com justificativa

```
Motorista (dentro da janela) ou Administrador (a qualquer momento)
→ abre a corrida/jornada encerrada
→ toca em "Corrigir"
→ altera os campos permitidos
→ informa a justificativa (mínimo 10 caracteres, obrigatória)
→ confirma
→ sistema grava a alteração, registra auditoria (valor anterior × novo + justificativa)
→ registro passa a exibir a marcação "editado"
```

**Erros:** fora da janela para o motorista → ação não exibida e API retorna 403; justificativa
ausente ou curta → erro no campo; alteração de coordenadas → recusada (RN022).

---

## F07 — Acompanhamento pelo administrador

```
Administrador
→ login
→ Dashboard do dia (indicadores, corridas em andamento, pendências, ocorrências)
→ clica em um indicador
→ listagem já filtrada
→ abre uma jornada
→ detalhe com corridas, paradas, ocorrências e totais
→ [ver no mapa] | [corrigir] | [exportar Excel] | [ver histórico de alterações]
```

**Alternativos**
- A1 — *Consulta livre:* acessa "Jornadas", define período e filtros e exporta o resultado.
- A2 — *Sem registros no dia:* dashboard exibe estado vazio explicativo, não zeros isolados.

---

## F08 — Geração e exportação de planilha

```
Administrador
→ aplica filtros na listagem ou no relatório
→ toca em "Exportar Excel"
→ sistema valida se há resultados
→ até 5.000 linhas  → arquivo gerado e baixado na hora
   acima disso      → geração em segundo plano + notificação ao concluir
→ arquivo registrado no histórico e a exportação é auditada
```

**Automação diária (RF033)**
```
Agendador (horário configurável, padrão 23h)
→ seleciona as jornadas encerradas do dia
→ monta a planilha consolidada
→ grava o arquivo e registra no histórico
→ notifica o administrador com o link
→ [falha] registra o erro, tenta novamente e alerta o administrador
```

---

## F09 — Importação de cadastros por planilha

```
Administrador
→ tela "Importar"
→ escolhe o tipo (usuários | veículos | rotas)
→ baixa o modelo .xlsx
→ preenche e envia o arquivo
→ sistema valida extensão, tamanho e cabeçalho
→ sistema valida linha a linha (formato, duplicidade, obrigatoriedade)
→ exibe pré-visualização: N linhas válidas, M inválidas
→ administrador confirma a importação
→ sistema grava as linhas válidas e audita a operação
→ exibe o resultado e disponibiliza o relatório de erros em .xlsx
```

**Erros:** cabeçalho divergente → arquivo rejeitado sem gravar nada (RN031); arquivo acima de 5 MB
ou tipo não permitido → recusa antes do envio; nenhuma linha válida → importação não é confirmada.

---

## F10 — Administração de usuários

```
Administrador
→ "Usuários"
→ busca/filtra
→ [Novo usuário] → preenche → salva → sistema exibe a senha temporária uma única vez
→ [Editar]       → altera → salva → auditoria registra apenas o que mudou
→ [Redefinir senha] → confirma → nova senha temporária exibida uma vez; sessões encerradas
→ [Bloquear/Desativar/Excluir] → modal de confirmação → aplica → sessões encerradas → auditoria
```

**Erros:** CPF duplicado → recusa com destaque; último administrador → ação bloqueada (RN010);
ação sobre a própria conta → bloqueada (RN011).

---

## F11 — Alerta de pendências

```
Agendador (horário configurável)
→ busca jornadas ainda abertas do dia
→ busca motoristas ativos sem jornada no dia
→ para cada motorista: enfileira notificação individual
→ para o administrador: enfileira o consolidado de pendências
→ marca a execução do dia para não repetir
→ pendências ficam visíveis no dashboard
```

---

## F12 — Operação sem conexão e sincronização ⚠️ *V-08*

```
Motorista sem sinal
→ executa a ação (abrir jornada, iniciar/encerrar corrida, registrar parada)
→ sistema grava localmente com identificador único local e marca "pendente"
→ indicador exibe "N registros pendentes"
      ↓ (conexão restabelecida)
→ sistema envia os registros em ordem cronológica
→ servidor ignora identificadores já processados (RN025)
→ indicador volta para "Sincronizado"
```

**Erros**
- E1 — Conflito (ex.: jornada já encerrada no servidor) → apresentado ao motorista com opção de
  resolução; nunca descartado em silêncio.
- E2 — Falha persistente na sincronização → registros permanecem locais, sem perda, e o
  administrador vê a jornada como pendente.

---

## F13 — Tentativa de acesso indevido

```
Usuário tenta acessar recurso fora do seu escopo
→ middleware verifica sessão
   → sem sessão            → 401 → redireciona para o login preservando o destino
   → sessão válida, perfil insuficiente → 403 → tela "Acesso não permitido"
   → registro de outro motorista        → 404 (RN009)
→ tentativa registrada na auditoria com usuário, rota e IP
```
