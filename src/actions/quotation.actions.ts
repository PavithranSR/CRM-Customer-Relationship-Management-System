"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireActionPermission, requireAdmin, requireModuleAccess } from "@/lib/auth";
import {
  sanitizeListByFieldPermissions,
  sanitizeRecordByFieldPermissions,
  stripRestrictedFormFields,
} from "@/lib/employee-permissions";
import { getCrmAllowedCreatorIds } from "@/lib/crm-record-rules.server";
import {
  createQuotationSchema,
  paymentTypeSchema,
  upsertInvoiceSchema,
} from "@/lib/validations/quotation.schema";
import { logActivity } from "./activity-log.actions";

export type QuotationStatus = "DRAFT" | "SENT";
export type PaymentType = "FIXED" | "PERCENTAGE" | "MONTHLY";

export interface CrmQuotationItem {
  id: string;
  crmLeadId: string;
  quotationNo: string;
  title: string;
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  serviceName: string | null;
  unitName: string | null;
  unitCount: number | null;
  unitPrice: number | null;
  gstPercent: number | null;
  subtotalAmount: number | null;
  gstAmount: number | null;
  totalAmount: number | null;
  terms: string | null;
  notes: string | null;
  validUntil: Date | null;
  status: QuotationStatus;
  sentAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmQuotationLineItem {
  id: string;
  quotationId: string;
  name: string;
  unitCount: number;
  amount: number;
  gstPercent: number;
  tags: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotationInvoiceItem {
  id: string;
  quotationId: string;
  paymentType: PaymentType;
  amount: number | null;
  percentage: number | null;
  months: number | null;
  balanceAmount: number | null;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuotationPaymentItem {
  id: string;
  quotationId: string;
  paymentType: PaymentType;
  amount: number;
  percentage: number | null;
  months: number | null;
  paidAmount: number;
  notes: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeletedQuotationInvoiceItem {
  id: string;
  invoiceId: string;
  quotationId: string;
  crmLeadId: string;
  invoiceRef: string;
  orderNo: string;
  clientName: string;
  salespersonName: string | null;
  status: string;
  totalAmount: number;
  invoiceCreatedAt: Date;
  deletedById: string;
  deletedAt: Date;
  notes: string | null;
}

export interface DeletedCrmQuotationItem {
  id: string;
  quotationId: string;
  crmLeadId: string;
  quotationNo: string;
  title: string;
  clientName: string;
  salespersonName: string | null;
  status: string;
  totalAmount: number;
  quotationCreatedAt: Date;
  deletedById: string;
  deletedAt: Date;
}

interface DeletedCrmQuotationSnapshot {
  quotation: {
    id: string;
    crmLeadId: string;
    quotationNo: string;
    title: string;
    clientName: string;
    clientEmail: string;
    projectTitle: string;
    serviceName: string | null;
    unitName: string | null;
    unitCount: number | null;
    unitPrice: number | null;
    gstPercent: number | null;
    subtotalAmount: number | null;
    gstAmount: number | null;
    totalAmount: number | null;
    terms: string | null;
    notes: string | null;
    validUntil: string | null;
    status: string;
    sentAt: string | null;
    createdById: string;
    createdAt: string;
    updatedAt: string;
  };
  items: Array<{
    id: string;
    quotationId: string;
    name: string;
    unitCount: number;
    amount: number;
    gstPercent: number;
    tags: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface DeletedCrmQuotationDetailItem extends DeletedCrmQuotationItem {
  clientEmail: string | null;
  projectTitle: string | null;
  serviceName: string | null;
  unitName: string | null;
  unitCount: number | null;
  unitPrice: number | null;
  gstPercent: number | null;
  subtotalAmount: number | null;
  gstAmount: number | null;
  terms: string | null;
  notes: string | null;
  validUntil: Date | null;
  sentAt: Date | null;
  deletedByName: string | null;
  lastKnownStatus: string | null;
  createdById: string | null;
  items: CrmQuotationLineItem[];
  source: "stored" | "legacy";
  canRestore: boolean;
}

export interface QuotationPaymentDetailItem extends QuotationPaymentItem {
  crmLeadId: string;
  quotationNo: string;
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  serviceName: string | null;
  quotationTotalAmount: number | null;
  invoiceBalanceAmount: number | null;
}

const QUOTATION_PREFIX = "Q-";
const QUOTATION_PAD = 6;

const formatQuotationNo = (value: number) => {
  const safeValue = Math.max(1, Math.floor(value));
  return `${QUOTATION_PREFIX}${String(safeValue).padStart(QUOTATION_PAD, "0")}`;
};

async function getNextQuotationNo() {
  const rows = await db.$queryRaw<Array<{ maxNo: number | null }>>`
    SELECT MAX(
      NULLIF(regexp_replace("quotationNo", '[^0-9]', '', 'g'), '')::int
    ) AS "maxNo"
    FROM "crm_quotations"
  `;
  const currentMax = rows[0]?.maxNo ?? 0;
  return formatQuotationNo(currentMax + 1);
}

export async function generateQuotationNo() {
  return getNextQuotationNo();
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const escapePdfText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function buildSimplePdf(lines: string[]) {
  const safeLines = lines.slice(0, 46);
  const stream = [
    "BT",
    "/F1 10 Tf",
    "50 790 Td",
    ...safeLines.flatMap((line, index) => [
      `(${escapePdfText(line)}) Tj`,
      index === safeLines.length - 1 ? "" : "0 -14 Td",
    ]),
    "ET",
  ]
    .filter(Boolean)
    .join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function createQuotationPdfBuffer(quotation: CrmQuotationItem, items: CrmQuotationLineItem[]) {
  const validUntilText = quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "N/A";
  const formatAmount = (value: number | null | undefined) => Number(value ?? 0).toFixed(2);
  const lines = [
    `Quotation ${quotation.quotationNo}`,
    `Title: ${quotation.title}`,
    `Client: ${quotation.clientName}`,
    `Email: ${quotation.clientEmail}`,
    `Project: ${quotation.projectTitle}`,
    `Service: ${quotation.serviceName || "N/A"}`,
    `Valid Until: ${validUntilText}`,
    "",
    "Items:",
  ];

  if (items.length > 0) {
    for (const [index, item] of items.entries()) {
      const tax = round2(item.amount * (item.gstPercent / 100));
      const total = round2(item.amount + tax);
      lines.push(
        `${index + 1}. ${item.name} | Qty ${item.unitCount} | Subtotal ${item.amount.toFixed(2)} | GST ${item.gstPercent.toFixed(2)}% (${tax.toFixed(2)}) | Total ${total.toFixed(2)}`,
      );
    }
  } else {
    lines.push(
      `1. ${quotation.serviceName || quotation.projectTitle} | Qty ${quotation.unitCount ?? 0} | Subtotal ${formatAmount(quotation.subtotalAmount)} | GST ${formatAmount(quotation.gstPercent)}% (${formatAmount(quotation.gstAmount)}) | Total ${formatAmount(quotation.totalAmount)}`,
    );
  }

  lines.push("");
  lines.push(`Subtotal: ${formatAmount(quotation.subtotalAmount)}`);
  lines.push(`GST: ${formatAmount(quotation.gstAmount)}`);
  lines.push(`Grand Total: ${formatAmount(quotation.totalAmount)}`);
  if (quotation.terms) lines.push(`Terms: ${quotation.terms}`);
  if (quotation.notes) lines.push(`Notes: ${quotation.notes}`);

  return buildSimplePdf(lines);
}

async function ensureQuotationPaymentsTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_quotation_payments" (
      "id" TEXT NOT NULL,
      "quotationId" TEXT NOT NULL,
      "paymentType" "PaymentType" NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "percentage" DOUBLE PRECISION,
      "months" INTEGER,
      "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "notes" TEXT,
      "createdById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_quotation_payments_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "crm_quotation_payments_quotationId_fkey"
        FOREIGN KEY ("quotationId") REFERENCES "crm_quotations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "crm_quotation_payments_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `;
  await db.$executeRaw`
    ALTER TABLE "crm_quotation_payments"
    ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "crm_quotation_payments_quotationId_createdAt_idx"
    ON "crm_quotation_payments" ("quotationId", "createdAt" DESC)
  `;
}

async function ensureDeletedInvoicesTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_deleted_invoices" (
      "id" TEXT NOT NULL,
      "invoiceId" TEXT NOT NULL,
      "quotationId" TEXT NOT NULL,
      "crmLeadId" TEXT NOT NULL,
      "invoiceRef" TEXT NOT NULL,
      "orderNo" TEXT NOT NULL,
      "clientName" TEXT NOT NULL,
      "salespersonName" TEXT,
      "status" TEXT NOT NULL,
      "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "invoiceCreatedAt" TIMESTAMP(3) NOT NULL,
      "deletedById" TEXT NOT NULL,
      "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "notes" TEXT,
      CONSTRAINT "crm_deleted_invoices_pkey" PRIMARY KEY ("id")
    )
  `;
  await db.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "crm_deleted_invoices_invoiceId_key"
    ON "crm_deleted_invoices" ("invoiceId")
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "crm_deleted_invoices_deletedAt_idx"
    ON "crm_deleted_invoices" ("deletedAt" DESC)
  `;
}

async function ensureDeletedQuotationsTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "crm_deleted_quotations" (
      "id" TEXT NOT NULL,
      "quotationId" TEXT NOT NULL,
      "crmLeadId" TEXT NOT NULL,
      "quotationNo" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "clientName" TEXT NOT NULL,
      "salespersonName" TEXT,
      "status" TEXT NOT NULL,
      "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "quotationCreatedAt" TIMESTAMP(3) NOT NULL,
      "deletedById" TEXT NOT NULL,
      "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_deleted_quotations_pkey" PRIMARY KEY ("id")
    )
  `;
  await db.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "crm_deleted_quotations_quotationId_key"
    ON "crm_deleted_quotations" ("quotationId")
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "crm_deleted_quotations_deletedAt_idx"
    ON "crm_deleted_quotations" ("deletedAt" DESC)
  `;
  await db.$executeRaw`
    ALTER TABLE "crm_deleted_quotations"
    ADD COLUMN IF NOT EXISTS "snapshot" JSONB
  `;
  await db.$executeRaw`
    ALTER TABLE "crm_deleted_quotations"
    ADD COLUMN IF NOT EXISTS "isPurged" BOOLEAN NOT NULL DEFAULT FALSE
  `;
}

function buildInvoiceRef(createdAt: Date, quotationNo: string) {
  const cleanedOrder = quotationNo.replace(/^QT?-/, "");
  return `INV/${new Date(createdAt).getFullYear()}/${cleanedOrder}`;
}

async function getQuotationPaidTotal(quotationId: string) {
  await ensureQuotationPaymentsTable();
  const rows = await db.$queryRaw<Array<{ paidTotal: number | null }>>`
    SELECT COALESCE(SUM("paidAmount"), 0) AS "paidTotal"
    FROM "crm_quotation_payments"
    WHERE "quotationId" = ${quotationId}
  `;
  return round2(Number(rows[0]?.paidTotal || 0));
}

async function syncInvoiceSummary(quotationId: string, quotationTotal: number, userId: string) {
  const paidAmount = await getQuotationPaidTotal(quotationId);
  const balanceAmount = round2(Math.max(quotationTotal - paidAmount, 0));
  const latest = await db.$queryRaw<Array<{ paymentType: PaymentType }>>`
    SELECT "paymentType"
    FROM "crm_quotation_payments"
    WHERE "quotationId" = ${quotationId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const paymentType = latest[0]?.paymentType ?? "FIXED";
  const existing = await getQuotationInvoice(quotationId);

  if (existing) {
    await db.$executeRaw`
      UPDATE "crm_quotation_invoices"
      SET
        "paymentType" = ${paymentType}::"PaymentType",
        "amount" = ${paidAmount},
        "percentage" = NULL,
        "months" = NULL,
        "balanceAmount" = ${balanceAmount},
        "updatedAt" = NOW()
      WHERE "id" = ${existing.id}
    `;
  } else {
    await db.$executeRaw`
      INSERT INTO "crm_quotation_invoices" (
        "id",
        "quotationId",
        "paymentType",
        "amount",
        "percentage",
        "months",
        "balanceAmount",
        "notes",
        "createdById",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${quotationId},
        ${paymentType}::"PaymentType",
        ${paidAmount},
        NULL,
        NULL,
        ${balanceAmount},
        NULL,
        ${userId},
        NOW(),
        NOW()
      )
    `;
  }

  return { paidAmount, balanceAmount };
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

async function canAccessCrmLeadForUser(
  crmLeadId: string,
  input: {
    userId: string;
    role: string;
    permissions: unknown;
  }
) {
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    input.userId,
    input.role,
    input.permissions as { recordRules?: string[] } | null
  );
  if (allowedCreatorIds === null) return true;
  if (allowedCreatorIds.length === 0) return false;

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "crm_leads"
    WHERE "id" = ${crmLeadId}
      AND ("createdById" IN (${Prisma.join(allowedCreatorIds)}) OR "ownerId" IN (${Prisma.join(allowedCreatorIds)}))
    LIMIT 1
  `;
  return rows.length > 0;
}

async function canAccessQuotationForUser(
  quotationId: string,
  input: {
    userId: string;
    role: string;
    permissions: unknown;
  }
) {
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    input.userId,
    input.role,
    input.permissions as { recordRules?: string[] } | null
  );
  if (allowedCreatorIds === null) return true;
  if (allowedCreatorIds.length === 0) return false;

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT q."id"
    FROM "crm_quotations" q
    INNER JOIN "crm_leads" l ON l."id" = q."crmLeadId"
    WHERE q."id" = ${quotationId}
      AND (l."createdById" IN (${Prisma.join(allowedCreatorIds)}) OR l."ownerId" IN (${Prisma.join(allowedCreatorIds)}))
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function getLeadQuotations(crmLeadId: string) {
  const user = await requireModuleAccess("SALES");
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    user.id,
    user.role,
    user.permissions
  );
  if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
    return [];
  }
  const leadScopeFilter = buildCrmScopeFilterSql("l", allowedCreatorIds);

  const rows = await db.$queryRaw<CrmQuotationItem[]>`
    SELECT
      q."id",
      q."crmLeadId",
      q."quotationNo",
      q."title",
      q."clientName",
      q."clientEmail",
      q."projectTitle",
      q."serviceName",
      q."unitName",
      q."unitCount",
      q."unitPrice",
      q."gstPercent",
      q."subtotalAmount",
      q."gstAmount",
      q."totalAmount",
      q."terms",
      q."notes",
      q."validUntil",
      q."status",
      q."sentAt",
      q."createdById",
      q."createdAt",
      q."updatedAt"
    FROM "crm_quotations" q
    INNER JOIN "crm_leads" l ON l."id" = q."crmLeadId"
    WHERE q."crmLeadId" = ${crmLeadId} AND ${leadScopeFilter}
    ORDER BY q."createdAt" DESC
  `;

  if (user.role === "ADMIN") {
    return rows;
  }

  return sanitizeListByFieldPermissions(
    rows as unknown as Record<string, unknown>[],
    user.permissions
  ) as unknown as CrmQuotationItem[];
}

export async function getAllCrmQuotations() {
  return db.$queryRaw<
    Array<
      Pick<
        CrmQuotationItem,
        | "id"
        | "crmLeadId"
        | "quotationNo"
        | "title"
        | "clientName"
        | "clientEmail"
        | "projectTitle"
        | "serviceName"
        | "status"
        | "totalAmount"
        | "createdAt"
      > & { salespersonName: string | null }
    >
  >`
    SELECT
      q."id",
      q."crmLeadId",
      q."quotationNo",
      q."title",
      q."clientName",
      q."clientEmail",
      q."projectTitle",
      q."serviceName",
      q."status",
      q."totalAmount",
      q."createdAt",
      u."name" AS "salespersonName"
    FROM "crm_quotations" q
    LEFT JOIN "users" u
      ON u."id" = q."createdById"
    ORDER BY q."createdAt" DESC
  `;
}

const toSafeDate = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toSafeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRestorableQuotationStatus = (value: string | null | undefined): QuotationStatus =>
  String(value || "").trim().toUpperCase() === "SENT" ? "SENT" : "DRAFT";

async function loadDeletedQuotationLead(crmLeadId: string) {
  if (!crmLeadId) return null;
  const rows = await db.$queryRaw<Array<{
    id: string;
    title: string;
    clientName: string | null;
    email: string | null;
    serviceName: string | null;
    unitName: string | null;
    unitCount: number | null;
    unitPrice: number | null;
    gstPercent: number | null;
    subtotalAmount: number | null;
    gstAmount: number | null;
    finalAmount: number | null;
    createdById: string;
    ownerName: string | null;
    creatorName: string | null;
  }>>`
    SELECT
      l."id",
      l."title",
      l."clientName",
      l."email",
      l."serviceName",
      l."unitName",
      l."unitCount",
      l."unitPrice",
      l."gstPercent",
      l."subtotalAmount",
      l."gstAmount",
      l."finalAmount",
      l."createdById",
      owner."name" AS "ownerName",
      creator."name" AS "creatorName"
    FROM "crm_leads" l
    LEFT JOIN "users" owner
      ON owner."id" = l."ownerId"
    LEFT JOIN "users" creator
      ON creator."id" = l."createdById"
    WHERE l."id" = ${crmLeadId}
    LIMIT 1
  `;
  return rows[0] || null;
}

const normalizeDeletedQuotationItems = (
  items: DeletedCrmQuotationSnapshot["items"] | null | undefined
): CrmQuotationLineItem[] =>
  Array.isArray(items)
    ? items.map((item) => ({
        id: item.id || crypto.randomUUID(),
        quotationId: item.quotationId || "",
        name: item.name || "",
        unitCount: Number(item.unitCount || 1),
        amount: Number(item.amount || 0),
        gstPercent: Number(item.gstPercent || 0),
        tags: item.tags ?? null,
        createdAt: toSafeDate(item.createdAt) || new Date(),
        updatedAt: toSafeDate(item.updatedAt) || new Date(),
      }))
    : [];

async function loadDeletedCrmQuotationDetailRecord(quotationId: string): Promise<DeletedCrmQuotationDetailItem | null> {
  await ensureDeletedQuotationsTable();

  const storedRows = await db.$queryRaw<Array<DeletedCrmQuotationItem & {
    snapshot: DeletedCrmQuotationSnapshot | null;
    deletedByName: string | null;
  }>>`
    SELECT
      d."id",
      d."quotationId",
      d."crmLeadId",
      d."quotationNo",
      d."title",
      d."clientName",
      d."salespersonName",
      d."status",
      d."totalAmount",
      d."quotationCreatedAt",
      d."deletedById",
      d."deletedAt",
      d."snapshot",
      u."name" AS "deletedByName"
    FROM "crm_deleted_quotations" d
    LEFT JOIN "users" u
      ON u."id" = d."deletedById"
    WHERE d."quotationId" = ${quotationId}
      AND COALESCE(d."isPurged", FALSE) = FALSE
    LIMIT 1
  `;

  const stored = storedRows[0];
  if (stored) {
    const snapshot = stored.snapshot as DeletedCrmQuotationSnapshot | null;
    const lead = await loadDeletedQuotationLead(stored.crmLeadId);
    const snapshotQuotation = snapshot?.quotation;
    const items = normalizeDeletedQuotationItems(snapshot?.items);
    const lastKnownStatus = snapshotQuotation?.status || stored.status || "DRAFT";

    return {
      ...stored,
      clientEmail: snapshotQuotation?.clientEmail ?? lead?.email ?? null,
      projectTitle: snapshotQuotation?.projectTitle ?? lead?.title ?? null,
      serviceName: snapshotQuotation?.serviceName ?? lead?.serviceName ?? null,
      unitName: snapshotQuotation?.unitName ?? lead?.unitName ?? null,
      unitCount: snapshotQuotation?.unitCount ?? lead?.unitCount ?? 1,
      unitPrice: snapshotQuotation?.unitPrice ?? lead?.unitPrice ?? stored.totalAmount,
      gstPercent: snapshotQuotation?.gstPercent ?? lead?.gstPercent ?? 18,
      subtotalAmount: snapshotQuotation?.subtotalAmount ?? lead?.subtotalAmount ?? stored.totalAmount,
      gstAmount: snapshotQuotation?.gstAmount ?? lead?.gstAmount ?? 0,
      terms: snapshotQuotation?.terms ?? null,
      notes: snapshotQuotation?.notes ?? null,
      validUntil: toSafeDate(snapshotQuotation?.validUntil),
      sentAt: toSafeDate(snapshotQuotation?.sentAt),
      deletedByName: stored.deletedByName,
      lastKnownStatus,
      createdById: snapshotQuotation?.createdById ?? lead?.createdById ?? stored.deletedById,
      items,
      source: "stored",
      canRestore: Boolean(lead),
    };
  }

  const legacyRows = await db.$queryRaw<Array<DeletedCrmQuotationItem & {
    deletedByName: string | null;
  }>>`
    SELECT
      CONCAT('legacy-', d."entityId") AS "id",
      d."entityId" AS "quotationId",
      COALESCE(d."metadata"->>'crmLeadId', '') AS "crmLeadId",
      COALESCE(d."metadata"->>'quotationNo', CONCAT('Deleted-', LEFT(d."entityId", 8))) AS "quotationNo",
      CASE
        WHEN l."title" IS NOT NULL AND BTRIM(l."title") <> ''
          THEN CONCAT(l."title", ' - Quotation')
        ELSE COALESCE(d."metadata"->>'quotationNo', 'Deleted Quotation')
      END AS "title",
      COALESCE(NULLIF(l."clientName", ''), 'Unknown Client') AS "clientName",
      COALESCE(owner."name", creator."name") AS "salespersonName",
      ${"DELETED"} AS "status",
      COALESCE(NULLIF(d."metadata"->>'totalAmount', '')::double precision, 0) AS "totalAmount",
      COALESCE(c."createdAt", d."createdAt") AS "quotationCreatedAt",
      d."createdById" AS "deletedById",
      d."createdAt" AS "deletedAt",
      deleter."name" AS "deletedByName"
    FROM "activity_logs" d
    LEFT JOIN "crm_leads" l
      ON l."id" = COALESCE(d."metadata"->>'crmLeadId', '')
    LEFT JOIN "users" owner
      ON owner."id" = l."ownerId"
    LEFT JOIN "users" creator
      ON creator."id" = l."createdById"
    LEFT JOIN "users" deleter
      ON deleter."id" = d."createdById"
    LEFT JOIN LATERAL (
      SELECT "createdAt"
      FROM "activity_logs"
      WHERE "entityType" = ${"crm_quotation"}
        AND "action" = ${"CREATE"}::"ActivityAction"
        AND "entityId" = d."entityId"
      ORDER BY "createdAt" ASC
      LIMIT 1
    ) c ON TRUE
    WHERE d."entityType" = ${"crm_quotation"}
      AND d."action" = ${"DELETE"}::"ActivityAction"
      AND d."entityId" = ${quotationId}
      AND NOT EXISTS (
        SELECT 1
        FROM "crm_deleted_quotations" stored
        WHERE stored."quotationId" = d."entityId"
      )
    LIMIT 1
  `;

  const legacy = legacyRows[0];
  if (!legacy) {
    return null;
  }

  const lead = await loadDeletedQuotationLead(legacy.crmLeadId);
  const statusRows = await db.$queryRaw<Array<{ status: string | null; sentAt: Date | null }>>`
    SELECT
      "metadata"->>'status' AS "status",
      CASE
        WHEN COALESCE("metadata"->>'status', '') = 'SENT' THEN "createdAt"
        ELSE NULL
      END AS "sentAt"
    FROM "activity_logs"
    WHERE "entityType" = ${"crm_quotation"}
      AND "entityId" = ${quotationId}
      AND "metadata"->>'status' IS NOT NULL
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const lastKnownStatus = statusRows[0]?.status || "DRAFT";

  return {
    ...legacy,
    clientEmail: lead?.email ?? null,
    projectTitle: lead?.title ?? null,
    serviceName: lead?.serviceName ?? null,
    unitName: lead?.unitName ?? "Project",
    unitCount: lead?.unitCount ?? 1,
    unitPrice: lead?.unitPrice ?? legacy.totalAmount,
    gstPercent: lead?.gstPercent ?? 18,
    subtotalAmount: lead?.subtotalAmount ?? legacy.totalAmount,
    gstAmount: lead?.gstAmount ?? 0,
    terms: null,
    notes: null,
    validUntil: null,
    sentAt: statusRows[0]?.sentAt ?? null,
    deletedByName: legacy.deletedByName,
    lastKnownStatus,
    createdById: lead?.createdById ?? legacy.deletedById,
    items: [],
    source: "legacy",
    canRestore: Boolean(lead),
  };
}

export async function getDeletedCrmQuotations() {
  const user = await requireModuleAccess("SALES");
  await ensureDeletedQuotationsTable();

  const rows = await db.$queryRaw<DeletedCrmQuotationItem[]>`
    SELECT
      "id",
      "quotationId",
      "crmLeadId",
      "quotationNo",
      "title",
      "clientName",
      "salespersonName",
      "status",
      "totalAmount",
      "quotationCreatedAt",
      "deletedById",
      "deletedAt"
    FROM "crm_deleted_quotations"
    WHERE COALESCE("isPurged", FALSE) = FALSE
    ORDER BY "deletedAt" DESC
  `;

  const legacyRows = await db.$queryRaw<DeletedCrmQuotationItem[]>`
    SELECT
      CONCAT('legacy-', d."entityId") AS "id",
      d."entityId" AS "quotationId",
      COALESCE(d."metadata"->>'crmLeadId', '') AS "crmLeadId",
      COALESCE(d."metadata"->>'quotationNo', CONCAT('Deleted-', LEFT(d."entityId", 8))) AS "quotationNo",
      CASE
        WHEN l."title" IS NOT NULL AND BTRIM(l."title") <> ''
          THEN CONCAT(l."title", ' - Quotation')
        ELSE COALESCE(d."metadata"->>'quotationNo', 'Deleted Quotation')
      END AS "title",
      COALESCE(NULLIF(l."clientName", ''), 'Unknown Client') AS "clientName",
      COALESCE(owner."name", creator."name") AS "salespersonName",
      ${"DELETED"} AS "status",
      COALESCE(NULLIF(d."metadata"->>'totalAmount', '')::double precision, 0) AS "totalAmount",
      COALESCE(c."createdAt", d."createdAt") AS "quotationCreatedAt",
      d."createdById" AS "deletedById",
      d."createdAt" AS "deletedAt"
    FROM "activity_logs" d
    LEFT JOIN "crm_leads" l
      ON l."id" = COALESCE(d."metadata"->>'crmLeadId', '')
    LEFT JOIN "users" owner
      ON owner."id" = l."ownerId"
    LEFT JOIN "users" creator
      ON creator."id" = l."createdById"
    LEFT JOIN LATERAL (
      SELECT "createdAt"
      FROM "activity_logs"
      WHERE "entityType" = ${"crm_quotation"}
        AND "action" = ${"CREATE"}::"ActivityAction"
        AND "entityId" = d."entityId"
      ORDER BY "createdAt" ASC
      LIMIT 1
    ) c ON TRUE
    WHERE d."entityType" = ${"crm_quotation"}
      AND d."action" = ${"DELETE"}::"ActivityAction"
      AND NOT EXISTS (
        SELECT 1
        FROM "crm_deleted_quotations" stored
        WHERE stored."quotationId" = d."entityId"
      )
    ORDER BY d."createdAt" DESC
  `;
  const combinedRows = [...rows, ...legacyRows].sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  );

  if (user.role === "ADMIN") {
    return combinedRows;
  }

  return sanitizeListByFieldPermissions(
    combinedRows as unknown as Record<string, unknown>[],
    user.permissions
  ) as unknown as DeletedCrmQuotationItem[];
}

export async function getDeletedCrmQuotationDetail(quotationId: string) {
  await requireModuleAccess("SALES");
  return loadDeletedCrmQuotationDetailRecord(quotationId);
}

export async function getCrmQuotation(id: string) {
  const user = await requireModuleAccess("SALES");
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    user.id,
    user.role,
    user.permissions
  );
  if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
    return null;
  }
  const leadScopeFilter = buildCrmScopeFilterSql("l", allowedCreatorIds);

  const rows = await db.$queryRaw<CrmQuotationItem[]>`
    SELECT
      q."id",
      q."crmLeadId",
      q."quotationNo",
      q."title",
      q."clientName",
      q."clientEmail",
      q."projectTitle",
      q."serviceName",
      q."unitName",
      q."unitCount",
      q."unitPrice",
      q."gstPercent",
      q."subtotalAmount",
      q."gstAmount",
      q."totalAmount",
      q."terms",
      q."notes",
      q."validUntil",
      q."status",
      q."sentAt",
      q."createdById",
      q."createdAt",
      q."updatedAt"
    FROM "crm_quotations" q
    INNER JOIN "crm_leads" l ON l."id" = q."crmLeadId"
    WHERE q."id" = ${id} AND ${leadScopeFilter}
    LIMIT 1
  `;
  const quotation = rows[0] || null;
  if (!quotation) return null;
  if (user.role === "ADMIN") return quotation;

  return sanitizeRecordByFieldPermissions(
    quotation as unknown as Record<string, unknown>,
    user.permissions
  ) as unknown as CrmQuotationItem;
}

export async function getQuotationItems(quotationId: string) {
  return db.$queryRaw<CrmQuotationLineItem[]>`
    SELECT
      "id",
      "quotationId",
      "name",
      "unitCount",
      "amount",
      "gstPercent",
      "tags",
      "createdAt",
      "updatedAt"
    FROM "crm_quotation_items"
    WHERE "quotationId" = ${quotationId}
    ORDER BY "createdAt" ASC
  `;
}

const normalizeItems = (items: Array<Partial<CrmQuotationLineItem>>) =>
  items
    .map((item) => ({
      id: item.id || crypto.randomUUID(),
      name: String(item.name || "").trim(),
      unitCount: Math.max(1, Number(item.unitCount || 1)),
      amount: Math.max(0, Number(item.amount || 0)),
      gstPercent: Math.max(0, Number(item.gstPercent || 0)),
      tags: item.tags ? String(item.tags).trim() : null,
    }))
    .filter((item) => item.name.length > 0);

export async function upsertQuotationItems(quotationId: string, items: Array<Partial<CrmQuotationLineItem>>) {
  const user = await requireAdmin();
  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  const normalized = normalizeItems(items);

  await db.$executeRaw`
    DELETE FROM "crm_quotation_items"
    WHERE "quotationId" = ${quotationId}
  `;

  for (const item of normalized) {
    await db.$executeRaw`
      INSERT INTO "crm_quotation_items" (
        "id",
        "quotationId",
        "name",
        "unitCount",
        "amount",
        "gstPercent",
        "tags",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${item.id},
        ${quotationId},
        ${item.name},
        ${item.unitCount},
        ${item.amount},
        ${item.gstPercent},
        ${item.tags},
        NOW(),
        NOW()
      )
    `;
  }

  const subtotal = normalized.reduce((sum, item) => sum + item.amount, 0);
  const gstAmount = normalized.reduce((sum, item) => sum + item.amount * (item.gstPercent / 100), 0);
  const totalAmount = subtotal + gstAmount;
  const gstPercent = subtotal > 0 ? (gstAmount / subtotal) * 100 : 0;
  const primaryName = normalized[0]?.name || quotation.serviceName || quotation.projectTitle;

  await db.$executeRaw`
    UPDATE "crm_quotations"
    SET
      "serviceName" = ${primaryName},
      "unitName" = 'Project',
      "unitCount" = 1,
      "unitPrice" = ${subtotal},
      "gstPercent" = ${gstPercent},
      "subtotalAmount" = ${subtotal},
      "gstAmount" = ${gstAmount},
      "totalAmount" = ${totalAmount},
      "updatedAt" = NOW()
    WHERE "id" = ${quotationId}
  `;

  await logActivity({
    action: "UPDATE",
    entityType: "crm_quotation",
    entityId: quotationId,
    createdById: user.id,
    metadata: {
      itemsUpdated: true,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  return { success: true };
}

export async function createCrmQuotation(crmLeadId: string, formData: FormData) {
  const user = await requireActionPermission("CREATE", "SALES");
  if (user.role !== "ADMIN") {
    stripRestrictedFormFields(formData, user.permissions);
  }
  if (
    user.role !== "ADMIN" &&
    !(await canAccessCrmLeadForUser(crmLeadId, {
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }))
  ) {
    return { error: "Forbidden" };
  }

  const leadRows = await db.$queryRaw<Array<{ id: string; title: string; clientName: string | null; email: string | null }>>`
    SELECT "id", "title", "clientName", "email"
    FROM "crm_leads"
    WHERE "id" = ${crmLeadId}
    LIMIT 1
  `;

  if (leadRows.length === 0) {
    return { error: "CRM lead not found" };
  }

  const parsed = createQuotationSchema.safeParse({
    title: formData.get("title"),
    clientName: formData.get("clientName"),
    clientEmail: formData.get("clientEmail"),
    projectTitle: formData.get("projectTitle"),
    serviceName: formData.get("serviceName") || undefined,
    unitName: formData.get("unitName") || undefined,
    unitCount: formData.get("unitCount"),
    unitPrice: formData.get("unitPrice"),
    gstPercent: formData.get("gstPercent"),
    terms: formData.get("terms") || undefined,
    notes: formData.get("notes") || undefined,
    validUntil: formData.get("validUntil") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const sendNow = formData.get("sendNow") === "true";

  const rawItems = formData.get("items");
  const parsedItems = typeof rawItems === "string"
    ? normalizeItems(JSON.parse(rawItems))
    : [];

  const itemsSubtotal = parsedItems.length > 0
    ? parsedItems.reduce((sum, item) => sum + item.amount, 0)
    : parsed.data.unitCount * parsed.data.unitPrice;
  const itemsGstAmount = parsedItems.length > 0
    ? parsedItems.reduce((sum, item) => sum + item.amount * (item.gstPercent / 100), 0)
    : itemsSubtotal * (parsed.data.gstPercent / 100);
  const subtotalAmount = round2(itemsSubtotal);
  const gstAmount = round2(itemsGstAmount);
  const totalAmount = round2(subtotalAmount + gstAmount);
  const derivedGstPercent = subtotalAmount > 0 ? round2((gstAmount / subtotalAmount) * 100) : parsed.data.gstPercent;
  const derivedServiceName = parsedItems[0]?.name || parsed.data.serviceName || parsed.data.projectTitle;
  const rawQuotationNo = formData.get("quotationNo");
  const quotationNo = typeof rawQuotationNo === "string" && rawQuotationNo.trim()
    ? rawQuotationNo.trim()
    : await getNextQuotationNo();
  const id = crypto.randomUUID();

  const rows = await db.$queryRaw<CrmQuotationItem[]>`
    INSERT INTO "crm_quotations" (
      "id",
      "crmLeadId",
      "quotationNo",
      "title",
      "clientName",
      "clientEmail",
      "projectTitle",
      "serviceName",
      "unitName",
      "unitCount",
      "unitPrice",
      "gstPercent",
      "subtotalAmount",
      "gstAmount",
      "totalAmount",
      "terms",
      "notes",
      "validUntil",
      "status",
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${crmLeadId},
      ${quotationNo},
      ${parsed.data.title},
      ${parsed.data.clientName},
      ${parsed.data.clientEmail},
      ${parsed.data.projectTitle},
      ${derivedServiceName || null},
      ${parsed.data.unitName || null},
      ${parsed.data.unitCount},
      ${parsed.data.unitPrice},
      ${derivedGstPercent},
      ${subtotalAmount},
      ${gstAmount},
      ${totalAmount},
      ${parsed.data.terms || null},
      ${parsed.data.notes || null},
      ${parsed.data.validUntil ?? null},
      'DRAFT'::"QuotationStatus",
      ${user.id},
      NOW(),
      NOW()
    )
    RETURNING
      "id",
      "crmLeadId",
      "quotationNo",
      "title",
      "clientName",
      "clientEmail",
      "projectTitle",
      "serviceName",
      "unitName",
      "unitCount",
      "unitPrice",
      "gstPercent",
      "subtotalAmount",
      "gstAmount",
      "totalAmount",
      "terms",
      "notes",
      "validUntil",
      "status",
      "sentAt",
      "createdById",
      "createdAt",
      "updatedAt"
  `;

  await logActivity({
    action: "CREATE",
    entityType: "crm_quotation",
    entityId: id,
    createdById: user.id,
    metadata: {
      crmLeadId,
      quotationNo,
      totalAmount,
    },
  });

  let mailMessage: string | undefined;
  let mailSent = false;
  let createdQuotation = rows[0];

  if (parsedItems.length > 0) {
    for (const item of parsedItems) {
      await db.$executeRaw`
        INSERT INTO "crm_quotation_items" (
          "id",
          "quotationId",
          "name",
          "unitCount",
          "amount",
          "gstPercent",
          "tags",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${item.id},
          ${id},
          ${item.name},
          ${item.unitCount},
          ${item.amount},
          ${item.gstPercent},
          ${item.tags},
          NOW(),
          NOW()
        )
      `;
    }
  }

  if (sendNow) {
    const mail = await sendQuotationEmail(rows[0]);
    mailMessage = mail.message;
    mailSent = mail.sent;

    if (mail.sent) {
      const sentRows = await db.$queryRaw<CrmQuotationItem[]>`
        UPDATE "crm_quotations"
        SET
          "status" = 'SENT'::"QuotationStatus",
          "sentAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "id" = ${rows[0].id}
        RETURNING
          "id",
          "crmLeadId",
          "quotationNo",
          "title",
          "clientName",
          "clientEmail",
          "projectTitle",
          "serviceName",
          "unitName",
          "unitCount",
          "unitPrice",
          "gstPercent",
          "subtotalAmount",
          "gstAmount",
          "totalAmount",
          "terms",
          "notes",
          "validUntil",
          "status",
          "sentAt",
          "createdById",
          "createdAt",
          "updatedAt"
      `;
      createdQuotation = sentRows[0];

      await logActivity({
        action: "UPDATE",
        entityType: "crm_quotation",
        entityId: rows[0].id,
        createdById: user.id,
        metadata: {
          status: "SENT",
          email: rows[0].clientEmail,
          mailSent: true,
        },
      });
    }
  }

  revalidatePath(`/crm/${crmLeadId}`);
  revalidatePath("/crm");
  revalidatePath(`/crm/${crmLeadId}/quotations`);
  revalidatePath(`/crm/${crmLeadId}/quotations/${id}`);
  return {
    success: true,
    data: createdQuotation,
    mailSent,
    mailMessage,
  };
}

async function sendQuotationEmail(quotation: CrmQuotationItem) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    return { sent: false, message: "Mail provider not configured. Set RESEND_API_KEY and MAIL_FROM." };
  }

  const items = await getQuotationItems(quotation.id);
  const pdfBuffer = createQuotationPdfBuffer(quotation, items);
  const itemsHtml = items.length
    ? `
      <h3 style="margin:16px 0 8px;">Line Items</h3>
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;border-color:#d1d5db;">
        <thead style="background:#f8fafc;">
          <tr>
            <th align="left">Item</th>
            <th align="right">Qty</th>
            <th align="right">Amount</th>
            <th align="right">GST %</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.name)}</td>
                  <td align="right">${item.unitCount}</td>
                  <td align="right">${item.amount.toFixed(2)}</td>
                  <td align="right">${item.gstPercent.toFixed(2)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    `
    : "";
  const validUntilText = quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "N/A";
  const formatAmount = (value: number | null | undefined) => Number(value ?? 0).toFixed(2);
  const termsHtml = quotation.terms
    ? `<p><strong>Terms:</strong> ${escapeHtml(quotation.terms)}</p>`
    : "";
  const notesHtml = quotation.notes
    ? `<p><strong>Notes:</strong> ${escapeHtml(quotation.notes)}</p>`
    : "";

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [quotation.clientEmail],
      subject: `Quotation ${quotation.quotationNo} - ${quotation.projectTitle}`,
      attachments: [
        {
          filename: `Quotation-${quotation.quotationNo}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
      html: `
        <p>Hello ${escapeHtml(quotation.clientName)},</p>
        <p>Please find your quotation details below and the attached PDF document.</p>
        <ul>
          <li><strong>Quotation No:</strong> ${escapeHtml(quotation.quotationNo)}</li>
          <li><strong>Project:</strong> ${escapeHtml(quotation.projectTitle)}</li>
          <li><strong>Service:</strong> ${escapeHtml(quotation.serviceName || "N/A")}</li>
          <li><strong>Valid Until:</strong> ${validUntilText}</li>
          <li><strong>Subtotal:</strong> ${formatAmount(quotation.subtotalAmount)}</li>
          <li><strong>GST:</strong> ${formatAmount(quotation.gstAmount)}</li>
          <li><strong>Total:</strong> ${formatAmount(quotation.totalAmount)}</li>
        </ul>
        ${itemsHtml}
        ${termsHtml}
        ${notesHtml}
        <p>Thanks.</p>
      `,
    }),
  });

  if (!emailResponse.ok) {
    const errorText = await emailResponse.text();
    return { sent: false, message: `Email failed: ${errorText}` };
  }

  return { sent: true, message: "Quotation email sent" };
}

export async function sendCrmQuotation(quotationId: string) {
  const user = await requireActionPermission("UPDATE", "SALES");
  if (
    user.role !== "ADMIN" &&
    !(await canAccessQuotationForUser(quotationId, {
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }))
  ) {
    return { error: "Forbidden" };
  }

  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  const mail = await sendQuotationEmail(quotation);

  if (mail.sent) {
    await db.$executeRaw`
      UPDATE "crm_quotations"
      SET
        "status" = 'SENT'::"QuotationStatus",
        "sentAt" = NOW(),
        "updatedAt" = NOW()
      WHERE "id" = ${quotationId}
    `;
  }

  await logActivity({
    action: "UPDATE",
    entityType: "crm_quotation",
    entityId: quotationId,
    createdById: user.id,
    metadata: {
      status: mail.sent ? "SENT" : quotation.status,
      email: quotation.clientEmail,
      mailSent: mail.sent,
      mailMessage: mail.message,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}`);
  revalidatePath("/crm");
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);

  return {
    success: true,
    message: mail.message,
    mailSent: mail.sent,
  };
}

export async function confirmCrmQuotation(quotationId: string) {
  const user = await requireActionPermission("UPDATE", "SALES");
  if (
    user.role !== "ADMIN" &&
    !(await canAccessQuotationForUser(quotationId, {
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }))
  ) {
    return { error: "Forbidden" };
  }

  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  await db.$executeRaw`
    UPDATE "crm_quotations"
    SET
      "status" = 'SENT'::"QuotationStatus",
      "sentAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "id" = ${quotationId}
  `;

  await logActivity({
    action: "UPDATE",
    entityType: "crm_quotation",
    entityId: quotationId,
    createdById: user.id,
    metadata: {
      status: "SENT",
      confirmed: true,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}/invoice`);
  revalidatePath("/crm");
  return { success: true };
}

export async function getQuotationInvoice(quotationId: string) {
  const user = await requireModuleAccess("SALES");
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    user.id,
    user.role,
    user.permissions
  );
  if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
    return null;
  }
  const leadScopeFilter = buildCrmScopeFilterSql("l", allowedCreatorIds);

  const rows = await db.$queryRaw<QuotationInvoiceItem[]>`
    SELECT
      i."id",
      i."quotationId",
      i."paymentType",
      i."amount",
      i."percentage",
      i."months",
      i."balanceAmount",
      i."notes",
      i."createdById",
      i."createdAt",
      i."updatedAt"
    FROM "crm_quotation_invoices" i
    INNER JOIN "crm_quotations" q ON q."id" = i."quotationId"
    INNER JOIN "crm_leads" l ON l."id" = q."crmLeadId"
    WHERE i."quotationId" = ${quotationId} AND ${leadScopeFilter}
    LIMIT 1
  `;
  const invoice = rows[0] || null;
  if (!invoice) return null;
  if (user.role === "ADMIN") return invoice;

  return sanitizeRecordByFieldPermissions(
    invoice as unknown as Record<string, unknown>,
    user.permissions
  ) as unknown as QuotationInvoiceItem;
}

export async function getDeletedQuotationInvoiceByQuotationId(quotationId: string) {
  const user = await requireModuleAccess("SALES");
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    user.id,
    user.role,
    user.permissions
  );
  if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
    return null;
  }

  await ensureDeletedInvoicesTable();
  const leadScopeFilter = buildCrmScopeFilterSql("l", allowedCreatorIds);

  const rows = await db.$queryRaw<DeletedQuotationInvoiceItem[]>`
    SELECT
      d."id",
      d."invoiceId",
      d."quotationId",
      d."crmLeadId",
      d."invoiceRef",
      d."orderNo",
      d."clientName",
      d."salespersonName",
      d."status",
      d."totalAmount",
      d."invoiceCreatedAt",
      d."deletedById",
      d."deletedAt",
      d."notes"
    FROM "crm_deleted_invoices" d
    INNER JOIN "crm_leads" l ON l."id" = d."crmLeadId"
    WHERE d."quotationId" = ${quotationId} AND ${leadScopeFilter}
    ORDER BY d."deletedAt" DESC
    LIMIT 1
  `;

  const deletedInvoice = rows[0] || null;
  if (!deletedInvoice) return null;
  if (user.role === "ADMIN") return deletedInvoice;

  return sanitizeRecordByFieldPermissions(
    deletedInvoice as unknown as Record<string, unknown>,
    user.permissions
  ) as unknown as DeletedQuotationInvoiceItem;
}

export async function getDeletedQuotationInvoicesByQuotationId(quotationId: string) {
  const user = await requireModuleAccess("SALES");
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    user.id,
    user.role,
    user.permissions
  );
  if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
    return [];
  }

  await ensureDeletedInvoicesTable();
  const leadScopeFilter = buildCrmScopeFilterSql("l", allowedCreatorIds);

  const rows = await db.$queryRaw<DeletedQuotationInvoiceItem[]>`
    SELECT
      d."id",
      d."invoiceId",
      d."quotationId",
      d."crmLeadId",
      d."invoiceRef",
      d."orderNo",
      d."clientName",
      d."salespersonName",
      d."status",
      d."totalAmount",
      d."invoiceCreatedAt",
      d."deletedById",
      d."deletedAt",
      d."notes"
    FROM "crm_deleted_invoices" d
    INNER JOIN "crm_leads" l ON l."id" = d."crmLeadId"
    WHERE d."quotationId" = ${quotationId} AND ${leadScopeFilter}
    ORDER BY d."deletedAt" DESC
  `;

  if (user.role === "ADMIN") return rows;

  return sanitizeListByFieldPermissions(
    rows as unknown as Array<Record<string, unknown>>,
    user.permissions
  ) as unknown as DeletedQuotationInvoiceItem[];
}

export async function getQuotationPayments(quotationId: string) {
  await ensureQuotationPaymentsTable();
  return db.$queryRaw<QuotationPaymentItem[]>`
    SELECT
      "id",
      "quotationId",
      "paymentType",
      "amount",
      "percentage",
      "months",
      "paidAmount",
      "notes",
      "createdById",
      "createdAt",
      "updatedAt"
    FROM "crm_quotation_payments"
    WHERE "quotationId" = ${quotationId}
    ORDER BY "createdAt" DESC
  `;
}

export async function getQuotationPaymentById(paymentId: string) {
  const user = await requireModuleAccess("SALES");
  const allowedCreatorIds = await getCrmAllowedCreatorIds(
    user.id,
    user.role,
    user.permissions
  );
  if (allowedCreatorIds !== null && allowedCreatorIds.length === 0) {
    return null;
  }
  const leadScopeFilter = buildCrmScopeFilterSql("l", allowedCreatorIds);

  const rows = await db.$queryRaw<QuotationPaymentDetailItem[]>`
    SELECT
      p."id",
      p."quotationId",
      p."paymentType",
      p."amount",
      p."percentage",
      p."months",
      p."paidAmount",
      p."notes",
      p."createdById",
      p."createdAt",
      p."updatedAt",
      q."crmLeadId",
      q."quotationNo",
      q."clientName",
      q."clientEmail",
      q."projectTitle",
      q."serviceName",
      q."totalAmount" AS "quotationTotalAmount",
      i."balanceAmount" AS "invoiceBalanceAmount"
    FROM "crm_quotation_payments" p
    INNER JOIN "crm_quotations" q ON q."id" = p."quotationId"
    INNER JOIN "crm_leads" l ON l."id" = q."crmLeadId"
    LEFT JOIN "crm_quotation_invoices" i ON i."quotationId" = q."id"
    WHERE p."id" = ${paymentId} AND ${leadScopeFilter}
    LIMIT 1
  `;

  const payment = rows[0] || null;
  if (!payment) return null;
  if (user.role === "ADMIN") return payment;

  return sanitizeRecordByFieldPermissions(
    payment as unknown as Record<string, unknown>,
    user.permissions
  ) as unknown as QuotationPaymentDetailItem;
}

export async function upsertQuotationInvoice(quotationId: string, formData: FormData) {
  const user = await requireActionPermission("UPDATE", "SALES");
  if (user.role !== "ADMIN") {
    stripRestrictedFormFields(formData, user.permissions);
  }
  if (
    user.role !== "ADMIN" &&
    !(await canAccessQuotationForUser(quotationId, {
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }))
  ) {
    return { error: "Forbidden" };
  }

  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  if (quotation.status !== "SENT") {
    return { error: "Confirm the quotation before creating an invoice" };
  }

  const parsed = upsertInvoiceSchema.safeParse({
    paymentType: formData.get("paymentType"),
    amount: formData.get("amount") || undefined,
    percentage: formData.get("percentage") || undefined,
    months: formData.get("months") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const paymentType = paymentTypeSchema.parse(parsed.data.paymentType);
  const quoteTotal = Number(quotation.totalAmount || 0);
  const alreadyPaid = await getQuotationPaidTotal(quotationId);
  const remaining = round2(Math.max(quoteTotal - alreadyPaid, 0));
  if (remaining <= 0) {
    return { error: "Invoice already fully paid" };
  }

  let amount = 0;
  let percentage: number | null = null;
  let months: number | null = null;
  let calculatedPaid = 0;

  if (paymentType === "FIXED") {
    amount = round2(parsed.data.amount || 0);
    calculatedPaid = amount;
  } else if (paymentType === "PERCENTAGE") {
    percentage = round2(parsed.data.percentage || 0);
    calculatedPaid = round2((quoteTotal * percentage) / 100);
    amount = calculatedPaid;
  } else {
    months = parsed.data.months || 1;
    amount = round2(parsed.data.amount || 0);
    calculatedPaid = round2(amount * months);
  }

  if (calculatedPaid <= 0) {
    return { error: "Payment amount must be greater than zero" };
  }

  const appliedPaidAmount = round2(Math.min(calculatedPaid, remaining));
  await ensureQuotationPaymentsTable();
  const paymentId = crypto.randomUUID();
  const paymentRows = await db.$queryRaw<QuotationPaymentItem[]>`
    INSERT INTO "crm_quotation_payments" (
        "id",
        "quotationId",
        "paymentType",
        "amount",
        "percentage",
        "months",
        "paidAmount",
        "notes",
        "createdById",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${paymentId},
        ${quotationId},
        ${paymentType}::"PaymentType",
        ${amount},
        ${percentage},
        ${months},
        ${appliedPaidAmount},
        ${parsed.data.notes || null},
        ${user.id},
        NOW(),
        NOW()
      )
      RETURNING
        "id",
        "quotationId",
        "paymentType",
        "amount",
        "percentage",
        "months",
        "paidAmount",
        "notes",
        "createdById",
        "createdAt",
        "updatedAt"
  `;
  const payment = paymentRows[0];
  const totals = await syncInvoiceSummary(quotationId, quoteTotal, user.id);

  await logActivity({
    action: "UPDATE",
    entityType: "crm_invoice",
    entityId: payment.id,
    createdById: user.id,
    metadata: {
      quotationId,
      paymentType,
      amount,
      paidAmount: payment.paidAmount,
      totalPaidAmount: totals.paidAmount,
      balanceAmount: totals.balanceAmount,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}/invoice`);
  revalidatePath("/crm");
  return {
    success: true,
    data: payment,
    paidAmount: totals.paidAmount,
    balanceAmount: totals.balanceAmount,
  };
}

export async function addCrmInvoiceChatterEntry(
  quotationId: string,
  mode: "message" | "note",
  body: string,
) {
  const user = await requireActionPermission("UPDATE", "SALES");

  if (!(await canAccessQuotationForUser(quotationId, {
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  }))) {
    return { error: "Forbidden" };
  }

  const trimmedBody = body.trim();
  if (!trimmedBody) {
    return { error: mode === "message" ? "Message is required" : "Note is required" };
  }

  if (trimmedBody.length > 2000) {
    return { error: "Keep the text under 2000 characters" };
  }

  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  const invoice = await getQuotationInvoice(quotationId);
  if (!invoice) {
    return { error: "Invoice not found" };
  }

  await logActivity({
    action: "UPDATE",
    entityType: "crm_invoice",
    entityId: invoice.id,
    createdById: user.id,
    metadata: {
      chatterType: mode,
      body: trimmedBody,
      quotationNo: quotation.quotationNo,
      clientName: quotation.clientName,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}/invoice`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  revalidatePath("/crm");
  return { success: true };
}

export async function updateQuotationPayment(paymentId: string, formData: FormData) {
  const user = await requireAdmin();
  await ensureQuotationPaymentsTable();

  const existingRows = await db.$queryRaw<QuotationPaymentItem[]>`
    SELECT
      "id",
      "quotationId",
      "paymentType",
      "amount",
      "percentage",
      "months",
      "paidAmount",
      "notes",
      "createdById",
      "createdAt",
      "updatedAt"
    FROM "crm_quotation_payments"
    WHERE "id" = ${paymentId}
    LIMIT 1
  `;
  const existing = existingRows[0];
  if (!existing) {
    return { error: "Payment record not found" };
  }

  const quotation = await getCrmQuotation(existing.quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  const parsed = upsertInvoiceSchema.safeParse({
    paymentType: formData.get("paymentType"),
    amount: formData.get("amount") || undefined,
    percentage: formData.get("percentage") || undefined,
    months: formData.get("months") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const paymentType = paymentTypeSchema.parse(parsed.data.paymentType);
  const quoteTotal = Number(quotation.totalAmount || 0);
  const otherPaidRows = await db.$queryRaw<Array<{ paidTotal: number | null }>>`
    SELECT COALESCE(SUM("paidAmount"), 0) AS "paidTotal"
    FROM "crm_quotation_payments"
    WHERE "quotationId" = ${existing.quotationId}
      AND "id" <> ${paymentId}
  `;
  const otherPaid = round2(Number(otherPaidRows[0]?.paidTotal || 0));
  const remaining = round2(Math.max(quoteTotal - otherPaid, 0));
  if (remaining <= 0) {
    return { error: "Invoice already fully paid" };
  }

  let amount = 0;
  let percentage: number | null = null;
  let months: number | null = null;
  let calculatedPaid = 0;

  if (paymentType === "FIXED") {
    amount = round2(parsed.data.amount || 0);
    calculatedPaid = amount;
  } else if (paymentType === "PERCENTAGE") {
    percentage = round2(parsed.data.percentage || 0);
    calculatedPaid = round2((quoteTotal * percentage) / 100);
    amount = calculatedPaid;
  } else {
    months = parsed.data.months || 1;
    amount = round2(parsed.data.amount || 0);
    calculatedPaid = round2(amount * months);
  }

  if (calculatedPaid <= 0) {
    return { error: "Payment amount must be greater than zero" };
  }

  const appliedPaidAmount = round2(Math.min(calculatedPaid, remaining));
  const updatedRows = await db.$queryRaw<QuotationPaymentItem[]>`
    UPDATE "crm_quotation_payments"
    SET
      "paymentType" = ${paymentType}::"PaymentType",
      "amount" = ${amount},
      "percentage" = ${percentage},
      "months" = ${months},
      "paidAmount" = ${appliedPaidAmount},
      "notes" = ${parsed.data.notes || null},
      "updatedAt" = NOW()
    WHERE "id" = ${paymentId}
    RETURNING
      "id",
      "quotationId",
      "paymentType",
      "amount",
      "percentage",
      "months",
      "paidAmount",
      "notes",
      "createdById",
      "createdAt",
      "updatedAt"
  `;
  const updated = updatedRows[0];
  const totals = await syncInvoiceSummary(existing.quotationId, quoteTotal, user.id);

  await logActivity({
    action: "UPDATE",
    entityType: "crm_invoice",
    entityId: paymentId,
    createdById: user.id,
    metadata: {
      quotationId: existing.quotationId,
      paymentEdited: true,
      paymentType,
      amount,
      paidAmount: updated.paidAmount,
      totalPaidAmount: totals.paidAmount,
      balanceAmount: totals.balanceAmount,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}/invoice`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}/invoice/create`);
  revalidatePath("/crm");

  return {
    success: true,
    data: updated,
    paidAmount: totals.paidAmount,
    balanceAmount: totals.balanceAmount,
  };
}

export async function deleteQuotationPayment(paymentId: string, reason: string) {
  const user = await requireActionPermission("DELETE", "SALES");
  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    return { error: "Delete reason is required" };
  }
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      quotationId: string;
      crmLeadId: string;
      quotationNo: string;
      paymentType: PaymentType;
      paidAmount: number;
    }>
  >`
    SELECT
      p."id",
      p."quotationId",
      q."crmLeadId",
      q."quotationNo",
      p."paymentType",
      p."paidAmount"
    FROM "crm_quotation_payments" p
    INNER JOIN "crm_quotations" q ON q."id" = p."quotationId"
    WHERE p."id" = ${paymentId}
    LIMIT 1
  `;

  const payment = rows[0];
  if (!payment) {
    return { error: "Payment record not found" };
  }

  if (
    user.role !== "ADMIN" &&
    !(await canAccessQuotationForUser(payment.quotationId, {
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }))
  ) {
    return { error: "Only employees with delete permission can remove payment records" };
  }

  await db.$executeRaw`
    DELETE FROM "crm_quotation_payments"
    WHERE "id" = ${paymentId}
  `;

  await logActivity({
    action: "DELETE",
    entityType: "crm_payment",
    entityId: paymentId,
    createdById: user.id,
    metadata: {
      quotationId: payment.quotationId,
      crmLeadId: payment.crmLeadId,
      quotationNo: payment.quotationNo,
      paymentType: payment.paymentType,
      paidAmount: payment.paidAmount,
      deleteReason: normalizedReason,
    },
  });

  revalidatePath(`/crm/${payment.crmLeadId}/quotations/${payment.quotationId}`);
  revalidatePath(`/crm/${payment.crmLeadId}/quotations/${payment.quotationId}/invoice`);
  revalidatePath(`/crm/${payment.crmLeadId}/quotations/${payment.quotationId}/invoice/create`);
  revalidatePath(`/crm/${payment.crmLeadId}/quotations/${payment.quotationId}/invoice/payments/${paymentId}`);
  revalidatePath("/crm");

  return {
    success: true,
    crmLeadId: payment.crmLeadId,
    quotationId: payment.quotationId,
  };
}

export async function deleteQuotationInvoice(quotationId: string) {
  const user = await requireAdmin();
  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }

  await ensureDeletedInvoicesTable();

  const invoiceRows = await db.$queryRaw<Array<{ id: string; createdAt: Date }>>`
    SELECT "id", "createdAt"
    FROM "crm_quotation_invoices"
    WHERE "quotationId" = ${quotationId}
    LIMIT 1
  `;
  if (!invoiceRows[0]?.id) {
    return { error: "Invoice not found" };
  }

  const salespersonRows = await db.$queryRaw<Array<{ name: string | null }>>`
    SELECT "name" FROM "users" WHERE "id" = ${quotation.createdById} LIMIT 1
  `;
  const invoiceRef = buildInvoiceRef(quotation.createdAt, quotation.quotationNo);
  await db.$executeRaw`
    INSERT INTO "crm_deleted_invoices" (
      "id",
      "invoiceId",
      "quotationId",
      "crmLeadId",
      "invoiceRef",
      "orderNo",
      "clientName",
      "salespersonName",
      "status",
      "totalAmount",
      "invoiceCreatedAt",
      "deletedById",
      "deletedAt",
      "notes"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${invoiceRows[0].id},
      ${quotationId},
      ${quotation.crmLeadId},
      ${invoiceRef},
      ${quotation.quotationNo},
      ${quotation.clientName},
      ${salespersonRows[0]?.name ?? null},
      ${quotation.status},
      ${Number(quotation.totalAmount || 0)},
      ${invoiceRows[0].createdAt},
      ${user.id},
      NOW(),
      ${"Deleted from Orders to Invoice"}
    )
    ON CONFLICT ("invoiceId") DO NOTHING
  `;

  await db.$executeRaw`
    DELETE FROM "crm_quotation_invoices"
    WHERE "id" = ${invoiceRows[0].id}
  `;

  await logActivity({
    action: "DELETE",
    entityType: "crm_invoice",
    entityId: invoiceRows[0].id,
    createdById: user.id,
    metadata: { quotationId },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}/invoice`);
  revalidatePath("/crm/quotations");
  revalidatePath("/crm");
  return { success: true };
}

export async function bulkDeleteQuotationInvoices(invoiceIds: string[]) {
  let user: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    user = await requireActionPermission("DELETE", "SALES");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Forbidden" };
  }
  const uniqueIds = Array.from(new Set((invoiceIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { error: "No invoices selected" };
  }

  await ensureDeletedInvoicesTable();

  const invoiceRows = await db.$queryRaw<
    Array<{
      invoiceId: string;
      quotationId: string;
      crmLeadId: string;
      quotationNo: string;
      clientName: string;
      status: string;
      totalAmount: number;
      quotationCreatedAt: Date;
      invoiceCreatedAt: Date;
      createdById: string;
      salespersonName: string | null;
    }>
  >`
    SELECT
      i."id" AS "invoiceId",
      q."id" AS "quotationId",
      q."crmLeadId",
      q."quotationNo",
      q."clientName",
      q."status",
      q."totalAmount",
      q."createdAt" AS "quotationCreatedAt",
      i."createdAt" AS "invoiceCreatedAt",
      q."createdById",
      u."name" AS "salespersonName"
    FROM "crm_quotation_invoices" i
    INNER JOIN "crm_quotations" q
      ON q."id" = i."quotationId"
    LEFT JOIN "users" u
      ON u."id" = q."createdById"
    WHERE i."id" IN (${Prisma.join(uniqueIds)})
  `;

  let deletedCount = 0;
  let blockedCount = 0;

  for (const row of invoiceRows) {
    if (
      user.role !== "ADMIN" &&
      !(await canAccessQuotationForUser(row.quotationId, {
        userId: user.id,
        role: user.role,
        permissions: user.permissions,
      }))
    ) {
      blockedCount += 1;
      continue;
    }

    await db.$executeRaw`
      INSERT INTO "crm_deleted_invoices" (
        "id",
        "invoiceId",
        "quotationId",
        "crmLeadId",
        "invoiceRef",
        "orderNo",
        "clientName",
        "salespersonName",
        "status",
        "totalAmount",
        "invoiceCreatedAt",
        "deletedById",
        "deletedAt",
        "notes"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${row.invoiceId},
        ${row.quotationId},
        ${row.crmLeadId},
        ${buildInvoiceRef(row.quotationCreatedAt, row.quotationNo)},
        ${row.quotationNo},
        ${row.clientName},
        ${row.salespersonName},
        ${row.status},
        ${Number(row.totalAmount || 0)},
        ${row.invoiceCreatedAt},
        ${user.id},
        NOW(),
        ${"Deleted from Orders to Invoice"}
      )
      ON CONFLICT ("invoiceId") DO NOTHING
    `;

    await db.$executeRaw`
      DELETE FROM "crm_quotation_invoices"
      WHERE "id" = ${row.invoiceId}
    `;

    await logActivity({
      action: "DELETE",
      entityType: "crm_invoice",
      entityId: row.invoiceId,
      createdById: user.id,
      metadata: { quotationId: row.quotationId, bulk: true },
    });

    deletedCount += 1;
  }

  const missingCount = Math.max(0, uniqueIds.length - invoiceRows.length);
  revalidatePath("/crm/quotations");
  revalidatePath("/crm");

  return { success: true, deletedCount, blockedCount, missingCount };
}

export async function deleteCrmQuotation(quotationId: string) {
  const user = await requireActionPermission("DELETE", "SALES");
  if (
    user.role !== "ADMIN" &&
    !(await canAccessQuotationForUser(quotationId, {
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }))
  ) {
    return { error: "Forbidden" };
  }

  const quotation = await getCrmQuotation(quotationId);
  if (!quotation) {
    return { error: "Quotation not found" };
  }
  const quotationItems = await getQuotationItems(quotationId);

  await ensureQuotationPaymentsTable();
  const paymentRows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "crm_quotation_payments"
    WHERE "quotationId" = ${quotationId}
  `;
  if (Number(paymentRows[0]?.count || 0) > 0) {
    return { error: "Remove invoice payment records first" };
  }

  const invoiceRows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "crm_quotation_invoices"
    WHERE "quotationId" = ${quotationId}
  `;
  if (Number(invoiceRows[0]?.count || 0) > 0) {
    return { error: "Remove invoice first, then remove quotation" };
  }

  await ensureDeletedQuotationsTable();
  const salespersonRows = await db.$queryRaw<Array<{ name: string | null }>>`
    SELECT "name"
    FROM "users"
    WHERE "id" = ${quotation.createdById}
    LIMIT 1
  `;
  const deletedSnapshot: DeletedCrmQuotationSnapshot = {
    quotation: {
      id: quotation.id,
      crmLeadId: quotation.crmLeadId,
      quotationNo: quotation.quotationNo,
      title: quotation.title,
      clientName: quotation.clientName,
      clientEmail: quotation.clientEmail,
      projectTitle: quotation.projectTitle,
      serviceName: quotation.serviceName,
      unitName: quotation.unitName,
      unitCount: quotation.unitCount,
      unitPrice: quotation.unitPrice,
      gstPercent: quotation.gstPercent,
      subtotalAmount: quotation.subtotalAmount,
      gstAmount: quotation.gstAmount,
      totalAmount: quotation.totalAmount,
      terms: quotation.terms,
      notes: quotation.notes,
      validUntil: quotation.validUntil ? new Date(quotation.validUntil).toISOString() : null,
      status: quotation.status,
      sentAt: quotation.sentAt ? new Date(quotation.sentAt).toISOString() : null,
      createdById: quotation.createdById,
      createdAt: new Date(quotation.createdAt).toISOString(),
      updatedAt: new Date(quotation.updatedAt).toISOString(),
    },
    items: quotationItems.map((item) => ({
      id: item.id,
      quotationId: item.quotationId,
      name: item.name,
      unitCount: item.unitCount,
      amount: item.amount,
      gstPercent: item.gstPercent,
      tags: item.tags,
      createdAt: new Date(item.createdAt).toISOString(),
      updatedAt: new Date(item.updatedAt).toISOString(),
    })),
  };
  await db.$executeRaw`
    INSERT INTO "crm_deleted_quotations" (
      "id",
      "quotationId",
      "crmLeadId",
      "quotationNo",
      "title",
      "clientName",
      "salespersonName",
      "status",
      "totalAmount",
      "quotationCreatedAt",
      "snapshot",
      "isPurged",
      "deletedById",
      "deletedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${quotation.id},
      ${quotation.crmLeadId},
      ${quotation.quotationNo},
      ${quotation.title},
      ${quotation.clientName},
      ${salespersonRows[0]?.name ?? null},
      ${quotation.status},
      ${Number(quotation.totalAmount || 0)},
      ${quotation.createdAt},
      ${JSON.stringify(deletedSnapshot)}::jsonb,
      FALSE,
      ${user.id},
      NOW()
    )
    ON CONFLICT ("quotationId") DO UPDATE SET
      "crmLeadId" = EXCLUDED."crmLeadId",
      "quotationNo" = EXCLUDED."quotationNo",
      "title" = EXCLUDED."title",
      "clientName" = EXCLUDED."clientName",
      "salespersonName" = EXCLUDED."salespersonName",
      "status" = EXCLUDED."status",
      "totalAmount" = EXCLUDED."totalAmount",
      "quotationCreatedAt" = EXCLUDED."quotationCreatedAt",
      "snapshot" = EXCLUDED."snapshot",
      "isPurged" = FALSE,
      "deletedById" = EXCLUDED."deletedById",
      "deletedAt" = EXCLUDED."deletedAt"
  `;

  await db.$executeRaw`
    DELETE FROM "crm_quotation_items"
    WHERE "quotationId" = ${quotationId}
  `;
  await db.$executeRaw`
    DELETE FROM "crm_quotations"
    WHERE "id" = ${quotationId}
  `;

  await logActivity({
    action: "DELETE",
    entityType: "crm_quotation",
    entityId: quotationId,
    createdById: user.id,
    metadata: {
      crmLeadId: quotation.crmLeadId,
      quotationNo: quotation.quotationNo,
      totalAmount: quotation.totalAmount,
    },
  });

  revalidatePath(`/crm/${quotation.crmLeadId}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}`);
  revalidatePath(`/crm/${quotation.crmLeadId}/quotations/${quotationId}/invoice`);
  revalidatePath("/crm/quotations");
  revalidatePath("/crm");
  return { success: true, crmLeadId: quotation.crmLeadId };
}

export async function restoreDeletedCrmQuotation(quotationId: string) {
  const user = await requireActionPermission("UPDATE", "SALES");
  const detail = await loadDeletedCrmQuotationDetailRecord(quotationId);
  if (!detail) {
    return { error: "Deleted quotation not found" };
  }
  if (!detail.crmLeadId || !detail.canRestore) {
    return { error: "Related CRM lead is not available for restore" };
  }

  const existingRows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "crm_quotations"
    WHERE "id" = ${quotationId}
  `;
  if (Number(existingRows[0]?.count || 0) > 0) {
    return { error: "Quotation already restored" };
  }

  const lead = await loadDeletedQuotationLead(detail.crmLeadId);
  if (!lead) {
    return { error: "CRM lead not found. Cannot restore quotation" };
  }

  const quotationNoRows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS "count"
    FROM "crm_quotations"
    WHERE "quotationNo" = ${detail.quotationNo}
  `;
  const restoredQuotationNo =
    Number(quotationNoRows[0]?.count || 0) > 0 ? await getNextQuotationNo() : detail.quotationNo;

  const gstPercent = toSafeNumber(detail.gstPercent) ?? toSafeNumber(lead.gstPercent) ?? 18;
  const totalAmount = toSafeNumber(detail.totalAmount) ?? toSafeNumber(lead.finalAmount) ?? 0;
  const derivedSubtotal = gstPercent > 0 ? round2(totalAmount / (1 + gstPercent / 100)) : round2(totalAmount);
  const subtotalAmount = toSafeNumber(detail.subtotalAmount) ?? toSafeNumber(lead.subtotalAmount) ?? derivedSubtotal;
  const gstAmount = toSafeNumber(detail.gstAmount) ?? toSafeNumber(lead.gstAmount) ?? round2(totalAmount - subtotalAmount);
  const unitCount = Math.max(1, Math.trunc(toSafeNumber(detail.unitCount) ?? toSafeNumber(lead.unitCount) ?? 1));
  const unitPrice =
    toSafeNumber(detail.unitPrice) ??
    toSafeNumber(lead.unitPrice) ??
    round2(subtotalAmount / Math.max(unitCount, 1));
  const restoredStatus = toRestorableQuotationStatus(detail.lastKnownStatus || detail.status);
  const restoredSentAt = restoredStatus === "SENT" ? detail.sentAt : null;
  const restoredCreatedAt = detail.quotationCreatedAt || new Date();
  const restoredTitle = detail.title || `${lead.title} - Quotation`;
  const restoredClientName = detail.clientName || lead.clientName || "Unknown Client";
  const restoredProjectTitle = detail.projectTitle || lead.title || restoredTitle;
  const restoredServiceName = detail.serviceName ?? lead.serviceName ?? restoredProjectTitle;
  const restoredUnitName = detail.unitName ?? lead.unitName ?? "Project";
  const restoredClientEmail = detail.clientEmail ?? lead.email ?? "";
  const restoredCreatedById = detail.createdById || lead.createdById || user.id;

  await db.$executeRaw`
    INSERT INTO "crm_quotations" (
      "id",
      "crmLeadId",
      "quotationNo",
      "title",
      "clientName",
      "clientEmail",
      "projectTitle",
      "serviceName",
      "unitName",
      "unitCount",
      "unitPrice",
      "gstPercent",
      "subtotalAmount",
      "gstAmount",
      "totalAmount",
      "terms",
      "notes",
      "validUntil",
      "status",
      "sentAt",
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${quotationId},
      ${detail.crmLeadId},
      ${restoredQuotationNo},
      ${restoredTitle},
      ${restoredClientName},
      ${restoredClientEmail},
      ${restoredProjectTitle},
      ${restoredServiceName},
      ${restoredUnitName},
      ${unitCount},
      ${unitPrice},
      ${gstPercent},
      ${subtotalAmount},
      ${gstAmount},
      ${totalAmount},
      ${detail.terms},
      ${detail.notes},
      ${detail.validUntil},
      ${restoredStatus}::"QuotationStatus",
      ${restoredSentAt},
      ${restoredCreatedById},
      ${restoredCreatedAt},
      NOW()
    )
  `;

  for (const item of detail.items) {
    await db.$executeRaw`
      INSERT INTO "crm_quotation_items" (
        "id",
        "quotationId",
        "name",
        "unitCount",
        "amount",
        "gstPercent",
        "tags",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${item.id || crypto.randomUUID()},
        ${quotationId},
        ${item.name},
        ${Math.max(1, Number(item.unitCount || 1))},
        ${Math.max(0, Number(item.amount || 0))},
        ${Math.max(0, Number(item.gstPercent || 0))},
        ${item.tags},
        ${item.createdAt || restoredCreatedAt},
        NOW()
      )
    `;
  }

  await ensureDeletedQuotationsTable();
  await db.$executeRaw`
    INSERT INTO "crm_deleted_quotations" (
      "id",
      "quotationId",
      "crmLeadId",
      "quotationNo",
      "title",
      "clientName",
      "salespersonName",
      "status",
      "totalAmount",
      "quotationCreatedAt",
      "snapshot",
      "isPurged",
      "deletedById",
      "deletedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${detail.quotationId},
      ${detail.crmLeadId},
      ${detail.quotationNo},
      ${detail.title},
      ${detail.clientName},
      ${detail.salespersonName},
      ${detail.status},
      ${Number(detail.totalAmount || 0)},
      ${detail.quotationCreatedAt},
      NULL,
      TRUE,
      ${detail.deletedById},
      ${detail.deletedAt}
    )
    ON CONFLICT ("quotationId") DO UPDATE SET
      "isPurged" = TRUE
  `;

  await logActivity({
    action: "UPDATE",
    entityType: "crm_quotation_restore",
    entityId: quotationId,
    createdById: user.id,
    metadata: {
      crmLeadId: detail.crmLeadId,
      quotationNo: restoredQuotationNo,
      restoredFrom: detail.source,
    },
  });

  revalidatePath(`/crm/${detail.crmLeadId}/quotations/${quotationId}`);
  revalidatePath("/crm/quotations");
  revalidatePath(`/crm/quotations/deleted/${quotationId}`);
  revalidatePath("/crm");

  return { success: true, crmLeadId: detail.crmLeadId, quotationId };
}

export async function permanentlyDeleteDeletedCrmQuotation(quotationId: string) {
  const user = await requireActionPermission("DELETE", "SALES");
  const detail = await loadDeletedCrmQuotationDetailRecord(quotationId);
  if (!detail) {
    return { error: "Deleted quotation not found" };
  }

  await ensureDeletedQuotationsTable();
  await db.$executeRaw`
    INSERT INTO "crm_deleted_quotations" (
      "id",
      "quotationId",
      "crmLeadId",
      "quotationNo",
      "title",
      "clientName",
      "salespersonName",
      "status",
      "totalAmount",
      "quotationCreatedAt",
      "snapshot",
      "isPurged",
      "deletedById",
      "deletedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${detail.quotationId},
      ${detail.crmLeadId},
      ${detail.quotationNo},
      ${detail.title},
      ${detail.clientName},
      ${detail.salespersonName},
      ${detail.status},
      ${Number(detail.totalAmount || 0)},
      ${detail.quotationCreatedAt},
      NULL,
      TRUE,
      ${detail.deletedById},
      ${detail.deletedAt}
    )
    ON CONFLICT ("quotationId") DO UPDATE SET
      "isPurged" = TRUE
  `;

  await logActivity({
    action: "DELETE",
    entityType: "crm_deleted_quotation_permanent_delete",
    entityId: quotationId,
    createdById: user.id,
    metadata: {
      crmLeadId: detail.crmLeadId,
      quotationNo: detail.quotationNo,
      source: detail.source,
    },
  });

  revalidatePath("/crm/quotations");
  revalidatePath(`/crm/quotations/deleted/${quotationId}`);
  revalidatePath("/crm");

  return { success: true };
}

export async function bulkDeleteCrmQuotations(quotationIds: string[]) {
  try {
    await requireActionPermission("DELETE", "SALES");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Forbidden" };
  }
  const uniqueIds = Array.from(new Set((quotationIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { error: "No quotations selected" };
  }

  let deletedCount = 0;
  let blockedCount = 0;
  let missingCount = 0;
  const errors: string[] = [];

  for (const quotationId of uniqueIds) {
    const result = await deleteCrmQuotation(quotationId);
    if (result.success) {
      deletedCount += 1;
      continue;
    }
    if (result.error === "Quotation not found") {
      missingCount += 1;
    } else {
      blockedCount += 1;
    }
    if (result.error && errors.length < 5) {
      errors.push(result.error);
    }
  }

  return { success: true, deletedCount, blockedCount, missingCount, errors };
}
