-- CreateEnum
CREATE TYPE "NotificationRuleKind" AS ENUM ('CALENDAR', 'INTERVAL');

-- CreateEnum
CREATE TYPE "NotificationIntervalUnit" AS ENUM ('HOURS', 'DAYS', 'WEEKS');

-- AlterTable
ALTER TABLE "NotificationCampaign" ADD COLUMN "ruleKind" "NotificationRuleKind" NOT NULL DEFAULT 'CALENDAR';
ALTER TABLE "NotificationCampaign" ADD COLUMN "intervalUnit" "NotificationIntervalUnit";
ALTER TABLE "NotificationCampaign" ADD COLUMN "intervalValue" INTEGER;
ALTER TABLE "NotificationCampaign" ADD COLUMN "lastRunAt" TIMESTAMP(3);
