-- Hardening Day 2 / Session 87 — User soft-delete columns + spatial extensions
--
-- Applies as a single transactional batch via psql.
-- Adds 3 nullable columns to "User" for DPDP-compliant soft-delete (grace period
-- deletion, with audit trail of when the request was made and why).
-- Installs cube + earthdistance to enable the GiST(ll_to_earth) index that
-- migration 20260512164149 creates concurrently afterwards.

-- 1. Soft-delete columns on User
ALTER TABLE "User"
  ADD COLUMN "deletedAt"           TIMESTAMP(3),
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "deletionReason"      VARCHAR(500);

-- 2. Index for fast soft-delete filtering (every auth query will check this)
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- 3. Extensions needed by the spatial index in the next migration
--    earthdistance depends on cube, so cube must be installed first.
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
