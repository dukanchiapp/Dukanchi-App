-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "embedding" vector(768);

-- CreateIndex
CREATE INDEX ON "Product" USING ivfflat (embedding vector_cosine_ops);
