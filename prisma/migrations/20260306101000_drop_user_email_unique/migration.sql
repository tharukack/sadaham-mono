-- Drop unique constraint on User.email to allow duplicates
DROP INDEX IF EXISTS "User_email_key";
