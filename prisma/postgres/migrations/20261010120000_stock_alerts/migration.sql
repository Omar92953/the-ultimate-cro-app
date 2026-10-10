-- CreateTable
CREATE TABLE "StockAlert" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_shop_variantId_email_key" ON "StockAlert"("shop", "variantId", "email");

-- CreateIndex
CREATE INDEX "StockAlert_shop_notifiedAt_idx" ON "StockAlert"("shop", "notifiedAt");
