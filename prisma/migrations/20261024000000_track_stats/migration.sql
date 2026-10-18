-- CreateTable
CREATE TABLE "TrackStat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackStat_shop_day_key" ON "TrackStat"("shop", "day");
