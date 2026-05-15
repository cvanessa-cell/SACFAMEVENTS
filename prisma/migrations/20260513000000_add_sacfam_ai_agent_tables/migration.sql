-- CreateTable
CREATE TABLE "SourceResearchRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT,
    "targetRegion" TEXT NOT NULL DEFAULT 'Sacramento / Placer',
    "requestedSourceCount" INTEGER NOT NULL DEFAULT 125,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "rawRequestSummary" TEXT,
    "rawResponsePreview" TEXT,
    "parsedSourceCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceResearchRun_status_createdAt_idx" ON "SourceResearchRun"("status", "createdAt");

-- CreateTable
CREATE TABLE "SourceResearchCandidate" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "sourceCategory" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "cityOrAreaServed" TEXT,
    "countyOrRegion" TEXT,
    "eventTypesJson" TEXT NOT NULL DEFAULT '[]',
    "familyRelevance" TEXT NOT NULL DEFAULT '',
    "whyUsefulForSacfamEvents" TEXT NOT NULL DEFAULT '',
    "estimatedUpdateFrequency" TEXT,
    "freshnessLikelihood" TEXT NOT NULL,
    "automationFit" TEXT NOT NULL,
    "recommendedIngestionMethod" TEXT NOT NULL,
    "reviewPriority" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deterministicScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verificationStatus" TEXT NOT NULL,
    "notes" TEXT,
    "duplicateOfSourceId" TEXT,
    "importStatus" TEXT NOT NULL DEFAULT 'pending_review',
    "importedSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceResearchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceResearchCandidate_runId_importStatus_idx" ON "SourceResearchCandidate"("runId", "importStatus");

-- CreateIndex
CREATE INDEX "SourceResearchCandidate_normalizedUrl_idx" ON "SourceResearchCandidate"("normalizedUrl");

-- AddForeignKey
ALTER TABLE "SourceResearchCandidate" ADD CONSTRAINT "SourceResearchCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SourceResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EventMonitorRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceId" TEXT,
    "sourcesChecked" INTEGER NOT NULL DEFAULT 0,
    "newEventsFound" INTEGER NOT NULL DEFAULT 0,
    "updatedEventsFound" INTEGER NOT NULL DEFAULT 0,
    "eventsNeedingReview" INTEGER NOT NULL DEFAULT 0,
    "calendarReadyEvents" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "rawResponsePreview" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMonitorRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventMonitorRun_status_createdAt_idx" ON "EventMonitorRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EventMonitorRun_sourceId_createdAt_idx" ON "EventMonitorRun"("sourceId", "createdAt");

-- CreateTable
CREATE TABLE "EventCandidate" (
    "id" TEXT NOT NULL,
    "monitorRunId" TEXT NOT NULL,
    "sourceId" TEXT,
    "eventTitle" TEXT NOT NULL,
    "eventUrl" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "eventDate" TEXT,
    "eventStartTime" TEXT,
    "eventEndTime" TEXT,
    "locationName" TEXT,
    "streetAddress" TEXT,
    "city" TEXT,
    "countyOrRegion" TEXT,
    "eventCategory" TEXT,
    "familyAgeRange" TEXT,
    "cost" TEXT,
    "registrationRequired" BOOLEAN,
    "descriptionSummary" TEXT NOT NULL DEFAULT '',
    "whyRelevantForFamilies" TEXT NOT NULL DEFAULT '',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adminReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "changeType" TEXT NOT NULL DEFAULT 'needs_manual_review',
    "calendarReady" TEXT NOT NULL DEFAULT 'needs_review',
    "missingFieldsJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "promotedFamilyEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventCandidate_monitorRunId_reviewStatus_idx" ON "EventCandidate"("monitorRunId", "reviewStatus");

-- CreateIndex
CREATE INDEX "EventCandidate_sourceId_createdAt_idx" ON "EventCandidate"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "EventCandidate_reviewStatus_createdAt_idx" ON "EventCandidate"("reviewStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "EventCandidate" ADD CONSTRAINT "EventCandidate_monitorRunId_fkey" FOREIGN KEY ("monitorRunId") REFERENCES "EventMonitorRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
