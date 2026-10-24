-- Orders placed before the program started (or was turned on again) never earn, even read later.
ALTER TABLE "LoyaltyProgram" ADD COLUMN "countFrom" TIMESTAMP(3);
