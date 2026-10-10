-- =============================================================================
-- Exportação em segundo plano (US031 · RF031 · doc 16)
--
-- Fecha a dívida registrada na Sprint 9: acima de 5.000 linhas a exportação
-- respondia 422 `PERIODO_MUITO_LONGO` com instrução para estreitar o período.
-- Passa a ser admitida como tarefa, processada pelo agendador e entregue com
-- aviso ao solicitante.
--
-- ## Por que a tabela é a fila, e não o pg-boss
--
-- O pg-boss já roda quatro filas neste projeto, e seria o lugar óbvio. Ele
-- exigiria, porém, que o processo do **Next** — o mesmo que atende os
-- motoristas em campo — abrisse uma conexão de fila só para enfileirar, o que
-- contraria a razão de o agendador ser um processo separado (AD-9).
--
-- Pior: `boss.send()` acontece fora da transação do `definirAcao`. Um erro na
-- auditoria depois do envio desfaria o pedido e deixaria o trabalho na fila —
-- uma planilha gerada para uma solicitação que o banco diz que nunca existiu.
--
-- Com a tabela como fila, a linha nasce **dentro** da mesma transação que
-- audita o pedido, e o pg-boss cuida só da cadência: uma passagem por minuto
-- que reclama o que estiver pendente.
-- =============================================================================

CREATE TYPE "TipoExportacao" AS ENUM ('JORNADAS', 'CORRIDAS', 'RESUMO_DIA');

CREATE TYPE "StatusTarefa" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'FALHA');

-- O aviso de planilha pronta é notificação **interna**: o WhatsApp é para o que
-- o motorista precisa saber estando fora do sistema, e quem pediu uma
-- exportação está dentro dele.
ALTER TYPE "TipoNotificacao" ADD VALUE 'EXPORTACAO_PRONTA';

CREATE TABLE "tarefa_exportacao" (
    "id" UUID NOT NULL,
    "tipo" "TipoExportacao" NOT NULL,
    -- Filtros efetivos, com o escopo do solicitante já aplicado (RN008).
    "filtros" JSONB NOT NULL,
    "status" "StatusTarefa" NOT NULL DEFAULT 'PENDENTE',
    -- Contado na admissão, que é o que decide síncrono × segundo plano. O que
    -- a planilha realmente trouxe vai em `linhas_geradas`, à parte: o período
    -- continua recebendo registros enquanto a tarefa espera na fila.
    "linhas_previstas" INTEGER NOT NULL,
    "linhas_geradas" INTEGER,
    "arquivo_id" UUID,
    "solicitado_por" UUID NOT NULL,
    "tentativas" SMALLINT NOT NULL DEFAULT 0,
    "erro" TEXT,
    "iniciada_em" TIMESTAMPTZ(6),
    "concluida_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tarefa_exportacao_pkey" PRIMARY KEY ("id")
);

-- A reclamação da próxima tarefa varre por status em ordem de chegada; a
-- listagem do solicitante varre pelo dono. São os dois únicos acessos.
CREATE INDEX "tarefa_exportacao_status_criado_em_idx" ON "tarefa_exportacao"("status", "criado_em");

CREATE INDEX "tarefa_exportacao_solicitado_por_criado_em_idx" ON "tarefa_exportacao"("solicitado_por", "criado_em");

-- `SET NULL` e não `CASCADE`: quando o expurgo levar o arquivo, o histórico de
-- que a exportação foi pedida e concluída continua de pé — some o download,
-- não o registro de que alguém extraiu aquele recorte (RN030).
ALTER TABLE "tarefa_exportacao" ADD CONSTRAINT "tarefa_exportacao_arquivo_id_fkey" FOREIGN KEY ("arquivo_id") REFERENCES "arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tarefa_exportacao" ADD CONSTRAINT "tarefa_exportacao_solicitado_por_fkey" FOREIGN KEY ("solicitado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
