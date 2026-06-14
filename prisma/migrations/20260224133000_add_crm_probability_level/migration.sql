ALTER TABLE "crm_leads"
  ADD COLUMN IF NOT EXISTS "probabilityLevel" INTEGER NOT NULL DEFAULT 1;

UPDATE "crm_leads"
SET "probabilityLevel" = 1
WHERE "probabilityLevel" IS NULL OR "probabilityLevel" < 1 OR "probabilityLevel" > 3;
