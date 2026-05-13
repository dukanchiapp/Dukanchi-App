/**
 * Prisma mock factory — Day 2.7 / Session 91 / Phase 1 infrastructure.
 *
 * Returns a shape-compatible prisma client with the methods most commonly
 * needed across tests. Each method is a `vi.fn()` so tests can override
 * via `vi.mocked(prisma.user.findUnique).mockResolvedValue(...)`.
 *
 * Pattern derived from src/middlewares/auth.middleware.test.ts:42-43 and
 * src/middlewares/user-status.test.ts:27-28 — codifies the same shape
 * those tests construct inline.
 *
 * Usage:
 *   vi.mock("../config/prisma", () => ({ prisma: makeMockPrisma() }));
 *   ...
 *   import { prisma } from "../config/prisma";
 *   vi.mocked(prisma.user.findUnique).mockResolvedValue(makeTestUser());
 */
import { vi } from "vitest";

export function makeMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    teamMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    store: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    report: {
      count: vi.fn(),
    },
    review: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
}
