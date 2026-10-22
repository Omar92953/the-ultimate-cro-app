-- AlterTable
ALTER TABLE "LoyaltyMember" ADD COLUMN "emailMarketing" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LoyaltyEmail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "memberId" INTEGER,
    "to" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT NOT NULL DEFAULT '',
    "data" TEXT NOT NULL DEFAULT '{}',
    "dedupe" TEXT,
    "providerId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyEmail_shop_dedupe_key" ON "LoyaltyEmail"("shop", "dedupe");

-- CreateIndex
CREATE INDEX "LoyaltyEmail_shop_status_idx" ON "LoyaltyEmail"("shop", "status");

-- CreateIndex
CREATE INDEX "LoyaltyEmail_shop_memberId_idx" ON "LoyaltyEmail"("shop", "memberId");

-- CreateIndex
CREATE INDEX "LoyaltyEmail_shop_createdAt_idx" ON "LoyaltyEmail"("shop", "createdAt");
