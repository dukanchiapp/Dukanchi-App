-- CreateTable
CREATE TABLE "LandingPageContent" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "LandingPageContent_pkey" PRIMARY KEY ("id")
);
