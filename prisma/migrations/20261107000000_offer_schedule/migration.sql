-- Scheduled offers (Pro): switched on at startsAt and off at endsAt by the app, once each.
CREATE TABLE "OfferSchedule" (
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "startDone" BOOLEAN NOT NULL DEFAULT false,
    "endDone" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("shop", "type", "handle")
);
CREATE INDEX "OfferSchedule_startsAt_idx" ON "OfferSchedule"("startsAt");
CREATE INDEX "OfferSchedule_endsAt_idx" ON "OfferSchedule"("endsAt");
