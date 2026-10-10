-- Campos adicionais. Registros anteriores mantêm tanque_cheio desconhecido.
ALTER TABLE "abastecimento" ADD COLUMN "tanque_cheio" BOOLEAN;

CREATE TABLE "folga" (
  "id" UUID NOT NULL,
  "data" DATE NOT NULL,
  "motorista_id" UUID NOT NULL,
  "observacoes" VARCHAR(240),
  "ativa" BOOLEAN NOT NULL DEFAULT true,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
  "criado_por" UUID,
  "atualizado_por" UUID,
  CONSTRAINT "folga_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "folga_data_motorista_id_key" ON "folga"("data", "motorista_id");
CREATE INDEX "folga_data_ativa_idx" ON "folga"("data", "ativa");
ALTER TABLE "folga" ADD CONSTRAINT "folga_motorista_id_fkey"
  FOREIGN KEY ("motorista_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
