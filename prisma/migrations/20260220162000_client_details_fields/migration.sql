-- AlterTable
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "collegeName" TEXT,
  ADD COLUMN IF NOT EXISTS "street" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "zip" TEXT,
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "serviceName" TEXT,
  ADD COLUMN IF NOT EXISTS "projectName" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" TEXT;

-- AlterTable
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "clientId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_clientId_idx" ON "projects"("clientId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_clientId_fkey'
  ) THEN
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "clients"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
