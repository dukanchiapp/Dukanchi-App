import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

/**
 * Signup + DPDP consent integration tests — Legal Phase A.
 *
 * Covers POST /api/auth/users (signup): the Zod `consent` gate and the
 * transactional LegalConsent ledger write added in Step 5.
 *
 * Same scaffolding as auth.integration.test.ts — env / prisma / redis /
 * logger / Sentry / rate-limiter / bcrypt are module-mocked so the test
 * exercises the route → controller → service → transaction COMPOSITION
 * without touching a real DB (Rule F). The prisma mock additionally stubs
 * `legalConsent` and `$transaction` for the consent ledger.
 */

const { TEST_JWT_SECRET, TEST_JWT_REFRESH_SECRET, TEST_IP_SALT } = vi.hoisted(() => ({
  TEST_JWT_SECRET: "test-jwt-secret-32-chars-long-padding",
  TEST_JWT_REFRESH_SECRET: "test-refresh-secret-32-chars-long-pad",
  TEST_IP_SALT: "test-ip-salt-16-chars-min",
}));

// ── Module-level mocks (hoisted by vi.mock) ────────────────────────────────
vi.mock("../../config/env", () => ({
  env: {
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
    IP_SALT: TEST_IP_SALT,
    NODE_ENV: "test",
    BCRYPT_ROUNDS: 4,
    DATABASE_URL: "postgresql://test",
    REDIS_URL: "redis://localhost:6379",
    GEMINI_API_KEY: "test-key",
  },
  getAllowedOrigins: () => ["http://localhost"],
  isNgrokOrigin: () => false,
}));

vi.mock("../../config/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    teamMember: { findUnique: vi.fn() },
    legalConsent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../config/redis", () => ({
  pubClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    sAdd: vi.fn().mockResolvedValue(1),
    sMembers: vi.fn().mockResolvedValue([]),
    expire: vi.fn().mockResolvedValue(1),
    sendCommand: vi.fn().mockResolvedValue([1, Date.now() + 60_000]),
    on: vi.fn(),
    duplicate: vi.fn().mockReturnValue({ on: vi.fn(), connect: vi.fn() }),
    connect: vi.fn(),
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("../../middlewares/rate-limiter.middleware", () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  uploadLimiter: (_req: any, _res: any, next: any) => next(),
  generalLimiter: (_req: any, _res: any, next: any) => next(),
  messageLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("$2b$04$mockedhashforpasswordtests0123456789012345678901234"),
  },
}));

// ── Imports AFTER mocks ────────────────────────────────────────────────────
import { prisma } from "../../config/prisma";
import { authRoutes } from "./auth.routes";
import { makeTestApp } from "../../test-helpers/app-factory";
import { makeTestUser } from "../../test-helpers/fixtures";
import { signupSchema } from "../../../validators/schemas";
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "../../lib/legal/versions";

const app = makeTestApp({ routes: { "/api/auth": authRoutes } });

/** A valid signup body — tests tweak only the field under assertion. */
const validBody = {
  name: "New User",
  phone: "9123456780",
  password: "password123",
  role: "customer",
  consent: true,
};

/** Latest call args passed to the mocked legalConsent.create. */
const lastConsentData = () =>
  vi.mocked(prisma.legalConsent.create).mock.calls.at(-1)?.[0]?.data as
    | {
        userId: string;
        termsVersion: string;
        privacyVersion: string;
        ipHash: string | null;
        userAgent: string | null;
      }
    | undefined;

describe("signupSchema — DPDP consent gate", () => {
  it("[Test 1] rejects a body with no consent field", () => {
    const { consent, ...noConsent } = validBody;
    void consent;
    const result = signupSchema.safeParse(noConsent);
    expect(result.success).toBe(false);
  });

  it("[Test 2] rejects consent: false (a declined / pre-unticked box)", () => {
    const result = signupSchema.safeParse({ ...validBody, consent: false });
    expect(result.success).toBe(false);
  });

  it("[Test 3] accepts consent: true", () => {
    const result = signupSchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });
});

describe("POST /api/auth/users — signup + consent ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction runs the callback with the prisma mock itself as `tx`,
    // so tx.user.create / tx.legalConsent.create resolve to the mocked fns.
    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: any) => cb(prisma),
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(
      makeTestUser({ id: "user-new-1", phone: "9123456780" }) as any,
    );
    vi.mocked(prisma.legalConsent.create).mockResolvedValue({} as any);
  });

  it("[Test 4] valid signup with consent:true → 200, tokens, and a LegalConsent row", async () => {
    const res = await request(app).post("/api/auth/users").send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.password).toBeUndefined();

    expect(prisma.legalConsent.create).toHaveBeenCalledTimes(1);
    const data = lastConsentData();
    expect(data?.userId).toBe("user-new-1");
  });

  it("[Test 5] consent versions are stamped server-side from the live constants", async () => {
    await request(app).post("/api/auth/users").send(validBody);

    const data = lastConsentData();
    expect(data?.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(data?.privacyVersion).toBe(CURRENT_PRIVACY_VERSION);
  });

  it("[Test 6] consent:false → 400 validation failed, no user or consent row written", async () => {
    const res = await request(app)
      .post("/api/auth/users")
      .send({ ...validBody, consent: false });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.legalConsent.create).not.toHaveBeenCalled();
  });

  it("[Test 7] missing consent field → 400, no writes", async () => {
    const { consent, ...noConsent } = validBody;
    void consent;
    const res = await request(app).post("/api/auth/users").send(noConsent);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("[Test 8] the signup IP is stored as a salted SHA-256 hash, never raw", async () => {
    const res = await request(app)
      .post("/api/auth/users")
      .set("User-Agent", "DukanchiTest/1.0")
      .send(validBody);

    expect(res.status).toBe(200);
    const data = lastConsentData();
    // 64-char lowercase hex == SHA-256 digest.
    expect(data?.ipHash).toMatch(/^[a-f0-9]{64}$/);
    // Defense check: the raw loopback address must not appear verbatim.
    expect(data?.ipHash).not.toContain("127.0.0.1");
    expect(data?.ipHash).not.toContain("::1");
    expect(data?.userAgent).toBe("DukanchiTest/1.0");
  });

  it("[Test 9] an oversized User-Agent is truncated to 512 chars (VarChar(512) guard)", async () => {
    const res = await request(app)
      .post("/api/auth/users")
      .set("User-Agent", "U".repeat(600))
      .send(validBody);

    expect(res.status).toBe(200);
    const data = lastConsentData();
    expect(data?.userAgent).toHaveLength(512);
  });

  it("[Test 10] the user row and consent row are written in a single transaction", async () => {
    await request(app).post("/api/auth/users").send(validBody);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.legalConsent.create).toHaveBeenCalledTimes(1);
  });

  it("[Test 11] the IP hash is deterministic for a stable salt + IP", async () => {
    await request(app).post("/api/auth/users").send(validBody);
    const first = lastConsentData()?.ipHash;

    vi.mocked(prisma.legalConsent.create).mockClear();
    await request(app).post("/api/auth/users").send(validBody);
    const second = lastConsentData()?.ipHash;

    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });
});
