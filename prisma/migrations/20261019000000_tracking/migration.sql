-- CreateTable
CREATE TABLE "TrackingConfig" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'shopify',
    "keyCipher" TEXT NOT NULL DEFAULT '',
    "keyLast4" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "webhookSecret" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrackingCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "carrier" TEXT NOT NULL DEFAULT '',
    "via" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'info',
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrackingUsage" (
    "shop" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("shop", "month")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackingCache_shop_number_key" ON "TrackingCache"("shop", "number");
CREATE INDEX "TrackingCache_checkedAt_idx" ON "TrackingCache"("checkedAt");
