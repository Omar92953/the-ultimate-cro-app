-- CreateTable
CREATE TABLE "UsageExtra" (
    "shop" TEXT NOT NULL,
    "meter" TEXT NOT NULL,
    "on" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageExtra_pkey" PRIMARY KEY ("shop","meter")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "meter" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_shop_key_key" ON "UsageEvent"("shop", "key");

-- CreateIndex
CREATE INDEX "UsageEvent_status_idx" ON "UsageEvent"("status");

-- CreateIndex
CREATE INDEX "UsageEvent_shop_meter_month_idx" ON "UsageEvent"("shop", "meter", "month");
