-- Rollback for 20260512164149_store_location_gist_index
--
-- Apply via:  psql "$URL" -f down.sql
-- Must run outside a transaction block (DROP INDEX CONCURRENTLY constraint).

DROP INDEX CONCURRENTLY IF EXISTS "Store_location_gist_idx";
