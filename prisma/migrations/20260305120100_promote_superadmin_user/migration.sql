-- Promote default super admin user (must run after enum value exists)
UPDATE "User"
SET "role" = 'SUPERADMIN'
WHERE "mobile" = '0400000001';
