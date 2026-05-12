ALTER TABLE "User" ADD COLUMN "canViewDispatch" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "canViewDispatch" = true
WHERE "role" IN ('ADMIN', 'SUPERADMIN');
