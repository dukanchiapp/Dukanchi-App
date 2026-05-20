-- Legal Phase A / Session — LegalConsent table.
--
-- Records each user's DPDP consent at signup: which Terms/Privacy versions
-- they accepted, plus a salted SHA-256 hash of the signup IP and the
-- user-agent for the audit trail. Additive only — the "User" table is NOT
-- altered; the relation is resolved by Prisma via LegalConsent.userId.
--
-- TRANSACTIONALITY: plain DDL, safe inside the default migration transaction.
-- Apply via `prisma migrate deploy` (or `prisma migrate dev` on a TEST db).

-- CreateTable
CREATE TABLE "LegalConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" VARCHAR(512),
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalConsent_userId_idx" ON "LegalConsent"("userId");

-- AddForeignKey
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
