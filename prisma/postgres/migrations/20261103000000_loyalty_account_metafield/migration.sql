-- Customer accounts, checkout and POS read a member's points from the customer metafield $app:loyalty (lib/loyalty/account.server.ts).
ALTER TABLE "LoyaltyMember" ADD COLUMN "changedAt" TIMESTAMP(3);
ALTER TABLE "LoyaltyMember" ADD COLUMN "pushedAt" TIMESTAMP(3);
