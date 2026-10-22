-- CreateTable
CREATE TABLE "LoyaltyReward" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    "rewardId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "code" TEXT NOT NULL DEFAULT '',
    "discountId" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "orderId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyReward_shop_memberId_createdAt_idx" ON "LoyaltyReward"("shop", "memberId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyReward_shop_code_idx" ON "LoyaltyReward"("shop", "code");
