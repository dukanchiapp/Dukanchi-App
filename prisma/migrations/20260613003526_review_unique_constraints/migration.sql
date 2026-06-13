-- D3 (Session 128.31): one review per user per store, one per user per product.
--
-- DEDUP FIRST (atomic + idempotent): remove duplicate reviews BEFORE creating
-- the unique indexes, so the migration is safe even if a duplicate races in
-- before deploy, and a complete no-op when there are none. We KEEP the most
-- recent review per (user, target) pair — latest createdAt, tie-broken by the
-- larger id. Review has no updatedAt, so createdAt is the recency signal.
--
-- Pre-migration audit (Session 128.31, read-only SELECT vs prod Neon): PROD had
-- 0 reviews / 0 store dups / 0 product dups, so on the current prod dataset BOTH
-- DELETEs remove ZERO rows. The dedup is purely defensive for the deploy window.
--
-- storeId / productId are NULLABLE → Postgres treats NULLs as DISTINCT, so the
-- two unique indexes never collide (a store review has productId NULL and a
-- product review has storeId NULL). Multiple NULLs in a column are allowed.

-- Dedup store reviews: keep newest per (userId, storeId) where storeId IS NOT NULL.
DELETE FROM "Review" a
USING "Review" b
WHERE a."storeId" IS NOT NULL
  AND a."userId" = b."userId"
  AND a."storeId" = b."storeId"
  AND (a."createdAt" < b."createdAt"
       OR (a."createdAt" = b."createdAt" AND a."id" < b."id"));

-- Dedup product reviews: keep newest per (userId, productId) where productId IS NOT NULL.
DELETE FROM "Review" a
USING "Review" b
WHERE a."productId" IS NOT NULL
  AND a."userId" = b."userId"
  AND a."productId" = b."productId"
  AND (a."createdAt" < b."createdAt"
       OR (a."createdAt" = b."createdAt" AND a."id" < b."id"));

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_storeId_key" ON "Review"("userId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");
