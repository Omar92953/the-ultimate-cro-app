-- AlterTable
ALTER TABLE "LoyaltyProgram" ADD COLUMN "state" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "LoyaltyMember" ADD COLUMN "codeGen" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LoyaltyReferral" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "referrerId" INTEGER,
    "affiliateId" TEXT NOT NULL DEFAULT '',
    "friendCustomerId" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL DEFAULT '',
    "amount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyReferral_shop_kind_orderId_key" ON "LoyaltyReferral"("shop", "kind", "orderId");

-- CreateIndex
CREATE INDEX "LoyaltyReferral_shop_referrerId_idx" ON "LoyaltyReferral"("shop", "referrerId");

-- CreateIndex
CREATE INDEX "LoyaltyReferral_shop_affiliateId_idx" ON "LoyaltyReferral"("shop", "affiliateId");
