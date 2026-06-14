-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL DEFAULT 1,
    "amount" DOUBLE PRECISION NOT NULL,
    "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_quotation_items_quotationId_idx" ON "crm_quotation_items"("quotationId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_quotation_items_quotationId_fkey'
  ) THEN
    ALTER TABLE "crm_quotation_items"
      ADD CONSTRAINT "crm_quotation_items_quotationId_fkey"
      FOREIGN KEY ("quotationId") REFERENCES "crm_quotations"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
