DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuotationStatus') THEN
    CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentType') THEN
    CREATE TYPE "PaymentType" AS ENUM ('FIXED', 'PERCENTAGE', 'MONTHLY');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "crm_quotations" (
  "id" TEXT NOT NULL,
  "crmLeadId" TEXT NOT NULL,
  "quotationNo" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "clientEmail" TEXT NOT NULL,
  "projectTitle" TEXT NOT NULL,
  "serviceName" TEXT,
  "unitName" TEXT,
  "unitCount" INTEGER NOT NULL DEFAULT 0,
  "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
  "subtotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "terms" TEXT,
  "notes" TEXT,
  "validUntil" TIMESTAMP(3),
  "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
  "sentAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crm_quotations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_quotations_quotationNo_key" ON "crm_quotations"("quotationNo");
CREATE INDEX IF NOT EXISTS "crm_quotations_crmLeadId_createdAt_idx" ON "crm_quotations"("crmLeadId", "createdAt");
CREATE INDEX IF NOT EXISTS "crm_quotations_status_idx" ON "crm_quotations"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_quotations_crmLeadId_fkey') THEN
    ALTER TABLE "crm_quotations"
      ADD CONSTRAINT "crm_quotations_crmLeadId_fkey"
      FOREIGN KEY ("crmLeadId") REFERENCES "crm_leads"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_quotations_createdById_fkey') THEN
    ALTER TABLE "crm_quotations"
      ADD CONSTRAINT "crm_quotations_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "crm_quotation_invoices" (
  "id" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "paymentType" "PaymentType" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "percentage" DOUBLE PRECISION,
  "months" INTEGER,
  "balanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crm_quotation_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_quotation_invoices_quotationId_key" ON "crm_quotation_invoices"("quotationId");
CREATE INDEX IF NOT EXISTS "crm_quotation_invoices_paymentType_idx" ON "crm_quotation_invoices"("paymentType");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_quotation_invoices_quotationId_fkey') THEN
    ALTER TABLE "crm_quotation_invoices"
      ADD CONSTRAINT "crm_quotation_invoices_quotationId_fkey"
      FOREIGN KEY ("quotationId") REFERENCES "crm_quotations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_quotation_invoices_createdById_fkey') THEN
    ALTER TABLE "crm_quotation_invoices"
      ADD CONSTRAINT "crm_quotation_invoices_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
