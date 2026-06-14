-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_entityId_fkey";

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_logs_projectId_fkey'
  ) THEN
    ALTER TABLE "activity_logs"
      ADD CONSTRAINT "activity_logs_projectId_fkey"
      FOREIGN KEY ("projectId")
      REFERENCES "projects"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
