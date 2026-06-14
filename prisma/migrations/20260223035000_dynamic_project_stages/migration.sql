CREATE TABLE IF NOT EXISTS "project_stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_stages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_stages_name_key" ON "project_stages"("name");

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "stageId" TEXT;

CREATE INDEX IF NOT EXISTS "projects_stageId_idx" ON "projects"("stageId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_stageId_fkey'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_stageId_fkey"
      FOREIGN KEY ("stageId")
      REFERENCES "project_stages"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "project_stages" ("id", "name", "sortOrder")
SELECT lower(substr(md5(random()::text || clock_timestamp()::text), 1, 24)), 'Planning', 0
WHERE NOT EXISTS (SELECT 1 FROM "project_stages" WHERE "name" = 'Planning');

INSERT INTO "project_stages" ("id", "name", "sortOrder")
SELECT lower(substr(md5(random()::text || clock_timestamp()::text), 1, 24)), 'In Progress', 1
WHERE NOT EXISTS (SELECT 1 FROM "project_stages" WHERE "name" = 'In Progress');

INSERT INTO "project_stages" ("id", "name", "sortOrder")
SELECT lower(substr(md5(random()::text || clock_timestamp()::text), 1, 24)), 'On Hold', 2
WHERE NOT EXISTS (SELECT 1 FROM "project_stages" WHERE "name" = 'On Hold');

INSERT INTO "project_stages" ("id", "name", "sortOrder")
SELECT lower(substr(md5(random()::text || clock_timestamp()::text), 1, 24)), 'Completed', 3
WHERE NOT EXISTS (SELECT 1 FROM "project_stages" WHERE "name" = 'Completed');

INSERT INTO "project_stages" ("id", "name", "sortOrder")
SELECT lower(substr(md5(random()::text || clock_timestamp()::text), 1, 24)), 'Cancelled', 4
WHERE NOT EXISTS (SELECT 1 FROM "project_stages" WHERE "name" = 'Cancelled');

UPDATE "projects"
SET "stageId" = (SELECT "id" FROM "project_stages" WHERE "name" = 'Planning')
WHERE "stageId" IS NULL AND "status" = 'PLANNING';

UPDATE "projects"
SET "stageId" = (SELECT "id" FROM "project_stages" WHERE "name" = 'In Progress')
WHERE "stageId" IS NULL AND "status" = 'IN_PROGRESS';

UPDATE "projects"
SET "stageId" = (SELECT "id" FROM "project_stages" WHERE "name" = 'On Hold')
WHERE "stageId" IS NULL AND "status" = 'ON_HOLD';

UPDATE "projects"
SET "stageId" = (SELECT "id" FROM "project_stages" WHERE "name" = 'Completed')
WHERE "stageId" IS NULL AND "status" = 'COMPLETED';

UPDATE "projects"
SET "stageId" = (SELECT "id" FROM "project_stages" WHERE "name" = 'Cancelled')
WHERE "stageId" IS NULL AND "status" = 'CANCELLED';
