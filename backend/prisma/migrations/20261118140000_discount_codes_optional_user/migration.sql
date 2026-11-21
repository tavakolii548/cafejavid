-- AlterTable: allow global discount codes (all customers)
ALTER TABLE "DiscountCode" DROP CONSTRAINT "DiscountCode_userId_fkey";

ALTER TABLE "DiscountCode" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
