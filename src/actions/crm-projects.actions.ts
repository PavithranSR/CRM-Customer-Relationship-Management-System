"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

async function ensureCrmProjectsTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_projects" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "projectCode" TEXT NULL,
      "durationDays" INTEGER NOT NULL DEFAULT 1,
      "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
      "clientName" TEXT NULL,
      "startDate" DATE NULL,
      "endDate" DATE NULL,
      "priority" TEXT NOT NULL DEFAULT 'Medium',
      "status" TEXT NOT NULL DEFAULT 'Draft',
      "description" TEXT NULL,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_projects_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "crm_projects_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "crm_projects_name_idx"
    ON "crm_projects" ("name")
  `;
  await db.$executeRaw`
    ALTER TABLE "crm_projects"
    ADD COLUMN IF NOT EXISTS "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18
  `;
}

export interface CrmProjectItem {
  id: string;
  name: string;
  category: string;
  projectCode: string | null;
  durationDays: number;
  price: number;
  gstPercent: number;
  status: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

async function getNextCrmProjectCode() {
  await ensureCrmProjectsTable();
  const rows = await db.$queryRaw<Array<{ maxCode: number | null }>>`
    SELECT COALESCE(MAX(CAST(SUBSTRING("projectCode" FROM '[0-9]+$') AS INTEGER)), 0) AS "maxCode"
    FROM "crm_projects"
    WHERE "projectCode" ~ '^PRJ-[0-9]+$'
  `;
  const nextNumber = Number(rows[0]?.maxCode || 0) + 1;
  return `PRJ-${String(nextNumber).padStart(6, "0")}`;
}

export async function generateCrmProjectCode() {
  await requireAdmin();
  return getNextCrmProjectCode();
}

export async function getCrmProjectById(id: string) {
  await ensureCrmProjectsTable();
  const rows = await db.$queryRaw<CrmProjectItem[]>`
    SELECT
      "id",
      "name",
      "category",
      "projectCode",
      "durationDays",
      "price",
      "gstPercent",
      "status",
      "description",
      "createdAt",
      "updatedAt"
    FROM "crm_projects"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  return rows[0] || null;
}

async function ensureProjectTypeFromProject(
  name: string,
  budget: number,
  category: string,
  gstPercent: number,
  userId: string
) {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_project_types" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "category" TEXT NULL,
      "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_project_types_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "crm_project_types_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `;
  await db.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "crm_project_types_name_lower_unique_idx"
    ON "crm_project_types" (LOWER("name"))
  `;
  await db.$executeRaw`
    ALTER TABLE "crm_project_types"
    ADD COLUMN IF NOT EXISTS "category" TEXT NULL
  `;
  await db.$executeRaw`
    ALTER TABLE "crm_project_types"
    ADD COLUMN IF NOT EXISTS "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18
  `;

  const existing = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "crm_project_types"
    WHERE LOWER("name") = LOWER(${name})
    LIMIT 1
  `;

  if (existing[0]?.id) {
    await db.$executeRaw`
      UPDATE "crm_project_types"
      SET "budget" = ${budget}, "category" = ${category}, "gstPercent" = ${gstPercent}, "updatedAt" = NOW()
      WHERE "id" = ${existing[0].id}
    `;
    return;
  }

  await db.$executeRaw`
    INSERT INTO "crm_project_types" (
      "id",
      "name",
      "budget",
      "category",
      "gstPercent",
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${name},
      ${budget},
      ${category},
      ${gstPercent},
      ${userId},
      NOW(),
      NOW()
    )
  `;
}

export async function createCrmProject(formData: FormData) {
  const user = await requireAdmin();
  await ensureCrmProjectsTable();

  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const projectCodeInput = String(formData.get("projectCode") || "").trim();
  const rawDuration = formData.get("durationDays");
  const rawPrice = formData.get("price") || formData.get("budgetAmount");
  const rawGstPercent = formData.get("gstPercent");
  const durationDays = Number(rawDuration || 30);
  const price = Number(rawPrice || 0);
  const gstPercent = Number(rawGstPercent || 18);
  const status = String(formData.get("status") || "Draft").trim();
  const createdDate = String(formData.get("createdDate") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!name) return { error: "Project name is required" };
  if (!category) return { error: "Project category is required" };
  if (!Number.isFinite(durationDays) || durationDays <= 0) return { error: "Duration must be greater than 0" };
  if (!Number.isFinite(price) || price <= 0) return { error: "Price must be greater than 0" };
  if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) {
    return { error: "GST must be between 0 and 100" };
  }

  const id = crypto.randomUUID();
  const projectCode = projectCodeInput || (await getNextCrmProjectCode());

  await db.$executeRaw`
    INSERT INTO "crm_projects" (
      "id",
      "name",
      "category",
      "projectCode",
      "durationDays",
      "price",
      "gstPercent",
      "status",
      "description",
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${name},
      ${category},
      ${projectCode},
      ${durationDays},
      ${price},
      ${gstPercent},
      ${status || "Draft"},
      ${description || null},
      ${user.id},
      ${createdDate ? new Date(createdDate) : new Date()},
      NOW()
    )
  `;

  await ensureProjectTypeFromProject(name, price, category, gstPercent, user.id);

  revalidatePath("/crm/projects");
  revalidatePath("/crm/quotations");

  return { success: true, id, projectCode };
}

export async function updateCrmProject(id: string, formData: FormData) {
  const user = await requireAdmin();
  await ensureCrmProjectsTable();

  if (!id) return { error: "Project id is required" };

  const existing = await getCrmProjectById(id);
  if (!existing) {
    return { error: "Project not found" };
  }

  const rawName = formData.get("name");
  const rawCategory = formData.get("category");
  const rawProjectCode = formData.get("projectCode");
  const rawDuration = formData.get("durationDays");
  const rawPrice = formData.get("price") ?? formData.get("budgetAmount");
  const rawGstPercent = formData.get("gstPercent");
  const rawStatus = formData.get("status");
  const rawDescription = formData.get("description");

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const category = typeof rawCategory === "string" ? rawCategory.trim() : "";
  const projectCodeInput = typeof rawProjectCode === "string" ? rawProjectCode.trim() : "";
  const durationDays =
    rawDuration === null || rawDuration === ""
      ? existing.durationDays
      : Number(rawDuration);
  const price =
    rawPrice === null || rawPrice === ""
      ? existing.price
      : Number(rawPrice);
  const gstPercent =
    rawGstPercent === null || rawGstPercent === ""
      ? existing.gstPercent
      : Number(rawGstPercent);
  const status =
    typeof rawStatus === "string" && rawStatus.trim()
      ? rawStatus.trim()
      : existing.status;
  const description =
    typeof rawDescription === "string" && rawDescription.trim()
      ? rawDescription.trim()
      : null;

  if (!name) return { error: "Project name is required" };
  if (!category) return { error: "Project category is required" };
  if (!Number.isFinite(durationDays) || durationDays <= 0) return { error: "Duration must be greater than 0" };
  if (!Number.isFinite(price) || price <= 0) return { error: "Price must be greater than 0" };
  if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) {
    return { error: "GST must be between 0 and 100" };
  }

  const projectCode = projectCodeInput || existing.projectCode || (await getNextCrmProjectCode());

  await db.$executeRaw`
    UPDATE "crm_projects"
    SET
      "name" = ${name},
      "category" = ${category},
      "projectCode" = ${projectCode},
      "durationDays" = ${durationDays},
      "price" = ${price},
      "gstPercent" = ${gstPercent},
      "status" = ${status},
      "description" = ${description},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;

  await ensureProjectTypeFromProject(name, price, category, gstPercent, user.id);

  revalidatePath("/crm/projects");
  revalidatePath("/crm/quotations");
  revalidatePath(`/crm/projects/${id}`);

  return { success: true, id, projectCode };
}
