-- Rollback for 20260512164150_product_embedding_hnsw_index
--
-- Apply via:  psql "$URL" -f down.sql
-- Must run outside a transaction block.

DROP INDEX CONCURRENTLY IF EXISTS "Product_embedding_hnsw_idx";
