-- CreateTable
CREATE TABLE "OpenAiAppDiscoveryRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "city" TEXT,
    "lookaheadDays" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "candidatesJson" JSONB NOT NULL,
    "summaryJson" JSONB,

    CONSTRAINT "OpenAiAppDiscoveryRun_pkey" PRIMARY KEY ("id")
);
