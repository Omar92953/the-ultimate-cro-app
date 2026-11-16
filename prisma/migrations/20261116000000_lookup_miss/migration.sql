-- Order lookups that found nothing, by store and typed email (audit 2026-11-14, A8). Kept one day.
CREATE TABLE "LookupMiss" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "LookupMiss_shop_email_createdAt_idx" ON "LookupMiss"("shop", "email", "createdAt");
CREATE INDEX "LookupMiss_shop_createdAt_idx" ON "LookupMiss"("shop", "createdAt");
