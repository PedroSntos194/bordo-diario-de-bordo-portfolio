-- =============================================================================
-- Restrições que o schema do Prisma não expressa
--
-- Todas são índices únicos PARCIAIS ou permissões. São elas que impedem, de
-- fato, os estados proibidos pelas regras de negócio: verificar em código e
-- inserir em seguida não protege contra duas requisições simultâneas.
-- A checagem na aplicação existe para a mensagem amigável; a garantia é aqui.
-- =============================================================================

-- RN002 · CPF único entre usuários não excluídos.
-- Parcial porque a exclusão é lógica: o CPF de um usuário excluído deve poder
-- ser reaproveitado se a pessoa voltar à empresa.
CREATE UNIQUE INDEX "usuario_cpf_ativo_unico"
  ON "usuario" ("cpf")
  WHERE "status" <> 'EXCLUIDO';

-- Matrícula única quando informada.
CREATE UNIQUE INDEX "usuario_matricula_unica"
  ON "usuario" ("matricula")
  WHERE "matricula" IS NOT NULL AND "status" <> 'EXCLUIDO';

-- RN012 · uma jornada por motorista por data.
-- Canceladas ficam fora: o motorista precisa poder abrir uma nova jornada no
-- mesmo dia depois de um cancelamento.
CREATE UNIQUE INDEX "jornada_motorista_data_unica"
  ON "jornada" ("motorista_id", "data")
  WHERE "status" <> 'CANCELADA';

-- RN013 · um veículo em apenas uma jornada aberta por vez.
CREATE UNIQUE INDEX "jornada_veiculo_aberta_unica"
  ON "jornada" ("veiculo_id")
  WHERE "status" = 'ABERTA';

-- RN014 · uma corrida em andamento por jornada.
CREATE UNIQUE INDEX "corrida_em_andamento_unica"
  ON "corrida" ("jornada_id")
  WHERE "status" = 'EM_ANDAMENTO';

-- Índice parcial para o dashboard: a consulta mais frequente do administrador é
-- "o que está aberto agora", e ela varre apenas uma fração da tabela.
CREATE INDEX "jornada_abertas"
  ON "jornada" ("data")
  WHERE "status" = 'ABERTA';

-- RN027 · auditoria é imutável.
-- Revogar UPDATE e DELETE no papel da aplicação garante que nem um defeito nem
-- um administrador consigam reescrever a trilha. Ajuste o nome do papel para o
-- usado no ambiente antes de aplicar em produção.
--
--   REVOKE UPDATE, DELETE ON TABLE "log_auditoria" FROM "bordo_app";
--
-- Como o nome do papel varia por ambiente, a revogação fica fora da migração
-- automática e entra no provisionamento (doc 17 · checklist pré-produção).
