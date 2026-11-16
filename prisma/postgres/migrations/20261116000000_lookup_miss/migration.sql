-- Order lookups that found nothing, by store and typed email (audit 2026-11-14, A8). Kept one day.
CREATE TABLE "LookupMiss" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LookupMiss_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LookupMiss_shop_email_createdAt_idx" ON "LookupMiss"("shop", "email", "createdAt");

-- CreateIndex
CREATE INDEX "LookupMiss_shop_createdAt_idx" ON "LookupMiss"("shop", "createdAt");

-- Supabase: no access through the REST API (see 20261113000000_enable_rls).
ALTER TABLE "LookupMiss" ENABLE ROW LEVEL SECURITY;
