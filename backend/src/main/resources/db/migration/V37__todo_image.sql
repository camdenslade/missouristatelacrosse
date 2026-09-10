-- Lets a to-do card show a custom image; the frontend falls back to the linked
-- site's favicon client-side when this is blank. Stores an S3 key (presigned
-- for read the same way Fundraiser.image is), not a public URL.
ALTER TABLE men.todos   ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE women.todos ADD COLUMN IF NOT EXISTS image TEXT;
