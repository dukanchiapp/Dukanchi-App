import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Single shared Prisma instance — pool size is controlled via DATABASE_URL params:
//   ?connection_limit=10&pool_timeout=20
// Neon (serverless Postgres) recommends connection_limit=10 for medium apps.
// See .env.example for the recommended DATABASE_URL format.
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
});
