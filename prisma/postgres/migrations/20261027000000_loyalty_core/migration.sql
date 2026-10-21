-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "shop" TEXT NOT NULL,
    "on" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "syncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "LoyaltyMember" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "firstName" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL DEFAULT '',
    "birthday" TEXT NOT NULL DEFAULT '',
    "points" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "lifetime" INTEGER NOT NULL DEFAULT 0,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT '',
    "tierSince" TIMESTAMP(3),
    "referralCode" TEXT NOT NULL DEFAULT '',
    "referredBy" INTEGER,
    "emailOptOut" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyEvent" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "orderId" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "dedupe" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyMember_shop_customerId_key" ON "LoyaltyMember"("shop", "customerId");

-- CreateIndex
CREATE INDEX "LoyaltyMember_shop_email_idx" ON "LoyaltyMember"("shop", "email");

-- CreateIndex
CREATE INDEX "LoyaltyMember_shop_referralCode_idx" ON "LoyaltyMember"("shop", "referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyEvent_shop_dedupe_key" ON "LoyaltyEvent"("shop", "dedupe");

-- CreateIndex
CREATE INDEX "LoyaltyEvent_shop_memberId_createdAt_idx" ON "LoyaltyEvent"("shop", "memberId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyEvent_status_availableAt_idx" ON "LoyaltyEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "LoyaltyEvent_shop_orderId_idx" ON "LoyaltyEvent"("shop", "orderId");
