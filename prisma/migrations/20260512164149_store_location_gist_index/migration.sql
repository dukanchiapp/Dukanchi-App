-- Hardening Day 2 / Session 87 — Store location GiST index (CONCURRENTLY)
--
-- Builds a GiST index over earth-projected coordinates so radius queries
-- (earth_box + earth_distance) can use an index instead of a full scan.
--
-- TRANSACTIONALITY:
-- This file MUST be applied outside any transaction block. CREATE INDEX
-- CONCURRENTLY is forbidden inside a transaction by PostgreSQL.
-- Apply via:  psql "$URL" -f migration.sql
-- (psql's default autocommit mode runs each top-level statement as its own
-- transaction — correct behavior here. Do NOT pass --single-transaction.)
--
-- IDEMPOTENT: Uses IF NOT EXISTS so re-running after a previous successful
-- run is a no-op. If a previous CONCURRENTLY run was interrupted, the index
-- may exist in an INVALID state — drop it first via down.sql then re-run.
--
-- DEPENDS ON: migration 20260512164148 (earthdistance + cube extensions).

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Store_location_gist_idx"
  ON "Store" USING GIST (ll_to_earth(latitude, longitude));
