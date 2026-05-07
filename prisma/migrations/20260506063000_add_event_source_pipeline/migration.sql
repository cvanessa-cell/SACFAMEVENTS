-- CreateTable
CREATE TABLE "EventSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "trustedSourceScore" REAL NOT NULL DEFAULT 0.5,
    "lastCheckedAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastFailureAt" DATETIME,
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastContentHash" TEXT,
    "lastSnapshotText" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "EventSource_sourceUrl_key" ON "EventSource"("sourceUrl");

-- CreateTable
CREATE TABLE "SourceFetchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "contentHash" TEXT,
    "contentLength" INTEGER,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceFetchLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "oldHash" TEXT,
    "newHash" TEXT NOT NULL,
    "changeSummary" TEXT,
    "changedTextExcerpt" TEXT,
    "fullSnapshotText" TEXT,
    "snapshotStorageKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_ai',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceChange_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiEventExtractionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceChangeId" TEXT NOT NULL,
    "openaiResponseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "requestPayload" TEXT,
    "rawResponseText" TEXT,
    "parsedJson" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiEventExtractionJob_sourceChangeId_fkey" FOREIGN KEY ("sourceChangeId") REFERENCES "SourceChange" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FamilyEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceEventUrl" TEXT,
    "sourceId" TEXT,
    "sourceChangeId" TEXT,
    "city" TEXT,
    "county" TEXT,
    "venueName" TEXT,
    "address" TEXT,
    "startDatetime" DATETIME,
    "endDatetime" DATETIME,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "ageRange" TEXT,
    "priceText" TEXT,
    "registrationUrl" TEXT,
    "familyFriendlyScore" REAL,
    "confidence" REAL,
    "status" TEXT NOT NULL DEFAULT 'needs_review',
    "duplicateKey" TEXT,
    "cancellationStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FamilyEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FamilyEvent_sourceChangeId_fkey" FOREIGN KEY ("sourceChangeId") REFERENCES "SourceChange" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventReviewNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyEventId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventReviewNote_familyEventId_fkey" FOREIGN KEY ("familyEventId") REFERENCES "FamilyEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SlackDecisionState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "lastSignature" TEXT,
    "lastSummary" TEXT,
    "lastDecisionPostedAt" DATETIME,
    "lastHumanActivityAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SourceFetchLog_sourceId_createdAt_idx" ON "SourceFetchLog"("sourceId", "createdAt");
CREATE INDEX "SourceChange_sourceId_createdAt_idx" ON "SourceChange"("sourceId", "createdAt");
CREATE UNIQUE INDEX "AiEventExtractionJob_openaiResponseId_key" ON "AiEventExtractionJob"("openaiResponseId");
CREATE INDEX "AiEventExtractionJob_sourceChangeId_createdAt_idx" ON "AiEventExtractionJob"("sourceChangeId", "createdAt");
CREATE INDEX "FamilyEvent_sourceId_createdAt_idx" ON "FamilyEvent"("sourceId", "createdAt");
CREATE INDEX "FamilyEvent_sourceChangeId_createdAt_idx" ON "FamilyEvent"("sourceChangeId", "createdAt");
CREATE INDEX "FamilyEvent_duplicateKey_idx" ON "FamilyEvent"("duplicateKey");
CREATE INDEX "EventReviewNote_familyEventId_createdAt_idx" ON "EventReviewNote"("familyEventId", "createdAt");
