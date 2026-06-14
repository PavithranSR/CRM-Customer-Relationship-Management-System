DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimeEntryStatus') THEN
    CREATE TYPE "TimeEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');
  END IF;
END $$;

ALTER TABLE "time_entries"
ADD COLUMN IF NOT EXISTS "taskId" TEXT,
ADD COLUMN IF NOT EXISTS "taskTitle" TEXT,
ADD COLUMN IF NOT EXISTS "status" "TimeEntryStatus" NOT NULL DEFAULT 'DRAFT';

CREATE INDEX IF NOT EXISTS "time_entries_taskId_date_idx" ON "time_entries"("taskId", "date");
