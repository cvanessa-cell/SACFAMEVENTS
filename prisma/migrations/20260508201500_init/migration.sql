-- CreateTable
CREATE TABLE "GoogleOAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarCredentials" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiry" TIMESTAMP(3),
    "scope" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarCredentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppAutomationSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "preferredRunTime" TEXT NOT NULL DEFAULT '09:00',
    "maxSourcesPerRun" INTEGER NOT NULL DEFAULT 25,
    "onlyActiveSources" BOOLEAN NOT NULL DEFAULT true,
    "autoConfirmHighConfidence" BOOLEAN NOT NULL DEFAULT false,
    "autoAddToGoogleCalendar" BOOLEAN NOT NULL DEFAULT false,
    "minConfidenceAutoConfirm" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "defaultReminderProfile" TEXT NOT NULL DEFAULT '1h',
    "customReminderMinutesJson" TEXT,
    "zapierWebhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppAutomationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRunLog" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "message" TEXT,
    "sourcesTried" INTEGER NOT NULL DEFAULT 0,
    "eventsUpserted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DiscoveryRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZapierWebhookLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectionKey" TEXT NOT NULL,
    "airtableRecordId" TEXT,
    "eventNameSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "detail" TEXT,

    CONSTRAINT "ZapierWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackDecisionState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastSignature" TEXT,
    "lastSummary" TEXT,
    "lastDecisionPostedAt" TIMESTAMP(3),
    "lastHumanActivityAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackDecisionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "region" TEXT,
    "city" TEXT,
    "county" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'unknown',
    "fetchStrategy" TEXT NOT NULL DEFAULT 'direct_fetch',
    "checkFrequencyMinutes" INTEGER NOT NULL DEFAULT 360,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trustedSourceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastContentHash" TEXT,
    "lastSnapshotText" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFetchLog" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "contentHash" TEXT,
    "contentLength" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceFetchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceChange" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "oldHash" TEXT,
    "newHash" TEXT NOT NULL,
    "changeSummary" TEXT,
    "changedTextExcerpt" TEXT,
    "fullSnapshotText" TEXT,
    "snapshotStorageKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEventExtractionJob" (
    "id" TEXT NOT NULL,
    "sourceChangeId" TEXT NOT NULL,
    "openaiResponseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "requestPayload" TEXT,
    "rawResponseText" TEXT,
    "parsedJson" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiEventExtractionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceEventUrl" TEXT,
    "sourceId" TEXT,
    "sourceChangeId" TEXT,
    "city" TEXT,
    "county" TEXT,
    "venueName" TEXT,
    "address" TEXT,
    "startDatetime" TIMESTAMP(3),
    "endDatetime" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "ageRange" TEXT,
    "priceText" TEXT,
    "registrationUrl" TEXT,
    "familyFriendlyScore" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'needs_review',
    "duplicateKey" TEXT,
    "cancellationStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventReviewNote" (
    "id" TEXT NOT NULL,
    "familyEventId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReviewNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenAIWebhookTask" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OpenAIWebhookTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleOAuthState_state_key" ON "GoogleOAuthState"("state");

-- CreateIndex
CREATE UNIQUE INDEX "EventSource_sourceUrl_key" ON "EventSource"("sourceUrl");

-- CreateIndex
CREATE INDEX "SourceFetchLog_sourceId_createdAt_idx" ON "SourceFetchLog"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "SourceChange_sourceId_createdAt_idx" ON "SourceChange"("sourceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiEventExtractionJob_openaiResponseId_key" ON "AiEventExtractionJob"("openaiResponseId");

-- CreateIndex
CREATE INDEX "AiEventExtractionJob_sourceChangeId_createdAt_idx" ON "AiEventExtractionJob"("sourceChangeId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyEvent_sourceId_createdAt_idx" ON "FamilyEvent"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyEvent_sourceChangeId_createdAt_idx" ON "FamilyEvent"("sourceChangeId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyEvent_duplicateKey_idx" ON "FamilyEvent"("duplicateKey");

-- CreateIndex
CREATE INDEX "EventReviewNote_familyEventId_createdAt_idx" ON "EventReviewNote"("familyEventId", "createdAt");

-- CreateIndex
CREATE INDEX "OpenAIWebhookTask_status_createdAt_idx" ON "OpenAIWebhookTask"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OpenAIWebhookTask_responseId_createdAt_idx" ON "OpenAIWebhookTask"("responseId", "createdAt");

-- AddForeignKey
ALTER TABLE "SourceFetchLog" ADD CONSTRAINT "SourceFetchLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceChange" ADD CONSTRAINT "SourceChange_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEventExtractionJob" ADD CONSTRAINT "AiEventExtractionJob_sourceChangeId_fkey" FOREIGN KEY ("sourceChangeId") REFERENCES "SourceChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyEvent" ADD CONSTRAINT "FamilyEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyEvent" ADD CONSTRAINT "FamilyEvent_sourceChangeId_fkey" FOREIGN KEY ("sourceChangeId") REFERENCES "SourceChange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReviewNote" ADD CONSTRAINT "EventReviewNote_familyEventId_fkey" FOREIGN KEY ("familyEventId") REFERENCES "FamilyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

