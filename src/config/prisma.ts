import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Prisma with connection pooling sized for high concurrency
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
});
