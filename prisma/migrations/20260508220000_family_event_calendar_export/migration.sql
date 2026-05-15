-- AlterTable
ALTER TABLE "FamilyEvent" ADD COLUMN     "googleCalendarEventId" TEXT,
ADD COLUMN     "googleCalendarExportedAt" TIMESTAMP(3),
ADD COLUMN     "googleCalendarHtmlLink" TEXT;
