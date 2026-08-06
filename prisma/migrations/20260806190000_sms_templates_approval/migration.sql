-- AlterEnum
ALTER TYPE "SMSStatus" ADD VALUE 'AWAITING_APPROVAL';
ALTER TYPE "SMSStatus" ADD VALUE 'DENIED';

-- CreateTable
CREATE TABLE "SMSTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SMSKind" NOT NULL,
    "body" TEXT NOT NULL,
    "linksJson" TEXT NOT NULL DEFAULT '[]',
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SMSTemplate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SMSCampaign" ADD COLUMN "templateId" TEXT;

-- AlterTable
ALTER TABLE "SMSMessage" ADD COLUMN "templateId" TEXT,
ADD COLUMN "clientId" TEXT,
ADD COLUMN "jobberJobId" TEXT;

-- CreateIndex
CREATE INDEX "SMSTemplate_kind_isActive_idx" ON "SMSTemplate"("kind", "isActive");

-- CreateIndex
CREATE INDEX "SMSCampaign_templateId_idx" ON "SMSCampaign"("templateId");

-- CreateIndex
CREATE INDEX "SMSMessage_templateId_idx" ON "SMSMessage"("templateId");

-- CreateIndex
CREATE INDEX "SMSMessage_kind_status_createdAt_idx" ON "SMSMessage"("kind", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "SMSMessage" ADD CONSTRAINT "SMSMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SMSTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default templates
INSERT INTO "SMSTemplate" ("id", "name", "kind", "body", "linksJson", "imageUrl", "isActive", "createdAt", "updatedAt")
VALUES
  (
    'seed_review_default',
    'Default review ask',
    'REVIEW',
    'Hi {{firstName}}! Thanks for choosing QuickClean. We''d love a quick review: {{reviewLink}}',
    '[]',
    NULL,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'seed_marketing_default',
    'Default marketing',
    'MARKETING',
    'Hi {{firstName}}, QuickClean here — ready for sparkling windows this season? Reply YES to book.',
    '[]',
    NULL,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );
