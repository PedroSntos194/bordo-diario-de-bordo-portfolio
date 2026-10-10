-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'MOTORISTA');

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'INATIVO', 'BLOQUEADO', 'EXCLUIDO');

-- CreateEnum
CREATE TYPE "StatusVeiculo" AS ENUM ('ATIVO', 'INATIVO', 'MANUTENCAO');

-- CreateEnum
CREATE TYPE "StatusRota" AS ENUM ('ATIVA', 'INATIVA');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE', 'NOITE', 'INTEGRAL');

-- CreateEnum
CREATE TYPE "StatusJornada" AS ENUM ('ABERTA', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusCorrida" AS ENUM ('EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('INICIO', 'CHEGADA', 'SAIDA', 'EMBARQUE', 'DESEMBARQUE', 'FIM');

-- CreateEnum
CREATE TYPE "OrigemLocalizacao" AS ENUM ('GPS', 'REDE', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoOcorrencia" AS ENUM ('ATRASO', 'PANE', 'ACIDENTE', 'DESVIO', 'PASSAGEIRO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoArquivo" AS ENUM ('RELATORIO_DIARIO', 'EXPORTACAO', 'IMPORTACAO', 'RELATORIO_ERROS');

-- CreateEnum
CREATE TYPE "TipoDestinoImportacao" AS ENUM ('USUARIO', 'VEICULO', 'ROTA');

-- CreateEnum
CREATE TYPE "StatusImportacao" AS ENUM ('PROCESSANDO', 'CONCLUIDA', 'REJEITADA', 'FALHA');

-- CreateEnum
CREATE TYPE "CanalNotificacao" AS ENUM ('WHATSAPP', 'INTERNA');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('RESUMO_DIA', 'PENDENCIA_JORNADA', 'SEM_REGISTRO', 'FALHA_SISTEMA');

-- CreateEnum
CREATE TYPE "StatusNotificacao" AS ENUM ('PENDENTE', 'ENVIADA', 'FALHA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('CRIAR', 'ATUALIZAR', 'EXCLUIR', 'LOGIN', 'LOGOUT', 'LOGIN_FALHA', 'EXPORTAR', 'IMPORTAR', 'ACESSO_NEGADO');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "cpf" CHAR(11) NOT NULL,
    "telefone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(160),
    "matricula" VARCHAR(30),
    "perfil" "Perfil" NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "deve_trocar_senha" BOOLEAN NOT NULL DEFAULT true,
    "senha_temporaria_expira_em" TIMESTAMPTZ(6),
    "tentativas_login" SMALLINT NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMPTZ(6),
    "ultimo_login_em" TIMESTAMPTZ(6),
    "cnh_numero" VARCHAR(20),
    "cnh_categoria" VARCHAR(5),
    "cnh_validade" DATE,
    "status" "StatusUsuario" NOT NULL DEFAULT 'ATIVO',
    "excluido_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_por" UUID,
    "atualizado_por" UUID,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(300),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aceite_privacidade" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "versao_texto" VARCHAR(20) NOT NULL,
    "aceito_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(45),

    CONSTRAINT "aceite_privacidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculo" (
    "id" UUID NOT NULL,
    "placa" VARCHAR(8) NOT NULL,
    "modelo" VARCHAR(60) NOT NULL,
    "marca" VARCHAR(60),
    "ano" SMALLINT,
    "capacidade_passageiros" SMALLINT NOT NULL,
    "odometro_atual" INTEGER NOT NULL,
    "observacoes" TEXT,
    "status" "StatusVeiculo" NOT NULL DEFAULT 'ATIVO',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_por" UUID,
    "atualizado_por" UUID,

    CONSTRAINT "veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rota" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "origem" VARCHAR(160) NOT NULL,
    "destino" VARCHAR(160) NOT NULL,
    "turno" "Turno" NOT NULL,
    "distancia_estimada_km" DECIMAL(7,2),
    "status" "StatusRota" NOT NULL DEFAULT 'ATIVA',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_por" UUID,
    "atualizado_por" UUID,

    CONSTRAINT "rota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ponto_parada" (
    "id" UUID NOT NULL,
    "rota_id" UUID NOT NULL,
    "ordem" SMALLINT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "endereco" VARCHAR(240),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ponto_parada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escala" (
    "id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "motorista_id" UUID NOT NULL,
    "veiculo_id" UUID NOT NULL,
    "rota_id" UUID,
    "turno" "Turno",
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_por" UUID,
    "atualizado_por" UUID,

    CONSTRAINT "escala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jornada" (
    "id" UUID NOT NULL,
    "motorista_id" UUID NOT NULL,
    "veiculo_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "iniciada_em" TIMESTAMPTZ(6) NOT NULL,
    "encerrada_em" TIMESTAMPTZ(6),
    "odometro_inicial" INTEGER NOT NULL,
    "odometro_final" INTEGER,
    "km_total" DECIMAL(8,2),
    "total_corridas" SMALLINT,
    "total_passageiros" INTEGER,
    "duracao_minutos" INTEGER,
    "observacoes" TEXT,
    "client_uuid" UUID,
    "status" "StatusJornada" NOT NULL DEFAULT 'ABERTA',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_por" UUID,
    "atualizado_por" UUID,

    CONSTRAINT "jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrida" (
    "id" UUID NOT NULL,
    "jornada_id" UUID NOT NULL,
    "rota_id" UUID,
    "origem_descricao" VARCHAR(160),
    "destino_descricao" VARCHAR(160),
    "iniciada_em" TIMESTAMPTZ(6) NOT NULL,
    "encerrada_em" TIMESTAMPTZ(6),
    "odometro_inicial" INTEGER,
    "odometro_final" INTEGER,
    "km_percorrido" DECIMAL(7,2),
    "duracao_minutos" INTEGER,
    "quantidade_passageiros" SMALLINT,
    "observacoes" TEXT,
    "motivo_cancelamento" VARCHAR(240),
    "editada_em" TIMESTAMPTZ(6),
    "client_uuid" UUID,
    "status" "StatusCorrida" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_por" UUID,
    "atualizado_por" UUID,

    CONSTRAINT "corrida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrida_evento" (
    "id" UUID NOT NULL,
    "corrida_id" UUID NOT NULL,
    "ponto_parada_id" UUID,
    "tipo" "TipoEvento" NOT NULL,
    "descricao" VARCHAR(160),
    "ocorrido_em" TIMESTAMPTZ(6) NOT NULL,
    "client_uuid" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID,

    CONSTRAINT "corrida_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ponto_localizacao" (
    "id" BIGSERIAL NOT NULL,
    "corrida_id" UUID NOT NULL,
    "corrida_evento_id" UUID,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "precisao_metros" DECIMAL(7,2),
    "origem" "OrigemLocalizacao" NOT NULL,
    "capturado_em" TIMESTAMPTZ(6) NOT NULL,
    "recebido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ponto_localizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencia" (
    "id" UUID NOT NULL,
    "jornada_id" UUID NOT NULL,
    "corrida_id" UUID,
    "tipo" "TipoOcorrencia" NOT NULL,
    "descricao" TEXT NOT NULL,
    "ocorrido_em" TIMESTAMPTZ(6) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_por" UUID,
    "atualizado_por" UUID,

    CONSTRAINT "ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abastecimento" (
    "id" UUID NOT NULL,
    "jornada_id" UUID NOT NULL,
    "veiculo_id" UUID NOT NULL,
    "abastecido_em" TIMESTAMPTZ(6) NOT NULL,
    "litros" DECIMAL(7,2) NOT NULL,
    "valor_total" DECIMAL(12,2),
    "odometro" INTEGER NOT NULL,
    "posto" VARCHAR(120),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_por" UUID,
    "atualizado_por" UUID,

    CONSTRAINT "abastecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivo" (
    "id" UUID NOT NULL,
    "tipo" "TipoArquivo" NOT NULL,
    "nome_original" VARCHAR(240) NOT NULL,
    "chave_armazenamento" VARCHAR(400) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "tamanho_bytes" BIGINT NOT NULL,
    "hash_sha256" CHAR(64),
    "parametros" JSONB,
    "gerado_por" UUID,
    "expira_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacao" (
    "id" UUID NOT NULL,
    "arquivo_id" UUID NOT NULL,
    "tipo_destino" "TipoDestinoImportacao" NOT NULL,
    "linhas_total" INTEGER NOT NULL DEFAULT 0,
    "linhas_ok" INTEGER NOT NULL DEFAULT 0,
    "linhas_erro" INTEGER NOT NULL DEFAULT 0,
    "resultado" JSONB,
    "status" "StatusImportacao" NOT NULL DEFAULT 'PROCESSANDO',
    "executado_por" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacao" (
    "id" UUID NOT NULL,
    "canal" "CanalNotificacao" NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "destinatario_usuario_id" UUID,
    "destinatario_telefone" VARCHAR(20),
    "conteudo" TEXT NOT NULL,
    "arquivo_id" UUID,
    "referencia_tipo" VARCHAR(40),
    "referencia_id" UUID,
    "status" "StatusNotificacao" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" SMALLINT NOT NULL DEFAULT 0,
    "ultimo_erro" TEXT,
    "enviada_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" UUID,
    "acao" "AcaoAuditoria" NOT NULL,
    "entidade" VARCHAR(60) NOT NULL,
    "entidade_id" VARCHAR(60),
    "valor_anterior" JSONB,
    "valor_novo" JSONB,
    "justificativa" TEXT,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(300),
    "ocorrido_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao" (
    "chave" VARCHAR(60) NOT NULL,
    "valor" JSONB NOT NULL,
    "descricao" VARCHAR(240) NOT NULL,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "atualizado_por" UUID,

    CONSTRAINT "configuracao_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "usuario_perfil_status_idx" ON "usuario"("perfil", "status");

-- CreateIndex
CREATE INDEX "usuario_nome_idx" ON "usuario"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_token_hash_key" ON "sessao"("token_hash");

-- CreateIndex
CREATE INDEX "sessao_usuario_id_idx" ON "sessao"("usuario_id");

-- CreateIndex
CREATE INDEX "sessao_expira_em_idx" ON "sessao"("expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "aceite_privacidade_usuario_id_versao_texto_key" ON "aceite_privacidade"("usuario_id", "versao_texto");

-- CreateIndex
CREATE UNIQUE INDEX "veiculo_placa_key" ON "veiculo"("placa");

-- CreateIndex
CREATE INDEX "veiculo_status_idx" ON "veiculo"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rota_codigo_key" ON "rota"("codigo");

-- CreateIndex
CREATE INDEX "rota_status_turno_idx" ON "rota"("status", "turno");

-- CreateIndex
CREATE INDEX "ponto_parada_rota_id_idx" ON "ponto_parada"("rota_id");

-- CreateIndex
CREATE UNIQUE INDEX "ponto_parada_rota_id_ordem_key" ON "ponto_parada"("rota_id", "ordem");

-- CreateIndex
CREATE INDEX "escala_data_motorista_id_idx" ON "escala"("data", "motorista_id");

-- CreateIndex
CREATE UNIQUE INDEX "escala_data_veiculo_id_turno_key" ON "escala"("data", "veiculo_id", "turno");

-- CreateIndex
CREATE UNIQUE INDEX "jornada_client_uuid_key" ON "jornada"("client_uuid");

-- CreateIndex
CREATE INDEX "jornada_data_status_idx" ON "jornada"("data", "status");

-- CreateIndex
CREATE INDEX "jornada_veiculo_id_data_idx" ON "jornada"("veiculo_id", "data");

-- CreateIndex
CREATE INDEX "jornada_motorista_id_data_idx" ON "jornada"("motorista_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "corrida_client_uuid_key" ON "corrida"("client_uuid");

-- CreateIndex
CREATE INDEX "corrida_jornada_id_idx" ON "corrida"("jornada_id");

-- CreateIndex
CREATE INDEX "corrida_rota_id_iniciada_em_idx" ON "corrida"("rota_id", "iniciada_em");

-- CreateIndex
CREATE UNIQUE INDEX "corrida_evento_client_uuid_key" ON "corrida_evento"("client_uuid");

-- CreateIndex
CREATE INDEX "corrida_evento_corrida_id_ocorrido_em_idx" ON "corrida_evento"("corrida_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "ponto_localizacao_corrida_id_capturado_em_idx" ON "ponto_localizacao"("corrida_id", "capturado_em");

-- CreateIndex
CREATE INDEX "ponto_localizacao_capturado_em_idx" ON "ponto_localizacao"("capturado_em");

-- CreateIndex
CREATE INDEX "ocorrencia_jornada_id_idx" ON "ocorrencia"("jornada_id");

-- CreateIndex
CREATE INDEX "ocorrencia_tipo_ocorrido_em_idx" ON "ocorrencia"("tipo", "ocorrido_em");

-- CreateIndex
CREATE INDEX "abastecimento_veiculo_id_abastecido_em_idx" ON "abastecimento"("veiculo_id", "abastecido_em");

-- CreateIndex
CREATE INDEX "arquivo_tipo_criado_em_idx" ON "arquivo"("tipo", "criado_em");

-- CreateIndex
CREATE INDEX "arquivo_gerado_por_idx" ON "arquivo"("gerado_por");

-- CreateIndex
CREATE INDEX "importacao_status_criado_em_idx" ON "importacao"("status", "criado_em");

-- CreateIndex
CREATE INDEX "notificacao_status_criado_em_idx" ON "notificacao"("status", "criado_em");

-- CreateIndex
CREATE INDEX "notificacao_destinatario_usuario_id_idx" ON "notificacao"("destinatario_usuario_id");

-- CreateIndex
CREATE INDEX "log_auditoria_entidade_entidade_id_ocorrido_em_idx" ON "log_auditoria"("entidade", "entidade_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "log_auditoria_usuario_id_ocorrido_em_idx" ON "log_auditoria"("usuario_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "log_auditoria_ocorrido_em_idx" ON "log_auditoria"("ocorrido_em");

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceite_privacidade" ADD CONSTRAINT "aceite_privacidade_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ponto_parada" ADD CONSTRAINT "ponto_parada_rota_id_fkey" FOREIGN KEY ("rota_id") REFERENCES "rota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala" ADD CONSTRAINT "escala_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala" ADD CONSTRAINT "escala_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escala" ADD CONSTRAINT "escala_rota_id_fkey" FOREIGN KEY ("rota_id") REFERENCES "rota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornada" ADD CONSTRAINT "jornada_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornada" ADD CONSTRAINT "jornada_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrida" ADD CONSTRAINT "corrida_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrida" ADD CONSTRAINT "corrida_rota_id_fkey" FOREIGN KEY ("rota_id") REFERENCES "rota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrida_evento" ADD CONSTRAINT "corrida_evento_corrida_id_fkey" FOREIGN KEY ("corrida_id") REFERENCES "corrida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrida_evento" ADD CONSTRAINT "corrida_evento_ponto_parada_id_fkey" FOREIGN KEY ("ponto_parada_id") REFERENCES "ponto_parada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ponto_localizacao" ADD CONSTRAINT "ponto_localizacao_corrida_id_fkey" FOREIGN KEY ("corrida_id") REFERENCES "corrida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ponto_localizacao" ADD CONSTRAINT "ponto_localizacao_corrida_evento_id_fkey" FOREIGN KEY ("corrida_evento_id") REFERENCES "corrida_evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_corrida_id_fkey" FOREIGN KEY ("corrida_id") REFERENCES "corrida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencia" ADD CONSTRAINT "ocorrencia_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abastecimento" ADD CONSTRAINT "abastecimento_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivo" ADD CONSTRAINT "arquivo_gerado_por_fkey" FOREIGN KEY ("gerado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_arquivo_id_fkey" FOREIGN KEY ("arquivo_id") REFERENCES "arquivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_executado_por_fkey" FOREIGN KEY ("executado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_destinatario_usuario_id_fkey" FOREIGN KEY ("destinatario_usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_arquivo_id_fkey" FOREIGN KEY ("arquivo_id") REFERENCES "arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

