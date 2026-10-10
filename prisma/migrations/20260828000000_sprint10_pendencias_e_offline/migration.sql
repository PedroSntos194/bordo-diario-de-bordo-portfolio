-- =============================================================================
-- Sprint 10 — alerta de pendências (US038) e sincronização offline (US025)
--
-- Duas necessidades distintas que chegam juntas:
--
--   1 · o alerta de pendências precisa reconhecer que já cobrou um dia, e a
--       coluna `referencia_id` da notificação é `uuid` — uma data operacional
--       não cabe nela;
--   2 · a sincronização precisa de idempotência para operações que **atualizam**
--       (encerrar corrida, encerrar jornada). As colunas `client_uuid` das
--       tabelas de operação só cobrem quem cria linha nova.
-- =============================================================================

-- Tipos de operação que o aplicativo enfileira sem rede (RN025).
CREATE TYPE "TipoOperacaoOffline" AS ENUM ('ABRIR_JORNADA', 'INICIAR_CORRIDA', 'REGISTRAR_EVENTO', 'ENCERRAR_CORRIDA', 'ENCERRAR_JORNADA');

-- A lista consolidada que o administrador recebe cobre jornadas em aberto **e**
-- motoristas sem registro. Nenhum dos dois valores existentes a descreve, e uma
-- notificação classificada errado atrapalha justamente quem vai investigar a
-- fila depois (US037).
ALTER TYPE "TipoNotificacao" ADD VALUE 'PENDENCIA_DIA';

-- Referência que não é uuid: hoje a data operacional do alerta (US038).
ALTER TABLE "notificacao" ADD COLUMN "referencia_chave" VARCHAR(60);

-- Livro-razão da sincronização (RN025).
--
-- A chave primária é o identificador gerado no aparelho. Reenviar a mesma
-- operação colide na PK em vez de gravar duas vezes: a garantia contra
-- duplicidade fica no banco, como as demais restrições de concorrência deste
-- projeto, e não na disciplina do caso de uso.
CREATE TABLE "operacao_sincronizada" (
    "client_uuid" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "TipoOperacaoOffline" NOT NULL,
    "ocorrido_em" TIMESTAMPTZ(6) NOT NULL,
    "entidade" VARCHAR(40) NOT NULL,
    "entidade_id" UUID,
    "aplicada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operacao_sincronizada_pkey" PRIMARY KEY ("client_uuid")
);

CREATE INDEX "operacao_sincronizada_usuario_id_ocorrido_em_idx" ON "operacao_sincronizada"("usuario_id", "ocorrido_em");

CREATE INDEX "notificacao_tipo_referencia_chave_idx" ON "notificacao"("tipo", "referencia_chave");

ALTER TABLE "operacao_sincronizada" ADD CONSTRAINT "operacao_sincronizada_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
