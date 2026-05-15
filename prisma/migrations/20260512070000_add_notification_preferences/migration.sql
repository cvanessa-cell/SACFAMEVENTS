-- AlterTable
ALTER TABLE "AppAutomationSettings" ADD COLUMN "slackDigestEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppAutomationSettings" ADD COLUMN "slackDigestHour" INTEGER NOT NULL DEFAULT 16;
ALTER TABLE "AppAutomationSettings" ADD COLUMN "notifyOnNewEvents" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppAutomationSettings" ADD COLUMN "notifyOnFailedChecks" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppAutomationSettings" ADD COLUMN "notifyOnReviewBacklog" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppAutomationSettings" ADD COLUMN "reviewBacklogThreshold" INTEGER NOT NULL DEFAULT 25;
