-- Add missing permissions column expected by Prisma User model
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "permissions" JSONB;
