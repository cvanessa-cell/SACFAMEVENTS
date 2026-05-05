-- CreateTable
CREATE TABLE "GoogleOAuthState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GoogleCalendarCredentials" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiry" DATETIME,
    "scope" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppAutomationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "preferredRunTime" TEXT NOT NULL DEFAULT '09:00',
    "maxSourcesPerRun" INTEGER NOT NULL DEFAULT 25,
    "onlyActiveSources" BOOLEAN NOT NULL DEFAULT true,
    "autoConfirmHighConfidence" BOOLEAN NOT NULL DEFAULT false,
    "autoAddToGoogleCalendar" BOOLEAN NOT NULL DEFAULT false,
    "minConfidenceAutoConfirm" REAL NOT NULL DEFAULT 0.85,
    "defaultReminderProfile" TEXT NOT NULL DEFAULT '1h',
    "customReminderMinutesJson" TEXT,
    "zapierWebhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiscoveryRunLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "sourcesTried" INTEGER NOT NULL DEFAULT 0,
    "eventsUpserted" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleOAuthState_state_key" ON "GoogleOAuthState"("state");
