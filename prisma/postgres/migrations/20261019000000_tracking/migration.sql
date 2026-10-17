-- CreateTable
CREATE TABLE "TrackingConfig" (
    "shop" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'shopify',
    "keyCipher" TEXT NOT NULL DEFAULT '',
    "keyLast4" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "webhookSecret" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingConfig_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "TrackingCache" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "carrier" TEXT NOT NULL DEFAULT '',
    "via" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'info',
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingUsage" (
    "shop" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrackingUsage_pkey" PRIMARY KEY ("shop","month")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackingCache_shop_number_key" ON "TrackingCache"("shop", "number");
CREATE INDEX "TrackingCache_checkedAt_idx" ON "TrackingCache"("checkedAt");
