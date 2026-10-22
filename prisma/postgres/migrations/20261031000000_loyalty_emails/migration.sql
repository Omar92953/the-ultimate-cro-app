-- AlterTable
ALTER TABLE "LoyaltyMember" ADD COLUMN "emailMarketing" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LoyaltyEmail" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "memberId" INTEGER,
    "to" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT NOT NULL DEFAULT '',
    "data" TEXT NOT NULL DEFAULT '{}',
    "dedupe" TEXT,
    "providerId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "LoyaltyEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyEmail_shop_dedupe_key" ON "LoyaltyEmail"("shop", "dedupe");

-- CreateIndex
CREATE INDEX "LoyaltyEmail_shop_status_idx" ON "LoyaltyEmail"("shop", "status");

-- CreateIndex
CREATE INDEX "LoyaltyEmail_shop_memberId_idx" ON "LoyaltyEmail"("shop", "memberId");

-- CreateIndex
CREATE INDEX "LoyaltyEmail_shop_createdAt_idx" ON "LoyaltyEmail"("shop", "createdAt");
