DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadStage') THEN
    CREATE TYPE "LeadStage" AS ENUM ('NEW', 'QUALIFIED', 'PROPOSITION', 'WON', 'LOST');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "crm_leads" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "clientName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "value" DOUBLE PRECISION,
  "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crm_leads_stage_idx" ON "crm_leads"("stage");
CREATE INDEX IF NOT EXISTS "crm_leads_title_idx" ON "crm_leads"("title");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_leads_createdById_fkey') THEN
    ALTER TABLE "crm_leads"
      ADD CONSTRAINT "crm_leads_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
