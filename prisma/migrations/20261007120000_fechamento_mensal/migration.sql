-- Fechamento mensal (observações do cliente de 07/10/2026).
--
-- Só acrescenta: feriados, pedágios, contrato da van para o boletim de medição
-- e a marca de horário vindo do celular no dia de trabalho. Nenhuma coluna
-- existente muda e nenhum dado é apagado; registros antigos ficam com os
-- campos novos vazios (contrato) ou falsos (horário do celular).

-- CreateEnum
CREATE TYPE "CategoriaMedicao" AS ENUM ('ONIBUS', 'VAN_DIURNA', 'VAN_NOTURNA');

-- CreateEnum
CREATE TYPE "FormaPagamentoPedagio" AS ENUM ('DINHEIRO', 'TAG', 'CARTAO');

-- AlterEnum
ALTER TYPE "TipoArquivo" ADD VALUE 'FECHAMENTO_MENSAL';

-- AlterTable
ALTER TABLE "veiculo" ADD COLUMN     "categoria_medicao" "CategoriaMedicao",
ADD COLUMN     "cliente" VARCHAR(60),
ADD COLUMN     "limite_km_dia" INTEGER,
ADD COLUMN     "linha_destino" VARCHAR(80),
ADD COLUMN     "linha_origem" VARCHAR(80),
ADD COLUMN     "valor_dia_extra" DECIMAL(10,2),
ADD COLUMN     "valor_km_excedido" DECIMAL(8,2),
ADD COLUMN     "valor_mensal" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "jornada" ADD COLUMN     "fim_pelo_aparelho" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inicio_pelo_aparelho" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "feriado" (
    "id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_por" UUID,
    "atualizado_por" UUID,

    CONSTRAINT "feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedagio" (
    "id" UUID NOT NULL,
    "jornada_id" UUID NOT NULL,
    "veiculo_id" UUID NOT NULL,
    "pago_em" TIMESTAMPTZ(6) NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "praca" VARCHAR(120),
    "forma_pagamento" "FormaPagamentoPedagio" NOT NULL DEFAULT 'DINHEIRO',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
    "criado_por" UUID,
    "atualizado_por" UUID,

    CONSTRAINT "pedagio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feriado_data_key" ON "feriado"("data");

-- CreateIndex
CREATE INDEX "pedagio_veiculo_id_pago_em_idx" ON "pedagio"("veiculo_id", "pago_em");

-- CreateIndex
CREATE INDEX "pedagio_jornada_id_idx" ON "pedagio"("jornada_id");

-- AddForeignKey
ALTER TABLE "pedagio" ADD CONSTRAINT "pedagio_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedagio" ADD CONSTRAINT "pedagio_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

