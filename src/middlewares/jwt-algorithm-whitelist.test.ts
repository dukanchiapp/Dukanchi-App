import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";

/**
 * JWT algorithm-whitelist contract test — Day 3 / Session 89 / Subtask 3.1.
 *
 * Purpose: prove that pinning `algorithms: ['HS256']` on jwt.verify rejects
 * tokens signed with a different algorithm even when the secret is correct.
 * This is the defense against the algorithm-confusion attack class: an
 * attacker who learns the JWT_SECRET can NOT bypass our HS256 pin by
 * presenting an HS512/RS256-signed token.
 *
 * The test stands alone — it doesn't import any production code. It pins the
 * behavioral contract we rely on across:
 *   - auth.middleware.ts:55  (HTTP gate)
 *   - socket-listeners.ts:36 (WebSocket gate)
 *
 * If this test ever fails, jsonwebtoken's verify-side algorithm-whitelist
 * semantics have changed in a way that breaks our security model. Stop
 * and audit immediately.
 */
describe("JWT algorithm whitelist", () => {
  it("rejects an HS512-signed token when verify whitelist is ['HS256']", () => {
    const secret = "test-secret-32-chars-long-padding-min";
    const tokenSignedWithHS512 = jwt.sign(
      { userId: "test" },
      secret,
      { algorithm: "HS512" },
    );

    expect(() =>
      jwt.verify(tokenSignedWithHS512, secret, { algorithms: ["HS256"] }),
    ).toThrow(/invalid algorithm/i);
  });
});
