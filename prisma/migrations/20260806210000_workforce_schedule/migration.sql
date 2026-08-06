-- CreateEnum
CREATE TYPE "WorkforceTrack" AS ENUM ('TECH', 'SALES');

-- CreateEnum
CREATE TYPE "SlotAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AvailabilitySubmitStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "PostedScheduleStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateTable
CREATE TABLE "AvailabilitySubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" "WorkforceTrack" NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "status" "AvailabilitySubmitStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" "WorkforceTrack" NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "hour" INTEGER NOT NULL,
    "status" "SlotAvailability" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePeriod" (
    "id" TEXT NOT NULL,
    "track" "WorkforceTrack" NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "status" "PostedScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "hour" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilitySubmission_track_windowStart_status_idx" ON "AvailabilitySubmission"("track", "windowStart", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySubmission_userId_track_windowStart_key" ON "AvailabilitySubmission"("userId", "track", "windowStart");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_userId_track_day_idx" ON "AvailabilitySlot"("userId", "track", "day");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_track_day_hour_status_idx" ON "AvailabilitySlot"("track", "day", "hour", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySlot_submissionId_day_hour_key" ON "AvailabilitySlot"("submissionId", "day", "hour");

-- CreateIndex
CREATE INDEX "SchedulePeriod_track_status_idx" ON "SchedulePeriod"("track", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePeriod_track_windowStart_key" ON "SchedulePeriod"("track", "windowStart");

-- CreateIndex
CREATE INDEX "ScheduleEntry_userId_day_idx" ON "ScheduleEntry"("userId", "day");

-- CreateIndex
CREATE INDEX "ScheduleEntry_scheduleId_day_hour_idx" ON "ScheduleEntry"("scheduleId", "day", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_scheduleId_userId_day_hour_key" ON "ScheduleEntry"("scheduleId", "userId", "day", "hour");

-- AddForeignKey
ALTER TABLE "AvailabilitySubmission" ADD CONSTRAINT "AvailabilitySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AvailabilitySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePeriod" ADD CONSTRAINT "SchedulePeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "SchedulePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
