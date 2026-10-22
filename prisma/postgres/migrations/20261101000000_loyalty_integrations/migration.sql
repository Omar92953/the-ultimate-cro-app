-- CreateTable
CREATE TABLE "LoyaltyIntegration" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "last4" TEXT NOT NULL DEFAULT '',
    "on" BOOLEAN NOT NULL DEFAULT true,
    "state" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyOutbox" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    "target" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "dedupe" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "LoyaltyOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyIntegration_shop_kind_key" ON "LoyaltyIntegration"("shop", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyOutbox_shop_dedupe_key" ON "LoyaltyOutbox"("shop", "dedupe");

-- CreateIndex
CREATE INDEX "LoyaltyOutbox_shop_status_idx" ON "LoyaltyOutbox"("shop", "status");

-- CreateIndex
CREATE INDEX "LoyaltyOutbox_shop_memberId_idx" ON "LoyaltyOutbox"("shop", "memberId");
