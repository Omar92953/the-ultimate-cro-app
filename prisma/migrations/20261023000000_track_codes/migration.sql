-- CreateTable
CREATE TABLE "TrackCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "minimum" REAL NOT NULL DEFAULT 0,
    "endsAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackCode_shop_orderId_kind_key" ON "TrackCode"("shop", "orderId", "kind");
CREATE INDEX "TrackCode_shop_kind_idx" ON "TrackCode"("shop", "kind");
