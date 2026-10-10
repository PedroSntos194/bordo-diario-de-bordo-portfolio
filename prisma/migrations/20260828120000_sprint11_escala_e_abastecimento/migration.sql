-- =============================================================================
-- Sprint 11 — escala (US014) e abastecimento (US024)
--
-- A tabela `escala` existia desde a estrutura inicial e nunca teve uma linha:
-- o modelo é ajustado agora, ao ganhar código, e não há dado a migrar.
--
-- Duas correções de modelagem que só apareceram ao implementar os critérios:
--
--   1 · `turno` era anulável, e isso deixava a restrição de unicidade **sem
--       efeito** no caso mais comum. No PostgreSQL dois `NULL` são distintos,
--       então `UNIQUE (data, veiculo_id, turno)` não impedia o mesmo veículo de
--       ser escalado duas vezes no mesmo dia sem turno — que é exatamente o que
--       o critério "não é possível escalar o mesmo veículo para dois motoristas
--       na mesma data e turno" proíbe. Com a coluna obrigatória e `INTEGRAL`
--       como padrão para o dia inteiro, a garantia passa a existir de verdade.
--
--   2 · a rota vivia **dentro** da escala, e o RF013 pede "uma ou mais rotas".
--       Duas rotas para o mesmo motorista exigiriam duas linhas de escala, e aí
--       a unicidade acima recusaria a segunda. As rotas passam para tabela
--       própria, onde o plural cabe sem brigar com a restrição.
-- =============================================================================

-- US024 — o critério de aceitação pede o tipo de combustível, que o modelo
-- inicial não previa.
CREATE TYPE "TipoCombustivel" AS ENUM ('DIESEL', 'GASOLINA', 'ETANOL', 'GNV');

ALTER TABLE "abastecimento" ADD COLUMN "tipo_combustivel" "TipoCombustivel" NOT NULL DEFAULT 'DIESEL';

-- US014 — escala
ALTER TABLE "escala" DROP CONSTRAINT "escala_rota_id_fkey";

ALTER TABLE "escala" DROP COLUMN "rota_id",
  ALTER COLUMN "turno" SET NOT NULL,
  ALTER COLUMN "turno" SET DEFAULT 'INTEGRAL';

CREATE TABLE "escala_rota" (
    "escala_id" UUID NOT NULL,
    "rota_id" UUID NOT NULL,
    "ordem" SMALLINT NOT NULL,

    CONSTRAINT "escala_rota_pkey" PRIMARY KEY ("escala_id","rota_id")
);

CREATE INDEX "escala_rota_rota_id_idx" ON "escala_rota"("rota_id");

-- Um motorista também não pode estar em dois lugares no mesmo turno. O critério
-- fala do veículo; esta é a outra metade da mesma impossibilidade física, e
-- custa um índice.
CREATE UNIQUE INDEX "escala_data_motorista_id_turno_key" ON "escala"("data", "motorista_id", "turno");

ALTER TABLE "escala_rota" ADD CONSTRAINT "escala_rota_escala_id_fkey" FOREIGN KEY ("escala_id") REFERENCES "escala"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "escala_rota" ADD CONSTRAINT "escala_rota_rota_id_fkey" FOREIGN KEY ("rota_id") REFERENCES "rota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
