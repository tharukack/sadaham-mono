-- Add new name column, backfill from first/last, then drop old columns
ALTER TABLE "Customer" ADD COLUMN "name" TEXT;

UPDATE "Customer"
SET "name" = trim(concat_ws(' ', "firstName", "lastName"));

ALTER TABLE "Customer" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "Customer" DROP COLUMN "firstName";
ALTER TABLE "Customer" DROP COLUMN "lastName";
