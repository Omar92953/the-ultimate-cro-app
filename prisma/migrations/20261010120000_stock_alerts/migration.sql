-- CreateTable
CREATE TABLE "StockAlert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "StockAlert_shop_variantId_email_key" ON "StockAlert"("shop", "variantId", "email");

-- CreateIndex
CREATE INDEX "StockAlert_shop_notifiedAt_idx" ON "StockAlert"("shop", "notifiedAt");
