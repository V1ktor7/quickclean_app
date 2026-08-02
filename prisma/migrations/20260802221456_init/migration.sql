-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TimeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "punchedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "punchedOutAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timeLogId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ChecklistItem_timeLogId_fkey" FOREIGN KEY ("timeLogId") REFERENCES "TimeLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UpsellRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tip" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UpsellLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "techId" TEXT NOT NULL,
    "ruleId" TEXT,
    "description" TEXT NOT NULL,
    "amount" REAL,
    "jobberJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpsellLog_techId_fkey" FOREIGN KEY ("techId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UpsellLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "UpsellRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "pushToJobber" BOOLEAN NOT NULL DEFAULT false,
    "jobberId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobberClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isCommercial" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "lastServiceAt" DATETIME,
    "jobberWebUri" TEXT,
    "rawJson" TEXT,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JobberJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobberId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT,
    "status" TEXT,
    "completedAt" DATETIME,
    "scheduledAt" DATETIME,
    "jobberWebUri" TEXT,
    "rawJson" TEXT,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobberJob_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "JobberClient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SMSCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "filterJson" TEXT NOT NULL DEFAULT '{}',
    "messageBody" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SMSCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SMSMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT,
    "to" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "kind" TEXT NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "clientName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SMSMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SMSCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accountId" TEXT,
    "payload" TEXT NOT NULL,
    "processedAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "TimeLog_userId_status_idx" ON "TimeLog"("userId", "status");

-- CreateIndex
CREATE INDEX "ChecklistItem_timeLogId_idx" ON "ChecklistItem"("timeLogId");

-- CreateIndex
CREATE INDEX "UpsellLog_createdAt_idx" ON "UpsellLog"("createdAt");

-- CreateIndex
CREATE INDEX "UpsellLog_techId_idx" ON "UpsellLog"("techId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobberClient_jobberId_key" ON "JobberClient"("jobberId");

-- CreateIndex
CREATE INDEX "JobberClient_isCommercial_idx" ON "JobberClient"("isCommercial");

-- CreateIndex
CREATE INDEX "JobberClient_lastServiceAt_idx" ON "JobberClient"("lastServiceAt");

-- CreateIndex
CREATE INDEX "JobberClient_name_idx" ON "JobberClient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "JobberJob_jobberId_key" ON "JobberJob"("jobberId");

-- CreateIndex
CREATE INDEX "JobberJob_status_idx" ON "JobberJob"("status");

-- CreateIndex
CREATE INDEX "JobberJob_completedAt_idx" ON "JobberJob"("completedAt");

-- CreateIndex
CREATE INDEX "SMSMessage_campaignId_idx" ON "SMSMessage"("campaignId");

-- CreateIndex
CREATE INDEX "SMSMessage_kind_createdAt_idx" ON "SMSMessage"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_topic_itemId_key" ON "WebhookEvent"("topic", "itemId");
