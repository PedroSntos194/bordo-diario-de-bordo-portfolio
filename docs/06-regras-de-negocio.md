# 06 · Regras de negócio

> Regra de negócio descreve **a política do negócio** — o que é permitido, obrigatório ou proibido.
> Não descreve funcionalidade (isso está em [`04-requisitos-funcionais.md`](04-requisitos-funcionais.md)).

---

## Identidade e acesso

**RN001 — CPF como identificador de login**
O CPF é o identificador único de acesso ao sistema. Não haverá login por e-mail ou usuário livre.

**RN002 — Unicidade e validade do CPF**
Um mesmo CPF não poderá estar vinculado a mais de um usuário ativo. O CPF deverá ser válido segundo
o algoritmo de dígitos verificadores e será armazenado apenas com dígitos, sem máscara.

**RN003 — Bloqueio por tentativas inválidas**
Após **5 tentativas de login malsucedidas consecutivas**, a conta será bloqueada por **15 minutos**.
O contador zera após um login bem-sucedido. O bloqueio é temporário e distinto da desativação
administrativa.

**RN004 — Política de senha**
A senha deverá ter no mínimo **8 caracteres**, contendo ao menos uma letra e um número. Não poderá
ser igual ao CPF, à matrícula ou à senha anterior.

**RN005 — Senha temporária**
Senha gerada pelo administrador é de uso único: expira em **72 horas** e obriga a definição de nova
senha no primeiro acesso.

**RN006 — Usuário inativo não acessa**
Usuário com status **Bloqueado**, **Inativo** ou **Excluído** não poderá autenticar, e suas sessões
ativas deverão ser encerradas imediatamente após a mudança de status.

**RN007 — Sessão única por dispositivo e expiração**
A sessão expira após **8 horas** de duração ou **60 minutos** de inatividade no perfil
Administrador, e após **12 horas** no perfil Motorista (jornada operacional longa).

## Visibilidade e permissões

**RN008 — Administrador tem visão total**
O Administrador visualiza e edita todos os registros de todos os usuários, sem restrição de escopo.

**RN009 — Motorista vê apenas o que é seu**
O Motorista só pode consultar, criar e alterar registros **vinculados ao seu próprio usuário**.
Tentativa de acesso a registro de terceiro deve retornar "não encontrado", sem revelar a existência
do recurso.

**RN010 — Último administrador não pode ser removido**
O sistema deverá impedir a exclusão, desativação ou rebaixamento de perfil do **último
administrador ativo**.

**RN011 — Autoexclusão proibida**
Nenhum usuário pode excluir, desativar ou bloquear a própria conta, nem alterar o próprio perfil de
acesso.

## Operação — jornada e corridas

**RN012 — Uma jornada por motorista por dia** ⚠️ *V-14*
Um motorista poderá ter no máximo **uma jornada por data**. Nova abertura no mesmo dia deverá
retomar a jornada existente.

**RN013 — Um veículo, uma jornada ativa**
Um veículo não poderá estar vinculado a duas jornadas em andamento simultaneamente. Só veículos com
status **Ativo** podem ser selecionados.

**RN014 — Sequência obrigatória da operação**
Corrida só pode existir dentro de uma jornada **aberta**. Não é possível encerrar a jornada com
corrida em andamento, nem iniciar corrida com outra corrida do mesmo motorista em andamento.

**RN015 — Odômetro inicial da jornada**
O odômetro inicial informado não pode ser menor que o odômetro atual registrado do veículo. Se a
diferença for superior a **500 km**, o sistema exige confirmação explícita antes de aceitar.

**RN016 — Horários coerentes**
O horário de encerramento de uma corrida deve ser posterior ao de início. Corridas do mesmo
motorista não podem se sobrepor no tempo.

**RN017 — Encerramento é obrigatório para consolidar**
Somente jornadas **encerradas** entram no resumo do dia, nos relatórios consolidados e no envio ao
administrador. Jornadas abertas aparecem apenas como pendência.

**RN018 — Cálculo dos totais**
`km da corrida = odômetro final − odômetro inicial`.
`km da jornada = soma do km das corridas`.
`duração = horário de encerramento − horário de início`, descontando o tempo de paradas registradas
como "parada longa" quando existirem. Totais são calculados pelo sistema e **não** digitados.

**RN019 — Janela de edição do motorista** ⚠️ *V-13*
Após encerrar, o motorista pode corrigir o registro por até **12 horas** (parâmetro configurável),
mediante justificativa obrigatória de no mínimo 10 caracteres. Passado o prazo, apenas o
Administrador pode alterar — também com justificativa.

**RN020 — Odômetro sempre crescente**
Para um mesmo veículo, nenhum registro de odômetro pode ser inferior ao último valor registrado.
Divergência exige justificativa e fica sinalizada no relatório.

**RN021 — Rota inativa não é selecionável**
Rotas com status Inativo não aparecem para novas corridas, mas permanecem nos registros históricos
que já as referenciam.

**RN022 — Localização é registro de fato, não editável**
Coordenadas capturadas por GPS não podem ser alteradas manualmente. Se o GPS estiver indisponível, o
registro é marcado como **sem localização** e essa condição fica visível no relatório.

**RN023 — Ocorrência não altera o registro operacional**
Uma ocorrência é um registro complementar: não modifica km, horários ou status da corrida.

**RN024 — Ações irreversíveis exigem confirmação** ⚠️ *V-12*
São consideradas irreversíveis e exigem confirmação em modal: encerrar corrida, encerrar jornada,
excluir usuário, excluir veículo, excluir rota, cancelar corrida e enviar o resumo do dia.

**RN025 — Idempotência na sincronização**
Registro criado offline carrega um identificador local único; ao sincronizar, o servidor deve
ignorar o reenvio do mesmo identificador, evitando duplicidade.

## Auditoria

**RN026 — Toda alteração é rastreada**
Criação, alteração, exclusão, login, logout, exportação e importação geram registro de auditoria com
**autor, data/hora, ação, entidade, identificador, valor anterior e valor novo**.

**RN027 — Auditoria é imutável**
Registros de auditoria não podem ser editados nem excluídos por nenhum perfil, inclusive
Administrador. São mantidos por 5 anos.

## Notificações e saídas

**RN028 — Notificação não bloqueia a operação**
Falha no envio de notificação (WhatsApp indisponível, número inválido) não impede o encerramento da
jornada nem invalida o registro. A falha fica registrada e o reenvio é possível.

**RN029 — Dado pessoal com acesso restrito** ⚠️ *V-09*
CPF e coordenadas de localização são dados pessoais: só podem ser visualizados pelo próprio titular
e por Administradores. CPF é exibido mascarado (`***.456.789-**`) em listagens.

**RN030 — Arquivo gerado é imutável e rastreável**
Planilha gerada não é regravada: cada geração produz um novo arquivo, com autor, data/hora e
parâmetros usados. O download fica restrito a quem tem permissão sobre os dados contidos.

## Importação

**RN031 — Importação é tudo ou nada por arquivo estrutural**
Arquivo fora do modelo esperado é rejeitado integralmente, sem gravar nenhuma linha.

**RN032 — Linhas inválidas não impedem as válidas**
Com estrutura correta, as linhas válidas são importadas e as inválidas são relatadas com número da
linha e motivo, permitindo correção e reenvio apenas do que falhou.
