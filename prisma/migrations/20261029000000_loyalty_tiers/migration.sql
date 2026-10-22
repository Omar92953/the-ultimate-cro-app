-- AlterTable
ALTER TABLE "LoyaltyEvent" ADD COLUMN "multiplier" REAL NOT NULL DEFAULT 1;
ALTER TABLE "LoyaltyEvent" ADD COLUMN "credit" REAL NOT NULL DEFAULT 0;
ALTER TABLE "LoyaltyEvent" ADD COLUMN "issuedAt" DATETIME;

-- AlterTable
ALTER TABLE "LoyaltyMember" ADD COLUMN "tierTagged" TEXT NOT NULL DEFAULT '';
