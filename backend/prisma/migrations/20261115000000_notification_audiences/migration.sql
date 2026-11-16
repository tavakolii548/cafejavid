-- AlterEnum
ALTER TYPE "NotificationAudience" ADD VALUE 'MULTI';
ALTER TYPE "NotificationAudience" ADD VALUE 'BIRTHDAY';
ALTER TYPE "NotificationAudience" ADD VALUE 'SPECIAL_DAY';

-- CreateEnum
CREATE TYPE "NotificationDelivery" AS ENUM ('NOW', 'RULE');

-- AlterTable
ALTER TABLE "NotificationCampaign" ADD COLUMN "delivery" "NotificationDelivery" NOT NULL DEFAULT 'NOW';
ALTER TABLE "NotificationCampaign" ADD COLUMN "userIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "NotificationCampaign" ADD COLUMN "specialMonth" INTEGER;
ALTER TABLE "NotificationCampaign" ADD COLUMN "specialDay" INTEGER;
ALTER TABLE "NotificationCampaign" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationCampaign" ADD COLUMN "lastRunOn" TEXT;
