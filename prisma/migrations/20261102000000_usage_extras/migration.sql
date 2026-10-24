-- CreateTable
CREATE TABLE "UsageExtra" (
    "shop" TEXT NOT NULL,
    "meter" TEXT NOT NULL,
    "on" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("shop", "meter")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "meter" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_shop_key_key" ON "UsageEvent"("shop", "key");

-- CreateIndex
CREATE INDEX "UsageEvent_status_idx" ON "UsageEvent"("status");

-- CreateIndex
CREATE INDEX "UsageEvent_shop_meter_month_idx" ON "UsageEvent"("shop", "meter", "month");
