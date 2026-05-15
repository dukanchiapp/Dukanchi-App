-- Hardening Day 2 / Session 87 — Product embedding HNSW index (CONCURRENTLY)
--
-- Builds an HNSW (Hierarchical Navigable Small World) index over
-- Product.embedding for fast approximate-nearest-neighbour queries with
-- cosine similarity (Gemini text-embedding-004 is L2-normalised, so cosine
-- ≡ inner-product up to a constant — vector_cosine_ops is the right op
-- class for our search.service.ts usage).
--
-- pgvector 0.8.0 supports HNSW (added in 0.5.0). HNSW is preferred over
-- IVFFLAT for our scale because it requires no training step and gives
-- better recall/latency at small-to-medium dataset sizes.
--
-- Embedding column is nullable (Unsupported("vector(768)")?). HNSW indexes
-- ignore NULL rows — no special handling required.
--
-- TRANSACTIONALITY: Same as the Store GiST migration — apply outside a
-- transaction block via plain psql -f.
--
-- IDEMPOTENT via IF NOT EXISTS.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_embedding_hnsw_idx"
  ON "Product" USING hnsw (embedding vector_cosine_ops);
