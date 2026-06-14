CREATE TABLE IF NOT EXISTS "crm_stages" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_stages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_stages_key_key" ON "crm_stages"("key");
CREATE INDEX IF NOT EXISTS "crm_stages_position_idx" ON "crm_stages"("position");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'crm_leads' AND column_name = 'stage'
  ) THEN
    ALTER TABLE "crm_leads"
      ALTER COLUMN "stage" TYPE TEXT
      USING LOWER("stage"::text);

    ALTER TABLE "crm_leads"
      ALTER COLUMN "stage" SET DEFAULT 'new';

    UPDATE "crm_leads"
    SET "stage" = 'new'
    WHERE TRIM(COALESCE("stage", '')) = '';
  END IF;
END $$;

INSERT INTO "crm_stages" ("id", "key", "label", "position", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || stage_key),
  stage_key,
  stage_label,
  row_number() OVER (ORDER BY stage_order) - 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    l."stage" AS stage_key,
    INITCAP(REPLACE(l."stage", '-', ' ')) AS stage_label,
    CASE l."stage"
      WHEN 'new' THEN 0
      WHEN 'qualified' THEN 1
      WHEN 'proposition' THEN 2
      WHEN 'won' THEN 3
      WHEN 'lost' THEN 4
      ELSE 999
    END AS stage_order
  FROM "crm_leads" l
  WHERE TRIM(COALESCE(l."stage", '')) <> ''
) stage_seed
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "crm_stages" ("id", "key", "label", "position", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || 'new'), 'new', 'New', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "crm_stages");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_stages_createdById_fkey') THEN
    ALTER TABLE "crm_stages"
      ADD CONSTRAINT "crm_stages_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeadStage') THEN
    BEGIN
      DROP TYPE "LeadStage";
    EXCEPTION
      WHEN dependent_objects_still_exist THEN NULL;
    END;
  END IF;
END $$;
