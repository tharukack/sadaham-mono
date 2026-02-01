-- AlterTable
ALTER TABLE "PickupLocation" ADD COLUMN     "distributorCustomerId" TEXT,
ADD COLUMN     "transporterCustomerId" TEXT;

-- AddForeignKey
ALTER TABLE "PickupLocation" ADD CONSTRAINT "PickupLocation_distributorCustomerId_fkey" FOREIGN KEY ("distributorCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupLocation" ADD CONSTRAINT "PickupLocation_transporterCustomerId_fkey" FOREIGN KEY ("transporterCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
