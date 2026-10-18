-- CreateTable
CREATE TABLE "TrackStat" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrackStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackStat_shop_day_key" ON "TrackStat"("shop", "day");
