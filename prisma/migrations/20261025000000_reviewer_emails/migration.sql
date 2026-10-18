-- CreateTable
CREATE TABLE "ReviewerEmail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerEmail_shop_reviewId_key" ON "ReviewerEmail"("shop", "reviewId");
CREATE INDEX "ReviewerEmail_shop_email_idx" ON "ReviewerEmail"("shop", "email");
