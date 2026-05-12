-- Rollback for 20260512164148_user_soft_delete_and_extensions
--
-- IMPORTANT: If migration 20260512164149 (Store_location_gist_idx) has been
-- applied, you MUST run its down.sql FIRST — that index depends on
-- earthdistance/cube which this rollback drops.
-- Order of operations is enforced via IF EXISTS guards so this script is
-- idempotent and safe to re-run.

-- 1. Drop the index first (NOT CONCURRENTLY — it's a small btree built in tx)
DROP INDEX IF EXISTS "User_deletedAt_idx";

-- 2. Drop the columns
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "deletionReason",
  DROP COLUMN IF EXISTS "deletionRequestedAt",
  DROP COLUMN IF EXISTS "deletedAt";

-- 3. Drop extensions in dependency-reverse order
--    earthdistance depends on cube — drop earthdistance first.
--    These will fail loudly if any object still depends on them — that is
--    intentional (forces caller to roll back the spatial index migration first).
DROP EXTENSION IF EXISTS earthdistance;
DROP EXTENSION IF EXISTS cube;
