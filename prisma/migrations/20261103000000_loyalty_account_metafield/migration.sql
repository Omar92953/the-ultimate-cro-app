-- Customer accounts, checkout and POS read a member's points from the customer metafield $app:loyalty (lib/loyalty/account.server.ts).
ALTER TABLE "LoyaltyMember" ADD COLUMN "changedAt" DATETIME;
ALTER TABLE "LoyaltyMember" ADD COLUMN "pushedAt" DATETIME;
