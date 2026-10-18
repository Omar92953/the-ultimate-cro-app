-- CreateTable
CREATE TABLE "TrackCode" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "minimum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackCode_shop_orderId_kind_key" ON "TrackCode"("shop", "orderId", "kind");
CREATE INDEX "TrackCode_shop_kind_idx" ON "TrackCode"("shop", "kind");
