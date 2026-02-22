-- CreateEnum
CREATE TYPE "SmsMessageType" AS ENUM ('ORDER_CONFIRMATION', 'ORDER_MODIFIED', 'ORDER_REMINDER', 'THANK_YOU');

-- CreateEnum
CREATE TYPE "SmsBatchStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED');

-- AlterTable
ALTER TABLE "SmsMessage" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "type" "SmsMessageType";

-- CreateTable
CREATE TABLE "SmsBatch" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" "SmsMessageType" NOT NULL,
    "status" "SmsBatchStatus" NOT NULL DEFAULT 'RUNNING',
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsBatch_campaignId_type_key" ON "SmsBatch"("campaignId", "type");

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SmsBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsBatch" ADD CONSTRAINT "SmsBatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsBatch" ADD CONSTRAINT "SmsBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
