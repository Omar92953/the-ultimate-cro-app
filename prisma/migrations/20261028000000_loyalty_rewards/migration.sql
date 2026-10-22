-- CreateTable
CREATE TABLE "LoyaltyReward" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    "rewardId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "value" REAL NOT NULL DEFAULT 0,
    "code" TEXT NOT NULL DEFAULT '',
    "discountId" TEXT NOT NULL DEFAULT '',
    "expiresAt" DATETIME,
    "usedAt" DATETIME,
    "orderId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "LoyaltyReward_shop_memberId_createdAt_idx" ON "LoyaltyReward"("shop", "memberId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyReward_shop_code_idx" ON "LoyaltyReward"("shop", "code");
