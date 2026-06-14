"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActionPermission, requireModuleAccess } from "@/lib/auth";
import {
  sanitizeListByFieldPermissions,
  sanitizeRecordByFieldPermissions,
  stripRestrictedFormFields,
} from "@/lib/employee-permissions";
import { getCrmAllowedCreatorIds } from "@/lib/crm-record-rules.server";
import { createLeadSchema, leadStageSchema, updateLeadSchema } from "@/lib/validations/crm.schema";
import { logActivity } from "./activity-log.actions";

export type LeadStage = string;

export interface CrmStageItem {
  id: string;
  key: string;
  label: string;
  position: number;
}

export interface CrmLeadItem {
  id: string;
  title: string;
  ownerId?: string | null;
  clientName: string | null;
  email: string | null;
  phone: string | null;
  value: number | null;
  probabilityLevel: number;
  quotationTotal?: number | null;
  paidAmount?: number | null;
  balanceAmount?: number | null;
  serviceName: string | null;
  unitName: string | null;
  unitCount: number | null;
  unitPrice: number | null;
  costPerUnit: number | null;
  gstPercent: number | null;
  subtotalAmount: number | null;
  gstAmount: number | null;
  finalAmount: number | null;
  profitAmount: number | null;
  invoicingPolicy: string | null;
  tags: string | null;
  expectedClosingDate: Date | null;
  notes: string | null;
  createdById?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdByRole?: string | null;
  stage: LeadStage;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmLeadActivityLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  createdBy: {
    name: string | null;
    email?: string | null;
  } | null;
}

interface DeletedLeadMetaRow {
  leadId: string;
  previousStage: string | null;
  deletedById: string;
  deletedAt: Date;
}

interface ArchivedLeadMetaRow {
  leadId: string;
  previousStage: string | null;
  archivedById: string;
  archivedAt: Date;
}

interface GetCrmLeadsInput {
  query?: string;
}

const DEFAULT_STAGE_KEY = "new";
const DEFAULT_STAGE_LABEL = "New";

const normalizeStageKey = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

async function ensureCrmLeadOwnership() {
  return;
}

async function ensureCrmLeadSourceTypeColumn() {
  await db.$executeRaw`
    ALTER TABLE "crm_leads"
    ADD COLUMN IF NOT EXISTS "leadSourceType" TEXT
  `;
}

async function resolveLeadOwnerId(preferredOwnerId: FormDataEntryValue | null, fallbackOwnerId: string) {
  const requestedOwnerId =
    typeof preferredOwnerId === "string" && preferredOwnerId.trim().length > 0
      ? preferredOwnerId.trim()
      : fallbackOwnerId;

  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "users"
    WHERE "id" = ${requestedOwnerId} AND "isActive" = true
    LIMIT 1
  `;

  return rows[0]?.id || fallbackOwnerId;
}

const normalizeClientLookupValue = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

const normalizeClientPhone = (value: string | null | undefined) =>
  (value || "").replace(/\D/g, "");

async function resolveExistingCrmClient(input: {
  clientName?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const clientName = (input.clientName || "").trim();
  const email = (input.email || "").trim();
  const phone = (input.phone || "").trim();

  if (!clientName && !email && !phone) {
    return {
      client: null as null,
      error: "Add or select a client before creating the lead",
    };
  }

  const orConditions: Prisma.ClientWhereInput[] = [];
  if (clientName) {
    orConditions.push({ name: { equals: clientName, mode: "insensitive" } });
  }
  if (email) {
    orConditions.push({ email: { equals: email, mode: "insensitive" } });
  }
  if (phone) {
    orConditions.push({ phone });
  }

  const matches = await db.client.findMany({
    where: { OR: orConditions },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
    take: 10,
  });

  const matchedClient =
    matches.find((client) => normalizeClientLookupValue(client.name) === normalizeClientLookupValue(clientName)) ||
    matches.find((client) => normalizeClientLookupValue(client.email) === normalizeClientLookupValue(email)) ||
    matches.find((client) => normalizeClientPhone(client.phone) === normalizeClientPhone(phone));

  if (!matchedClient) {
    return {
      client: null as null,
      error: "Add the client in Clients first, then create the lead",
    };
  }

  return {
    client: matchedClient,
    error: undefined as string | undefined,
  };
}

async function getCurrentCrmScope(userId: string, role: string, permissions: unknown) {
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    userId,
    role,
    permissions as { recordRules?: string[] } | null,
  );
  return allowedCreatorIds;
}

function buildCrmScopeFilterSql(alias: string, allowedCreatorIds: string[] | null) {
  if (allowedCreatorIds === null) {
    return Prisma.sql`TRUE`;
  }
  if (allowedCreatorIds.length === 0) {
    return Prisma.sql`FALSE`;
  }
  return Prisma.sql`(${Prisma.raw(alias)}."createdById" IN (${Prisma.join(allowedCreatorIds)}) OR ${Prisma.raw(alias)}."ownerId" IN (${Prisma.join(allowedCreatorIds)}))`;
}
async function resolveCreatedById(userId: string) {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "users" WHERE "id" = ${userId} LIMIT 1
  `;
  if (rows[0]?.id) return rows[0].id;

  const fallback = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1
  `;
  return fallback[0]?.id || null;
}

async function ensureUserRow(user: { id: string; email?: string | null; name?: string | null; role?: string }) {
  const existing = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "users" WHERE "id" = ${user.id} LIMIT 1
  `;
  if (existing[0]?.id) return existing[0].id;

  const fallbackEmail = user.email || `${user.id}@local`;
  const fallbackName = user.name || "User";
  const fallbackRole = (user.role as "ADMIN" | "EMPLOYEE" | "BA" | "TEAMLEADER") || "ADMIN";

  const created = await db.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "users" (
      "id",
      "email",
      "password",
      "name",
      "role",
      "isActive",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${user.id},
      ${fallbackEmail},
      'oauth',
      ${fallbackName},
      ${fallbackRole}::"Role",
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT ("id") DO NOTHING
    RETURNING "id"
  `;

  return created[0]?.id || null;
}

async function ensureCrmStages(createdById?: string) {
  const safeCreatedById = createdById ? await resolveCreatedById(createdById) : null;
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_stages" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "position" INTEGER NOT NULL,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_stages_pkey" PRIMARY KEY ("id")
    )
  `;
  await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "crm_stages_key_key" ON "crm_stages"("key")`;
  await db.$executeRaw`CREATE INDEX IF NOT EXISTS "crm_stages_position_idx" ON "crm_stages"("position")`;

  const stageColumn = await db.$queryRaw<{ data_type: string; udt_name: string }[]>`
    SELECT "data_type", "udt_name"
    FROM "information_schema"."columns"
    WHERE "table_name" = 'crm_leads' AND "column_name" = 'stage'
    LIMIT 1
  `;

  const columnInfo = stageColumn[0];
  const needsTextConversion = columnInfo && columnInfo.data_type !== "text";
  if (needsTextConversion) {
    await db.$executeRaw`
      ALTER TABLE "crm_leads"
      ALTER COLUMN "stage" TYPE TEXT
      USING LOWER("stage"::text)
    `;
    await db.$executeRaw`ALTER TABLE "crm_leads" ALTER COLUMN "stage" SET DEFAULT 'new'`;
  }

  await db.$executeRaw`
    UPDATE "crm_leads"
    SET "stage" = 'new'
    WHERE TRIM(COALESCE("stage", '')) = ''
  `;

  await db.$executeRaw`
    ALTER TABLE "crm_leads"
    ADD COLUMN IF NOT EXISTS "probabilityLevel" INTEGER NOT NULL DEFAULT 1
  `;

  await db.$executeRaw`
    UPDATE "crm_leads"
    SET "probabilityLevel" = 1
    WHERE "probabilityLevel" IS NULL OR "probabilityLevel" < 1 OR "probabilityLevel" > 3
  `;

  const existing = await db.$queryRaw<CrmStageItem[]>`
    SELECT "id", "key", "label", "position"
    FROM "crm_stages"
    ORDER BY "position" ASC, "createdAt" ASC
  `;

  if (existing.length > 0) {
    return existing;
  }

  const fromLeads = await db.$queryRaw<{ stage: string }[]>`
    SELECT DISTINCT "stage"
    FROM "crm_leads"
    WHERE TRIM(COALESCE("stage", '')) <> ''
    ORDER BY "stage" ASC
  `;

  const stagesToCreate = fromLeads.length > 0
    ? fromLeads.map((item, index) => {
        const key = normalizeStageKey(item.stage) || `stage-${index + 1}`;
        return { key, label: item.stage.trim(), position: index };
      })
    : [{ key: DEFAULT_STAGE_KEY, label: DEFAULT_STAGE_LABEL, position: 0 }];

  for (const stage of stagesToCreate) {
    await db.$executeRaw`
      INSERT INTO "crm_stages" ("id", "key", "label", "position", "createdById", "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${stage.key}, ${stage.label}, ${stage.position}, ${safeCreatedById ?? null}, NOW(), NOW())
      ON CONFLICT ("key") DO NOTHING
    `;
  }

  if (fromLeads.length > 0) {
    const firstKey = stagesToCreate[0]?.key ?? DEFAULT_STAGE_KEY;
    for (const row of fromLeads) {
      const normalized = normalizeStageKey(row.stage) || firstKey;
      await db.$executeRaw`
        UPDATE "crm_leads"
        SET "stage" = ${normalized}
        WHERE "stage" = ${row.stage}
      `;
    }
  }

  return db.$queryRaw<CrmStageItem[]>`
    SELECT "id", "key", "label", "position"
    FROM "crm_stages"
    ORDER BY "position" ASC, "createdAt" ASC
  `;
}

async function ensureDeletedLeadsMetaTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_deleted_leads_meta" (
      "leadId" TEXT NOT NULL,
      "previousStage" TEXT,
      "deletedById" TEXT NOT NULL,
      "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_deleted_leads_meta_pkey" PRIMARY KEY ("leadId")
    )
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "crm_deleted_leads_meta_deletedAt_idx"
    ON "crm_deleted_leads_meta" ("deletedAt" DESC)
  `;
}

async function ensureArchivedLeadsMetaTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_archived_leads_meta" (
      "leadId" TEXT NOT NULL,
      "previousStage" TEXT,
      "archivedById" TEXT NOT NULL,
      "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_archived_leads_meta_pkey" PRIMARY KEY ("leadId")
    )
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "crm_archived_leads_meta_archivedAt_idx"
    ON "crm_archived_leads_meta" ("archivedAt" DESC)
  `;
}

export async function getCrmStages() {
  return ensureCrmStages();
}

export async function getCrmLeads(input: GetCrmLeadsInput = {}) {
  const user = await requireModuleAccess("CRM");
  await ensureCrmLeadOwnership();
  await ensureCrmStages();
  const query = input.query?.trim() || "";
  const searchTerm = `%${query}%`;
  const allowedCreatorIds = await getCurrentCrmScope(
    user.id,
    user.role,
    user.permissions
  );

  const filters: Prisma.Sql[] = [buildCrmScopeFilterSql("l", allowedCreatorIds)];
  if (query) {
    filters.push(Prisma.sql`
      (
        l."title" ILIKE ${searchTerm}
        OR COALESCE(l."clientName", '') ILIKE ${searchTerm}
        OR COALESCE(l."email", '') ILIKE ${searchTerm}
        OR COALESCE(l."phone", '') ILIKE ${searchTerm}
        OR COALESCE(l."notes", '') ILIKE ${searchTerm}
      )
    `);
  }
  const whereClause = filters.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
    : Prisma.empty;

  const leads = await db.$queryRaw<CrmLeadItem[]>`
    SELECT
      l."id",
      l."title",
      l."clientName",
      l."email",
      l."phone",
      l."value",
      l."probabilityLevel",
      q."totalAmount" AS "quotationTotal",
      CASE
        WHEN q."id" IS NULL OR i."id" IS NULL THEN 0
        ELSE ROUND((q."totalAmount" - i."balanceAmount")::numeric, 2)::double precision
      END AS "paidAmount",
      CASE
        WHEN q."id" IS NULL THEN l."value"
        WHEN i."id" IS NULL THEN ROUND(q."totalAmount"::numeric, 2)::double precision
        ELSE ROUND(i."balanceAmount"::numeric, 2)::double precision
      END AS "balanceAmount",
      l."serviceName",
      l."unitName",
      l."unitCount",
      l."unitPrice",
      l."costPerUnit",
      l."gstPercent",
      l."subtotalAmount",
      l."gstAmount",
      l."finalAmount",
      l."profitAmount",
      l."invoicingPolicy",
      l."tags",
      l."expectedClosingDate",
      l."notes",
      l."createdById",
      u."name" AS "createdByName",
      u."email" AS "createdByEmail",
      u."role"::text AS "createdByRole",
      l."stage"::text AS "stage",
      l."createdAt",
      l."updatedAt"
    FROM "crm_leads" l
    LEFT JOIN "users" u
      ON u."id" = l."createdById"
    LEFT JOIN LATERAL (
      SELECT
        ql."id",
        ql."totalAmount"
      FROM "crm_quotations" ql
      WHERE ql."crmLeadId" = l."id"
      ORDER BY ql."createdAt" DESC
      LIMIT 1
    ) q ON TRUE
    LEFT JOIN "crm_quotation_invoices" i
      ON i."quotationId" = q."id"
    ${whereClause}
    ORDER BY l."updatedAt" DESC
  `;

  const visibleLeads =
    user.role === "ADMIN"
      ? leads
      : (sanitizeListByFieldPermissions(
          leads as unknown as Record<string, unknown>[],
          user.permissions
        ) as unknown as CrmLeadItem[]);

  return { leads: visibleLeads, query };
}

export async function createCrmLead(formData: FormData) {
  const user = await requireActionPermission("CREATE", "CRM");
  await ensureCrmLeadOwnership();
  await ensureCrmLeadSourceTypeColumn();
  if (user.role !== "ADMIN") {
    stripRestrictedFormFields(formData, user.permissions);
  }
  const createdById = await ensureUserRow(user);
  if (!createdById) {
    return { error: "No valid user found to create CRM lead" };
  }
  const stageList = await ensureCrmStages(createdById);
  const fallbackStage = stageList[0]?.key ?? DEFAULT_STAGE_KEY;
  const assignedOwnerId = await resolveLeadOwnerId(formData.get("ownerId"), user.id);
  const leadSourceType =
    typeof formData.get("leadSourceType") === "string"
      ? String(formData.get("leadSourceType")).trim().slice(0, 80)
      : "";

  const validatedFields = createLeadSchema.safeParse({
    title: formData.get("title"),
    clientName: formData.get("clientName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    value: formData.get("value") || undefined,
    probabilityLevel: formData.get("probabilityLevel") || 1,
    serviceName: formData.get("serviceName") || undefined,
    unitName: formData.get("unitName") || undefined,
    unitCount: formData.get("unitCount") || undefined,
    unitPrice: formData.get("unitPrice") || undefined,
    costPerUnit: formData.get("costPerUnit") || undefined,
    gstPercent: formData.get("gstPercent") || undefined,
    subtotalAmount: formData.get("subtotalAmount") || undefined,
    gstAmount: formData.get("gstAmount") || undefined,
    finalAmount: formData.get("finalAmount") || undefined,
    profitAmount: formData.get("profitAmount") || undefined,
    invoicingPolicy: formData.get("invoicingPolicy") || undefined,
    tags: formData.get("tags") || undefined,
    expectedClosingDate: formData.get("expectedClosingDate") || undefined,
    notes: formData.get("notes") || undefined,
    stage: formData.get("stage") || fallbackStage,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const resolvedClient = await resolveExistingCrmClient({
    clientName: validatedFields.data.clientName,
    email: validatedFields.data.email,
    phone: validatedFields.data.phone,
  });
  if (resolvedClient.error) {
    return { error: resolvedClient.error };
  }
  const matchedClient = resolvedClient.client;
  if (!matchedClient) {
    return { error: "Add the client in Clients first, then create the lead" };
  }

  const leadId = crypto.randomUUID();
  const rows = await db.$queryRaw<CrmLeadItem[]>`
    INSERT INTO "crm_leads" (
      "id", "title", "clientName", "email", "phone", "value", "probabilityLevel",
      "serviceName", "unitName", "unitCount", "unitPrice", "costPerUnit",
      "gstPercent", "subtotalAmount", "gstAmount", "finalAmount", "profitAmount",
      "invoicingPolicy", "tags", "expectedClosingDate", "leadSourceType", "ownerId",
      "notes", "stage", "createdById", "createdAt", "updatedAt"
    )
    VALUES (
      ${leadId},
      ${validatedFields.data.title},
      ${matchedClient.name},
      ${validatedFields.data.email || null},
      ${validatedFields.data.phone || null},
      ${validatedFields.data.value || null},
      ${validatedFields.data.probabilityLevel},
      ${formData.get("serviceName") || null},
      ${formData.get("unitName") || null},
      ${formData.get("unitCount") ? Number(formData.get("unitCount")) : null},
      ${formData.get("unitPrice") ? Number(formData.get("unitPrice")) : null},
      ${formData.get("costPerUnit") ? Number(formData.get("costPerUnit")) : null},
      ${formData.get("gstPercent") ? Number(formData.get("gstPercent")) : 18},
      ${formData.get("subtotalAmount") ? Number(formData.get("subtotalAmount")) : null},
      ${formData.get("gstAmount") ? Number(formData.get("gstAmount")) : null},
      ${formData.get("finalAmount") ? Number(formData.get("finalAmount")) : null},
      ${formData.get("profitAmount") ? Number(formData.get("profitAmount")) : null},
      ${formData.get("invoicingPolicy") || null},
      ${formData.get("tags") || null},
      ${formData.get("expectedClosingDate") ? new Date(String(formData.get("expectedClosingDate"))) : null},
      ${leadSourceType || null},
      ${assignedOwnerId},
      ${validatedFields.data.notes || null},
      ${validatedFields.data.stage},
      ${createdById},
      NOW(),
      NOW()
    )
    RETURNING
      "id", "title", "clientName", "email", "phone", "value", "probabilityLevel",
      "serviceName", "unitName", "unitCount", "unitPrice", "costPerUnit",
      "gstPercent", "subtotalAmount", "gstAmount", "finalAmount", "profitAmount",
      "invoicingPolicy", "tags", "expectedClosingDate",
      "notes", "stage"::text AS "stage", "createdAt", "updatedAt"
  `;

  await logActivity({
    action: "CREATE",
    entityType: "crm_lead",
    entityId: leadId,
    createdById,
    metadata: {
      title: validatedFields.data.title,
      stage: validatedFields.data.stage,
      clientName: matchedClient.name,
      leadSourceType: leadSourceType || null,
      ownerId: assignedOwnerId,
    },
  });

  revalidatePath("/crm");
  revalidatePath("/crm/generate-leads");
  return { success: true, data: rows[0] };
}

export async function updateCrmLead(id: string, formData: FormData) {
  const user = await requireActionPermission("UPDATE", "CRM");
  await ensureCrmLeadOwnership();
  if (user.role !== "ADMIN") {
    stripRestrictedFormFields(formData, user.permissions);
  }
  const allowedCreatorIds = await getCurrentCrmScope(
    user.id,
    user.role,
    user.permissions
  );
  const leadScopeFilter = buildCrmScopeFilterSql("crm_leads", allowedCreatorIds);
  const allowedRows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "crm_leads"
    WHERE "id" = ${id} AND ${leadScopeFilter}
    LIMIT 1
  `;
  if (allowedRows.length === 0) {
    return { error: "Forbidden" };
  }

  const validatedFields = updateLeadSchema.safeParse({
    title: formData.get("title") || undefined,
    clientName: formData.get("clientName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    value: formData.get("value") || undefined,
    probabilityLevel: formData.get("probabilityLevel") || undefined,
    serviceName: formData.get("serviceName") || undefined,
    unitName: formData.get("unitName") || undefined,
    unitCount: formData.get("unitCount") || undefined,
    unitPrice: formData.get("unitPrice") || undefined,
    costPerUnit: formData.get("costPerUnit") || undefined,
    gstPercent: formData.get("gstPercent") || undefined,
    subtotalAmount: formData.get("subtotalAmount") || undefined,
    gstAmount: formData.get("gstAmount") || undefined,
    finalAmount: formData.get("finalAmount") || undefined,
    profitAmount: formData.get("profitAmount") || undefined,
    invoicingPolicy: formData.get("invoicingPolicy") || undefined,
    tags: formData.get("tags") || undefined,
    expectedClosingDate: formData.get("expectedClosingDate") || undefined,
    notes: formData.get("notes") || undefined,
    stage: formData.get("stage") || undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const current = await db.$queryRaw<CrmLeadItem[]>`
    SELECT
      "id", "title", "clientName", "email", "phone", "value", "probabilityLevel",
      "serviceName", "unitName", "unitCount", "unitPrice", "costPerUnit",
      "gstPercent", "subtotalAmount", "gstAmount", "finalAmount", "profitAmount",
      "invoicingPolicy", "tags", "expectedClosingDate",
      "notes", "stage"::text AS "stage", "createdAt", "updatedAt"
    FROM "crm_leads"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  if (current.length === 0) {
    return { error: "Lead not found" };
  }

  const lead = current[0];
  const updated = await db.$queryRaw<CrmLeadItem[]>`
    UPDATE "crm_leads"
    SET
      "title" = ${validatedFields.data.title ?? lead.title},
      "clientName" = ${validatedFields.data.clientName ?? lead.clientName},
      "email" = ${validatedFields.data.email ?? lead.email},
      "phone" = ${validatedFields.data.phone ?? lead.phone},
      "value" = ${validatedFields.data.value ?? lead.value},
      "probabilityLevel" = ${validatedFields.data.probabilityLevel ?? lead.probabilityLevel},
      "serviceName" = ${formData.get("serviceName") ?? lead.serviceName},
      "unitName" = ${formData.get("unitName") ?? lead.unitName},
      "unitCount" = ${formData.get("unitCount") ? Number(formData.get("unitCount")) : lead.unitCount},
      "unitPrice" = ${formData.get("unitPrice") ? Number(formData.get("unitPrice")) : lead.unitPrice},
      "costPerUnit" = ${formData.get("costPerUnit") ? Number(formData.get("costPerUnit")) : lead.costPerUnit},
      "gstPercent" = ${formData.get("gstPercent") ? Number(formData.get("gstPercent")) : lead.gstPercent},
      "subtotalAmount" = ${formData.get("subtotalAmount") ? Number(formData.get("subtotalAmount")) : lead.subtotalAmount},
      "gstAmount" = ${formData.get("gstAmount") ? Number(formData.get("gstAmount")) : lead.gstAmount},
      "finalAmount" = ${formData.get("finalAmount") ? Number(formData.get("finalAmount")) : lead.finalAmount},
      "profitAmount" = ${formData.get("profitAmount") ? Number(formData.get("profitAmount")) : lead.profitAmount},
      "invoicingPolicy" = ${formData.get("invoicingPolicy") ?? lead.invoicingPolicy},
      "tags" = ${formData.get("tags") ?? lead.tags},
      "expectedClosingDate" = ${
        formData.get("expectedClosingDate")
          ? new Date(String(formData.get("expectedClosingDate")))
          : lead.expectedClosingDate
      },
      "notes" = ${validatedFields.data.notes ?? lead.notes},
      "stage" = ${validatedFields.data.stage ?? lead.stage},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING
      "id", "title", "clientName", "email", "phone", "value", "probabilityLevel",
      "serviceName", "unitName", "unitCount", "unitPrice", "costPerUnit",
      "gstPercent", "subtotalAmount", "gstAmount", "finalAmount", "profitAmount",
      "invoicingPolicy", "tags", "expectedClosingDate",
      "notes", "stage"::text AS "stage", "createdAt", "updatedAt"
  `;

  await logActivity({
    action: "UPDATE",
    entityType: "crm_lead",
    entityId: id,
    createdById: user.id,
    metadata: {
      changes: Object.keys(validatedFields.data),
    },
  });

  revalidatePath("/crm");
  return { success: true, data: updated[0] };
}

export async function moveCrmLeadStage(id: string, stage: LeadStage) {
  const user = await requireActionPermission("UPDATE", "CRM");
  await ensureCrmLeadOwnership();
  const allowedCreatorIds = await getCurrentCrmScope(
    user.id,
    user.role,
    user.permissions
  );
  const leadScopeFilter = buildCrmScopeFilterSql("crm_leads", allowedCreatorIds);
  const allowedRows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "crm_leads"
    WHERE "id" = ${id} AND ${leadScopeFilter}
    LIMIT 1
  `;
  if (allowedRows.length === 0) {
    return { error: "Forbidden" };
  }
  const stages = await ensureCrmStages(user.id);

  const parsedStage = leadStageSchema.safeParse(stage);
  if (!parsedStage.success) {
    return { error: "Invalid stage" };
  }
  if (!stages.some((item) => item.key === parsedStage.data)) {
    return { error: "Stage not found" };
  }

  const updated = await db.$queryRaw<CrmLeadItem[]>`
    UPDATE "crm_leads"
    SET
      "stage" = ${parsedStage.data},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING
      "id", "title", "clientName", "email", "phone", "value", "probabilityLevel",
      "serviceName", "unitName", "unitCount", "unitPrice", "costPerUnit",
      "gstPercent", "subtotalAmount", "gstAmount", "finalAmount", "profitAmount",
      "invoicingPolicy", "tags", "expectedClosingDate",
      "notes", "stage"::text AS "stage", "createdAt", "updatedAt"
  `;

  if (updated.length === 0) {
    return { error: "Lead not found" };
  }

  await logActivity({
    action: "STATUS_CHANGE",
    entityType: "crm_lead",
    entityId: id,
    createdById: user.id,
    metadata: {
      stage: parsedStage.data,
      title: updated[0].title,
    },
  });

  revalidatePath("/crm");
  return { success: true, data: updated[0] };
}

export async function addCrmLeadChatterEntry(
  id: string,
  mode: "message" | "note",
  body: string,
) {
  const user = await requireActionPermission("UPDATE", "CRM");
  await ensureCrmLeadOwnership();

  const trimmedBody = body.trim();
  if (!trimmedBody) {
    return { error: mode === "message" ? "Message is required" : "Note is required" };
  }

  if (trimmedBody.length > 2000) {
    return { error: "Keep the text under 2000 characters" };
  }

  const allowedCreatorIds = await getCurrentCrmScope(
    user.id,
    user.role,
    user.permissions
  );
  const leadScopeFilter = buildCrmScopeFilterSql("crm_leads", allowedCreatorIds);
  const leadRows = await db.$queryRaw<Array<{ id: string; title: string | null; clientName: string | null }>>`
    SELECT "id", "title", "clientName"
    FROM "crm_leads"
    WHERE "id" = ${id} AND ${leadScopeFilter}
    LIMIT 1
  `;

  const lead = leadRows[0];
  if (!lead) {
    return { error: "Lead not found" };
  }

  await logActivity({
    action: "UPDATE",
    entityType: "crm_lead",
    entityId: id,
    createdById: user.id,
    metadata: {
      chatterType: mode,
      body: trimmedBody,
      title: lead.title,
      clientName: lead.clientName,
    },
  });

  revalidatePath(`/crm/${id}`);
  revalidatePath("/crm");
  return { success: true };
}

export async function getCrmLeadActivityLogs(id: string, limit = 30): Promise<CrmLeadActivityLogItem[]> {
  const user = await requireModuleAccess("SALES");
  await ensureCrmLeadOwnership();

  const allowedCreatorIds = await getCurrentCrmScope(
    user.id,
    user.role,
    user.permissions
  );
  const leadScopeFilter = buildCrmScopeFilterSql("crm_leads", allowedCreatorIds);
  const leadRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "crm_leads"
    WHERE "id" = ${id} AND ${leadScopeFilter}
    LIMIT 1
  `;

  if (leadRows.length === 0) {
    return [];
  }

  return db.activityLog.findMany({
    where: {
      entityType: "crm_lead",
      entityId: id,
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(100, limit)),
    include: {
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  }) as Promise<CrmLeadActivityLogItem[]>;
}

export async function createCrmStage(label: string) {
  const user = await requireActionPermission("CREATE", "CRM");
  const parsed = leadStageSchema.safeParse(label);
  if (!parsed.success) {
    return { error: "Stage name is required" };
  }

  const nextLabel = parsed.data.trim();
  const createdById = await ensureUserRow(user);
  const stages = await ensureCrmStages(createdById || undefined);
  let keyBase = normalizeStageKey(nextLabel);
  if (!keyBase) keyBase = `stage-${stages.length + 1}`;

  let stageKey = keyBase;
  let suffix = 2;
  const existingKeys = new Set(stages.map((item) => item.key));
  while (existingKeys.has(stageKey)) {
    stageKey = `${keyBase}-${suffix}`;
    suffix += 1;
  }

  const created = await db.$queryRaw<CrmStageItem[]>`
    INSERT INTO "crm_stages" ("id", "key", "label", "position", "createdById", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${stageKey}, ${nextLabel}, ${stages.length}, ${createdById ?? null}, NOW(), NOW())
    RETURNING "id", "key", "label", "position"
  `;

  await logActivity({
    action: "CREATE",
    entityType: "crm_stage",
    entityId: created[0].id,
    createdById: createdById || "",
    metadata: { key: created[0].key, label: created[0].label },
  });

  revalidatePath("/crm");
  return { success: true, data: created[0] };
}

export async function updateCrmStage(stageKey: string, label: string) {
  const user = await requireActionPermission("UPDATE", "CRM");
  const parsedLabel = leadStageSchema.safeParse(label);
  if (!parsedLabel.success) {
    return { error: "Stage name is required" };
  }

  const updated = await db.$queryRaw<CrmStageItem[]>`
    UPDATE "crm_stages"
    SET "label" = ${parsedLabel.data.trim()}, "updatedAt" = NOW()
    WHERE "key" = ${stageKey}
    RETURNING "id", "key", "label", "position"
  `;

  if (updated.length === 0) {
    return { error: "Stage not found" };
  }

  await logActivity({
    action: "UPDATE",
    entityType: "crm_stage",
    entityId: updated[0].id,
    createdById: user.id,
    metadata: { key: updated[0].key, label: updated[0].label },
  });

  revalidatePath("/crm");
  return { success: true, data: updated[0] };
}

export async function reorderCrmStages(stageKeys: string[]) {
  const user = await requireActionPermission("UPDATE", "CRM");
  if (stageKeys.length === 0) {
    return { error: "Stage order cannot be empty" };
  }
  const current = await ensureCrmStages(user.id);
  const currentKeys = new Set(current.map((item) => item.key));
  const requestedKeys = stageKeys.filter((key) => currentKeys.has(key));
  const missingKeys = current.map((item) => item.key).filter((key) => !requestedKeys.includes(key));
  const orderedKeys = [...requestedKeys, ...missingKeys];

  for (let index = 0; index < orderedKeys.length; index += 1) {
    await db.$executeRaw`
      UPDATE "crm_stages"
      SET "position" = ${index}, "updatedAt" = NOW()
      WHERE "key" = ${orderedKeys[index]}
    `;
  }

  revalidatePath("/crm");
  return { success: true };
}

export async function deleteCrmStage(stageKey: string) {
  const user = await requireActionPermission("DELETE", "CRM");
  const stages = await ensureCrmStages(user.id);
  if (stages.length <= 1) {
    return { error: "At least one stage must remain" };
  }

  const stageIndex = stages.findIndex((item) => item.key === stageKey);
  if (stageIndex === -1) {
    return { error: "Stage not found" };
  }

  const fallback = stages[stageIndex - 1] ?? stages[stageIndex + 1];
  if (!fallback) {
    return { error: "Fallback stage not found" };
  }

  await db.$executeRaw`
    UPDATE "crm_leads"
    SET "stage" = ${fallback.key}, "updatedAt" = NOW()
    WHERE "stage" = ${stageKey}
  `;

  await db.$executeRaw`
    DELETE FROM "crm_stages"
    WHERE "key" = ${stageKey}
  `;

  const remaining = await db.$queryRaw<CrmStageItem[]>`
    SELECT "id", "key", "label", "position"
    FROM "crm_stages"
    ORDER BY "position" ASC, "createdAt" ASC
  `;

  for (let index = 0; index < remaining.length; index += 1) {
    await db.$executeRaw`
      UPDATE "crm_stages"
      SET "position" = ${index}, "updatedAt" = NOW()
      WHERE "id" = ${remaining[index].id}
    `;
  }

  await logActivity({
    action: "DELETE",
    entityType: "crm_stage",
    entityId: stages[stageIndex].id,
    createdById: user.id,
    metadata: { key: stageKey, fallbackStage: fallback.key },
  });

  revalidatePath("/crm");
  return { success: true };
}

export async function deleteCrmLead(id: string) {
  const user = await requireActionPermission("DELETE", "CRM");
  await ensureCrmLeadOwnership();
  await ensureDeletedLeadsMetaTable();
  const allowedCreatorIds = await getCurrentCrmScope(
    user.id,
    user.role,
    user.permissions
  );
  const leadScopeFilter = buildCrmScopeFilterSql("crm_leads", allowedCreatorIds);
  const allowedRows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "crm_leads"
    WHERE "id" = ${id} AND ${leadScopeFilter}
    LIMIT 1
  `;
  if (allowedRows.length === 0) {
    return { error: "Forbidden" };
  }

  const lead = await db.$queryRaw<CrmLeadItem[]>`
    SELECT
      "id", "title", "clientName", "email", "phone", "value", "probabilityLevel",
      "serviceName", "unitName", "unitCount", "unitPrice", "costPerUnit",
      "gstPercent", "subtotalAmount", "gstAmount", "finalAmount", "profitAmount",
      "invoicingPolicy", "tags", "expectedClosingDate",
      "notes", "stage"::text AS "stage", "createdAt", "updatedAt"
    FROM "crm_leads"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  if (lead.length === 0) {
    return { error: "Lead not found" };
  }

  const stages = await ensureCrmStages(user.id);
  let deletedStageKey = stages.find((stage) => stage.label.trim().toLowerCase() === "deleted")?.key;
  if (!deletedStageKey) {
    deletedStageKey = "deleted";
    await db.$executeRaw`
      INSERT INTO "crm_stages" ("id", "key", "label", "position", "createdById", "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${deletedStageKey}, 'Deleted', ${stages.length}, ${user.id}, NOW(), NOW())
      ON CONFLICT ("key") DO NOTHING
    `;
  }

  await db.$executeRaw`
    INSERT INTO "crm_deleted_leads_meta" ("leadId", "previousStage", "deletedById", "deletedAt")
    VALUES (${id}, ${lead[0].stage || null}, ${user.id}, NOW())
    ON CONFLICT ("leadId")
    DO UPDATE SET
      "previousStage" = EXCLUDED."previousStage",
      "deletedById" = EXCLUDED."deletedById",
      "deletedAt" = NOW()
  `;

  await db.$executeRaw`
    UPDATE "crm_leads"
    SET "stage" = ${deletedStageKey}, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;

  await logActivity({
    action: "DELETE",
    entityType: "crm_lead",
    entityId: id,
    createdById: user.id,
    metadata: {
      title: lead[0].title,
      stage: lead[0].stage,
    },
  });

  revalidatePath("/crm");
  revalidatePath("/crm/deleted");
  return { success: true };
}

export async function getDeletedCrmLeads() {
  const user = await requireActionPermission("DELETE", "CRM");
  await ensureCrmLeadOwnership();
  await ensureDeletedLeadsMetaTable();
  const rows = await db.$queryRaw<
    Array<
      CrmLeadItem & {
        deletedAt: Date;
        deletedById: string;
        previousStage: string | null;
      }
    >
  >`
    SELECT
      l."id",
      l."title",
      l."clientName",
      l."email",
      l."phone",
      l."value",
      l."probabilityLevel",
      l."serviceName",
      l."unitName",
      l."unitCount",
      l."unitPrice",
      l."costPerUnit",
      l."gstPercent",
      l."subtotalAmount",
      l."gstAmount",
      l."finalAmount",
      l."profitAmount",
      l."invoicingPolicy",
      l."tags",
      l."expectedClosingDate",
      l."notes",
      l."createdById",
      u."name" AS "createdByName",
      u."email" AS "createdByEmail",
      u."role"::text AS "createdByRole",
      l."stage"::text AS "stage",
      l."createdAt",
      l."updatedAt",
      m."deletedAt",
      m."deletedById",
      m."previousStage"
    FROM "crm_leads" l
    INNER JOIN "crm_deleted_leads_meta" m
      ON m."leadId" = l."id"
    LEFT JOIN "users" u
      ON u."id" = l."createdById"
    ORDER BY m."deletedAt" DESC
  `;
  return user.role === "ADMIN"
    ? rows
    : (sanitizeListByFieldPermissions(
        rows as unknown as Record<string, unknown>[],
        user.permissions
      ) as unknown as typeof rows);
}

export async function getArchivedCrmLeads() {
  const user = await requireActionPermission("UPDATE", "CRM");
  await ensureCrmLeadOwnership();
  await ensureArchivedLeadsMetaTable();
  const rows = await db.$queryRaw<
    Array<
      CrmLeadItem & {
        archivedAt: Date | null;
        archivedById: string | null;
        previousStage: string | null;
      }
    >
  >`
    SELECT
      l."id",
      l."title",
      l."clientName",
      l."email",
      l."phone",
      l."value",
      l."probabilityLevel",
      l."serviceName",
      l."unitName",
      l."unitCount",
      l."unitPrice",
      l."costPerUnit",
      l."gstPercent",
      l."subtotalAmount",
      l."gstAmount",
      l."finalAmount",
      l."profitAmount",
      l."invoicingPolicy",
      l."tags",
      l."expectedClosingDate",
      l."notes",
      l."createdById",
      u."name" AS "createdByName",
      u."email" AS "createdByEmail",
      u."role"::text AS "createdByRole",
      l."stage"::text AS "stage",
      l."createdAt",
      l."updatedAt",
      m."archivedAt",
      m."archivedById",
      m."previousStage"
    FROM "crm_leads" l
    LEFT JOIN "crm_archived_leads_meta" m
      ON m."leadId" = l."id"
    LEFT JOIN "users" u
      ON u."id" = l."createdById"
    WHERE LOWER(TRIM(COALESCE(l."stage", ''))) = 'archived'
    ORDER BY COALESCE(m."archivedAt", l."updatedAt") DESC
  `;
  return user.role === "ADMIN"
    ? rows
    : (sanitizeListByFieldPermissions(
        rows as unknown as Record<string, unknown>[],
        user.permissions
      ) as unknown as typeof rows);
}

export async function archiveCrmLead(id: string) {
  const user = await requireActionPermission("UPDATE", "CRM");
  await ensureCrmLeadOwnership();
  await ensureArchivedLeadsMetaTable();
  const allowedCreatorIds = await getCurrentCrmScope(
    user.id,
    user.role,
    user.permissions
  );
  const leadScopeFilter = buildCrmScopeFilterSql("crm_leads", allowedCreatorIds);
  const lead = await db.$queryRaw<CrmLeadItem[]>`
    SELECT
      "id", "title", "clientName", "email", "phone", "value", "probabilityLevel",
      "serviceName", "unitName", "unitCount", "unitPrice", "costPerUnit",
      "gstPercent", "subtotalAmount", "gstAmount", "finalAmount", "profitAmount",
      "invoicingPolicy", "tags", "expectedClosingDate",
      "notes", "stage"::text AS "stage", "createdAt", "updatedAt"
    FROM "crm_leads"
    WHERE "id" = ${id} AND ${leadScopeFilter}
    LIMIT 1
  `;

  if (lead.length === 0) {
    return { error: "Lead not found" };
  }

  const stages = await ensureCrmStages(user.id);
  let archivedStageKey = stages.find((stage) => stage.label.trim().toLowerCase() === "archived")?.key;
  if (!archivedStageKey) {
    archivedStageKey = "archived";
    await db.$executeRaw`
      INSERT INTO "crm_stages" ("id", "key", "label", "position", "createdById", "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${archivedStageKey}, 'Archived', ${stages.length}, ${user.id}, NOW(), NOW())
      ON CONFLICT ("key") DO NOTHING
    `;
  }

  await db.$executeRaw`
    INSERT INTO "crm_archived_leads_meta" ("leadId", "previousStage", "archivedById", "archivedAt")
    VALUES (${id}, ${lead[0].stage || null}, ${user.id}, NOW())
    ON CONFLICT ("leadId")
    DO UPDATE SET
      "previousStage" = EXCLUDED."previousStage",
      "archivedById" = EXCLUDED."archivedById",
      "archivedAt" = NOW()
  `;

  await db.$executeRaw`
    UPDATE "crm_leads"
    SET "stage" = ${archivedStageKey}, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;

  await logActivity({
    action: "UPDATE",
    entityType: "crm_lead_archive",
    entityId: id,
    createdById: user.id,
    metadata: { previousStage: lead[0].stage },
  });

  revalidatePath("/crm");
  revalidatePath("/crm/archive");
  return { success: true };
}

export async function restoreArchivedCrmLead(id: string) {
  const user = await requireActionPermission("UPDATE", "CRM");
  await ensureArchivedLeadsMetaTable();
  const rows = await db.$queryRaw<ArchivedLeadMetaRow[]>`
    SELECT "leadId", "previousStage", "archivedById", "archivedAt"
    FROM "crm_archived_leads_meta"
    WHERE "leadId" = ${id}
    LIMIT 1
  `;
  const meta = rows[0];
  const stages = await ensureCrmStages(user.id);
  const fallbackStage = stages.find((stage) => stage.label.trim().toLowerCase() !== "archived")?.key ?? "new";
  const restoreStage = meta?.previousStage || fallbackStage;

  await db.$executeRaw`
    UPDATE "crm_leads"
    SET "stage" = ${restoreStage}, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
  await db.$executeRaw`
    DELETE FROM "crm_archived_leads_meta"
    WHERE "leadId" = ${id}
  `;

  await logActivity({
    action: "UPDATE",
    entityType: "crm_lead_archive_restore",
    entityId: id,
    createdById: user.id,
    metadata: { restoreStage },
  });

  revalidatePath("/crm");
  revalidatePath("/crm/archive");
  return { success: true };
}

export async function restoreDeletedCrmLead(id: string) {
  const user = await requireActionPermission("UPDATE", "CRM");
  await ensureDeletedLeadsMetaTable();
  const rows = await db.$queryRaw<DeletedLeadMetaRow[]>`
    SELECT "leadId", "previousStage", "deletedById", "deletedAt"
    FROM "crm_deleted_leads_meta"
    WHERE "leadId" = ${id}
    LIMIT 1
  `;
  const meta = rows[0];
  if (!meta) {
    return { error: "Deleted lead metadata not found" };
  }

  const stages = await ensureCrmStages(user.id);
  const fallbackStage = stages.find((stage) => stage.label.trim().toLowerCase() !== "deleted")?.key ?? "new";
  const restoreStage = meta.previousStage || fallbackStage;

  await db.$executeRaw`
    UPDATE "crm_leads"
    SET "stage" = ${restoreStage}, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
  await db.$executeRaw`
    DELETE FROM "crm_deleted_leads_meta"
    WHERE "leadId" = ${id}
  `;

  await logActivity({
    action: "UPDATE",
    entityType: "crm_lead_restore",
    entityId: id,
    createdById: user.id,
    metadata: { restoreStage },
  });

  revalidatePath("/crm");
  revalidatePath("/crm/deleted");
  return { success: true };
}

export async function permanentlyDeleteCrmLead(id: string) {
  const user = await requireActionPermission("DELETE", "CRM");
  await ensureDeletedLeadsMetaTable();
  await db.$executeRaw`
    DELETE FROM "crm_deleted_leads_meta"
    WHERE "leadId" = ${id}
  `;
  await db.$executeRaw`
    DELETE FROM "crm_leads"
    WHERE "id" = ${id}
  `;

  await logActivity({
    action: "DELETE",
    entityType: "crm_lead_permanent_delete",
    entityId: id,
    createdById: user.id,
  });

  revalidatePath("/crm");
  revalidatePath("/crm/deleted");
  return { success: true };
}

export async function getCrmLead(id: string) {
  const user = await requireModuleAccess("SALES");
  await ensureCrmLeadOwnership();
  const allowedCreatorIds = await getCurrentCrmScope(
    user.id,
    user.role,
    user.permissions
  );
  const leadScopeFilter = buildCrmScopeFilterSql("crm_leads", allowedCreatorIds);
  const rows = await db.$queryRaw<CrmLeadItem[]>`
    SELECT
      "id", "title", "clientName", "email", "phone", "value", "probabilityLevel",
      "serviceName", "unitName", "unitCount", "unitPrice", "costPerUnit",
      "gstPercent", "subtotalAmount", "gstAmount", "finalAmount", "profitAmount",
      "invoicingPolicy", "tags", "expectedClosingDate",
      "notes", "stage"::text AS "stage", "createdAt", "updatedAt"
    FROM "crm_leads"
    WHERE "id" = ${id} AND ${leadScopeFilter}
    LIMIT 1
  `;
  const lead = rows[0] || null;
  if (!lead) return null;
  if (user.role === "ADMIN") return lead;

  return sanitizeRecordByFieldPermissions(
    lead as unknown as Record<string, unknown>,
    user.permissions
  ) as unknown as CrmLeadItem;
}
