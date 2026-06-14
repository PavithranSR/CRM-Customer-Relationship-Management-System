/*
  Warnings:

  - The values [MANAGER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'BA', 'TEAMLEADER', 'EMPLOYEE');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
COMMIT;

-- DropIndex
DROP INDEX "projects_clientId_idx";

-- AlterTable
ALTER TABLE "crm_quotation_invoices" ALTER COLUMN "amount" DROP DEFAULT,
ALTER COLUMN "balanceAmount" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "crm_quotations" ALTER COLUMN "unitCount" DROP DEFAULT,
ALTER COLUMN "unitPrice" DROP DEFAULT,
ALTER COLUMN "subtotalAmount" DROP DEFAULT,
ALTER COLUMN "gstAmount" DROP DEFAULT,
ALTER COLUMN "totalAmount" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "crm_stages" ALTER COLUMN "updatedAt" DROP DEFAULT;
