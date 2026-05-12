import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Single shared Prisma instance — pool size is controlled via DATABASE_URL params:
//   ?connection_limit=10&pool_timeout=20
// Neon (serverless Postgres) recommends connection_limit=10 for medium apps.
// See .env.example for the recommended DATABASE_URL format.
//
// transactionOptions — Day 3 / Session 89 / Subtask 3.5.
// Client-wide defaults for prisma.$transaction(fn) calls; individual call sites
// can still override per-transaction.
//   - maxWait: 5s  — max time waiting to ACQUIRE a transaction slot from the pool
//   - timeout: 30s — max time the transaction itself may take before rollback
// 30s is generous; most transactions complete in single-digit ms. Keeps a hard
// ceiling so a slow Postgres query can't pin a connection indefinitely.
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
  transactionOptions: {
    maxWait: 5_000,
    timeout: 30_000,
  },
});
