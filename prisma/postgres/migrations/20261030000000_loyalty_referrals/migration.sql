-- AlterTable
ALTER TABLE "LoyaltyProgram" ADD COLUMN "state" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "LoyaltyMember" ADD COLUMN "codeGen" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LoyaltyReferral" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "referrerId" INTEGER,
    "affiliateId" TEXT NOT NULL DEFAULT '',
    "friendCustomerId" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyReferral_shop_kind_orderId_key" ON "LoyaltyReferral"("shop", "kind", "orderId");

-- CreateIndex
CREATE INDEX "LoyaltyReferral_shop_referrerId_idx" ON "LoyaltyReferral"("shop", "referrerId");

-- CreateIndex
CREATE INDEX "LoyaltyReferral_shop_affiliateId_idx" ON "LoyaltyReferral"("shop", "affiliateId");
