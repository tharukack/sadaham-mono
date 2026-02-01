-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickupByCustomerId" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupByCustomerId_fkey" FOREIGN KEY ("pickupByCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
