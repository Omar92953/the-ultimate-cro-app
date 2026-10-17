-- Returns become real Shopify returns: what was made and what the merchant attached.
ALTER TABLE "ReturnRequest" ADD COLUMN "returnId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReturnRequest" ADD COLUMN "returnName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReturnRequest" ADD COLUMN "labelUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReturnRequest" ADD COLUMN "tracking" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReturnRequest" ADD COLUMN "trackingUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReturnRequest" ADD COLUMN "declineNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReturnRequest" ADD COLUMN "refundedAt" TIMESTAMP(3);
