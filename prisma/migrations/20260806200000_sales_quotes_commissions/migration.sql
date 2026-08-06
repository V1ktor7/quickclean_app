-- CreateTable
CREATE TABLE "SalesCommissionRate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCommissionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQuote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "panes" INTEGER NOT NULL DEFAULT 0,
    "floors" INTEGER NOT NULL DEFAULT 3,
    "panesAbove" INTEGER NOT NULL DEFAULT 0,
    "method" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sides" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCustomEstimate" BOOLEAN NOT NULL DEFAULT false,
    "windowAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gutterAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spiderAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "servicePlanAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatorJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesCommissionRate_userId_idx" ON "SalesCommissionRate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesCommissionRate_userId_serviceKey_key" ON "SalesCommissionRate"("userId", "serviceKey");

-- CreateIndex
CREATE INDEX "SalesQuote_createdById_idx" ON "SalesQuote"("createdById");

-- CreateIndex
CREATE INDEX "SalesQuote_createdAt_idx" ON "SalesQuote"("createdAt");

-- CreateIndex
CREATE INDEX "SalesQuote_leadId_idx" ON "SalesQuote"("leadId");

-- AddForeignKey
ALTER TABLE "SalesCommissionRate" ADD CONSTRAINT "SalesCommissionRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
