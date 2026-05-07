-- CreateTable
CREATE TABLE "OpenAIWebhookTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "processedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "OpenAIWebhookTask_status_createdAt_idx" ON "OpenAIWebhookTask"("status", "createdAt");
CREATE INDEX "OpenAIWebhookTask_responseId_createdAt_idx" ON "OpenAIWebhookTask"("responseId", "createdAt");
