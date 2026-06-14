"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  DEFAULT_CRM_PROJECT_TYPES,
  deriveCrmProjectTypeCategory,
  parseCrmProjectTypeFormData,
  parseImportedCrmProjectTypeRecord,
  type CrmProjectTypeItem,
  type ImportCrmProjectTypeRecordInput,
} from "./crm-project-types.helpers";

export type { CrmProjectTypeItem, ImportCrmProjectTypeRecordInput } from "./crm-project-types.helpers";

interface ImportCrmProjectTypeResultRow {
  rowNumber: number;
  projectName: string;
  success: boolean;
  message: string;
}

async function ensureCrmProjectTypesTable() {
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
    CREATE INDEX IF NOT EXISTS "crm_project_types_name_idx"
    ON "crm_project_types" ("name")
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
  await db.$executeRaw`
    ALTER TABLE "crm_project_types"
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Active'
  `;
  await db.$executeRaw`
    ALTER TABLE "crm_project_types"
    ADD COLUMN IF NOT EXISTS "description" TEXT NULL
  `;
}

async function seedDefaultProjectTypesIfEmpty() {
  const countRows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count" FROM "crm_project_types"
  `;
  const total = Number(countRows[0]?.count || 0);
  if (total > 0) return;

  const userRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "users"
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;
  const createdById = userRows[0]?.id;
  if (!createdById) return;

  for (const entry of DEFAULT_CRM_PROJECT_TYPES) {
    await db.$executeRaw`
      INSERT INTO "crm_project_types" (
        "id",
        "name",
        "budget",
        "category",
        "createdById",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${entry.name},
        ${entry.budget},
        ${deriveCrmProjectTypeCategory(entry.name)},
        ${createdById},
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING
    `;
  }
}

export async function getCrmProjectTypes() {
  await ensureCrmProjectTypesTable();
  await seedDefaultProjectTypesIfEmpty();
  return db.$queryRaw<CrmProjectTypeItem[]>`
    SELECT
      cpt."id",
      cpt."name",
      cpt."budget",
      COALESCE(cpt."gstPercent", 18) AS "gstPercent",
      COALESCE(NULLIF(cpt."status", ''), 'Active') AS "status",
      cpt."description",
      COALESCE(NULLIF(cpt."category", ''), CASE
        WHEN LOWER(cpt."name") LIKE '%hardware%' THEN 'Hardware'
        WHEN LOWER(cpt."name") LIKE '%software%' THEN 'Software'
        WHEN LOWER(cpt."name") LIKE '%internship%' THEN 'Internship'
        WHEN LOWER(cpt."name") LIKE '%support%' THEN 'Support'
        ELSE 'Other'
      END) AS "category",
      cpt."createdAt",
      cpt."updatedAt"
    FROM "crm_project_types" cpt
    ORDER BY cpt."createdAt" DESC
  `;
}

export async function getCrmProjectTypeById(id: string) {
  await ensureCrmProjectTypesTable();
  const rows = await db.$queryRaw<CrmProjectTypeItem[]>`
    SELECT
      cpt."id",
      cpt."name",
      cpt."budget",
      COALESCE(cpt."gstPercent", 18) AS "gstPercent",
      COALESCE(NULLIF(cpt."status", ''), 'Active') AS "status",
      cpt."description",
      COALESCE(NULLIF(cpt."category", ''), CASE
        WHEN LOWER(cpt."name") LIKE '%hardware%' THEN 'Hardware'
        WHEN LOWER(cpt."name") LIKE '%software%' THEN 'Software'
        WHEN LOWER(cpt."name") LIKE '%internship%' THEN 'Internship'
        WHEN LOWER(cpt."name") LIKE '%support%' THEN 'Support'
        ELSE 'Other'
      END) AS "category",
      cpt."createdAt",
      cpt."updatedAt"
    FROM "crm_project_types" cpt
    WHERE cpt."id" = ${id}
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function createCrmProjectType(formData: FormData) {
  const user = await requireAdmin();
  await ensureCrmProjectTypesTable();

  const { name, budget, category, gstPercent, status, description } =
    parseCrmProjectTypeFormData(formData);

  if (!name) {
    return { error: "Project type is required" };
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    return { error: "Budget must be greater than 0" };
  }
  if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) {
    return { error: "GST must be between 0 and 100" };
  }

  await db.$executeRaw`
    INSERT INTO "crm_project_types" (
      "id",
      "name",
      "budget",
      "category",
      "gstPercent",
      "status",
      "description",
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
      ${status},
      ${description},
      ${user.id},
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING
  `;

  const rows = await db.$queryRaw<CrmProjectTypeItem[]>`
    SELECT
      "id",
      "name",
      "budget",
      COALESCE("gstPercent", 18) AS "gstPercent",
      COALESCE(NULLIF("status", ''), 'Active') AS "status",
      "description",
      COALESCE(NULLIF("category", ''), ${category}) AS "category",
      "createdAt",
      "updatedAt"
    FROM "crm_project_types"
    WHERE LOWER("name") = LOWER(${name})
    LIMIT 1
  `;

  revalidatePath("/crm/projects");
  revalidatePath("/crm/quotations");
  return { success: true, data: rows[0] };
}

export async function deleteCrmProjectType(id: string) {
  await requireAdmin();
  await ensureCrmProjectTypesTable();

  await db.$executeRaw`
    DELETE FROM "crm_project_types"
    WHERE "id" = ${id}
  `;

  revalidatePath("/crm/projects");
  revalidatePath("/crm/quotations");
  return { success: true };
}

export async function updateCrmProjectType(id: string, formData: FormData) {
  await requireAdmin();
  await ensureCrmProjectTypesTable();

  const { name, budget, category, gstPercent, status, description } =
    parseCrmProjectTypeFormData(formData);

  if (!id) {
    return { error: "Project type id is required" };
  }
  if (!name) {
    return { error: "Project type is required" };
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    return { error: "Budget must be greater than 0" };
  }
  if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) {
    return { error: "GST must be between 0 and 100" };
  }

  await db.$executeRaw`
    UPDATE "crm_project_types"
    SET
      "name" = ${name},
      "budget" = ${budget},
      "category" = ${category},
      "gstPercent" = ${gstPercent},
      "status" = ${status},
      "description" = ${description},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;

  revalidatePath("/crm/projects");
  revalidatePath("/crm/quotations");
  revalidatePath(`/crm/projects/${id}`);
  return { success: true };
}

export async function importCrmProjectTypesFromRecords(records: ImportCrmProjectTypeRecordInput[]) {
  const user = await requireAdmin();
  await ensureCrmProjectTypesTable();

  if (!Array.isArray(records) || records.length === 0) {
    return { error: "Please upload a CSV file with at least one project row" };
  }

  if (records.length > 250) {
    return { error: "Please import 250 projects or fewer at a time" };
  }

  const results: ImportCrmProjectTypeResultRow[] = [];

  for (const record of records) {
    const { name, budget, gstPercent, category, status, description } =
      parseImportedCrmProjectTypeRecord(record);

    if (!name) {
      results.push({
        rowNumber: record.rowNumber,
        projectName: "",
        success: false,
        message: "Project name is required",
      });
      continue;
    }

    if (!Number.isFinite(budget) || budget <= 0) {
      results.push({
        rowNumber: record.rowNumber,
        projectName: name,
        success: false,
        message: "Budget must be greater than 0",
      });
      continue;
    }

    if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) {
      results.push({
        rowNumber: record.rowNumber,
        projectName: name,
        success: false,
        message: "GST must be between 0 and 100",
      });
      continue;
    }

    const existingRows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "crm_project_types"
      WHERE LOWER("name") = LOWER(${name})
      LIMIT 1
    `;

    if (existingRows.length > 0) {
      results.push({
        rowNumber: record.rowNumber,
        projectName: name,
        success: false,
        message: "Project already exists",
      });
      continue;
    }

    await db.$executeRaw`
      INSERT INTO "crm_project_types" (
        "id",
        "name",
        "budget",
        "category",
        "gstPercent",
        "status",
        "description",
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
        ${status},
        ${description},
        ${user.id},
        NOW(),
        NOW()
      )
    `;

    results.push({
      rowNumber: record.rowNumber,
      projectName: name,
      success: true,
      message: "Project imported successfully",
    });
  }

  revalidatePath("/crm/projects");
  revalidatePath("/crm/quotations");

  const createdCount = results.filter((result) => result.success).length;
  const failedCount = results.length - createdCount;

  return {
    success: failedCount === 0,
    createdCount,
    failedCount,
    results,
  };
}
