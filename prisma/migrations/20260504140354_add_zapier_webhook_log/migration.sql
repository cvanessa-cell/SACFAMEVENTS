-- CreateTable
CREATE TABLE "ZapierWebhookLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectionKey" TEXT NOT NULL,
    "airtableRecordId" TEXT,
    "eventNameSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "detail" TEXT
);
