import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

let timeEntrySchemaReady = false;

export async function ensureTimeEntrySchemaReady() {
  if (timeEntrySchemaReady) {
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1349824)`;

    const [typeExists] = await tx.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'TimeEntryStatus'
      ) AS "exists"
    `);

    if (!typeExists?.exists) {
      await tx.$executeRaw`
        CREATE TYPE "TimeEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED')
      `;
    }

    await tx.$executeRaw`
      ALTER TABLE "time_entries"
      ADD COLUMN IF NOT EXISTS "taskId" TEXT
    `;
    await tx.$executeRaw`
      ALTER TABLE "time_entries"
      ADD COLUMN IF NOT EXISTS "taskTitle" TEXT
    `;
    await tx.$executeRaw`
      ALTER TABLE "time_entries"
      ADD COLUMN IF NOT EXISTS "status" "TimeEntryStatus" NOT NULL DEFAULT 'DRAFT'
    `;
    await tx.$executeRaw`
      CREATE INDEX IF NOT EXISTS "time_entries_taskId_date_idx"
      ON "time_entries"("taskId", "date")
    `;
  });

  timeEntrySchemaReady = true;
}
