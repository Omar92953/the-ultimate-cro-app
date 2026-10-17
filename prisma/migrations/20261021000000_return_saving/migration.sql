-- Return saving rules: what the shopper chose and how credit was given.
ALTER TABLE "ReturnRequest" ADD COLUMN "resolution" TEXT NOT NULL DEFAULT 'refund';
ALTER TABLE "ReturnRequest" ADD COLUMN "quote" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ReturnRequest" ADD COLUMN "currency" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReturnRequest" ADD COLUMN "creditKind" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReturnRequest" ADD COLUMN "creditCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReturnRequest" ADD COLUMN "creditAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ReturnRequest" ADD COLUMN "creditBonus" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReturnRequest" ADD COLUMN "creditedAt" DATETIME;
