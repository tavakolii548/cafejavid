-- AlterTable
ALTER TABLE "User" ADD COLUMN "customerCode" TEXT;

-- Backfill unique club codes for existing members (CJ-1001, CJ-1002, ...)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "User"
  WHERE "customerCode" IS NULL
)
UPDATE "User" AS u
SET "customerCode" = 'CJ-' || (1000 + numbered.rn)::text
FROM numbered
WHERE u.id = numbered.id;

-- CreateIndex
CREATE UNIQUE INDEX "User_customerCode_key" ON "User"("customerCode");
