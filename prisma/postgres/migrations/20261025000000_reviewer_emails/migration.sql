-- CreateTable
CREATE TABLE "ReviewerEmail" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewerEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerEmail_shop_reviewId_key" ON "ReviewerEmail"("shop", "reviewId");
CREATE INDEX "ReviewerEmail_shop_email_idx" ON "ReviewerEmail"("shop", "email");
