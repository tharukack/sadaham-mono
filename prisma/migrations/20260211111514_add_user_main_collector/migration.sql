-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mainCollectorId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_mainCollectorId_fkey" FOREIGN KEY ("mainCollectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
