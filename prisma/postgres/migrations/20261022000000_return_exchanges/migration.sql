-- Exchanges on returns.
ALTER TABLE "ReturnRequest" ADD COLUMN "exchange" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReturnRequest" ADD COLUMN "holds" TEXT NOT NULL DEFAULT '';
