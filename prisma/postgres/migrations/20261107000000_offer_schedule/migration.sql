-- Scheduled offers (Pro): switched on at startsAt and off at endsAt by the app, once each.
CREATE TABLE "OfferSchedule" (
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "startDone" BOOLEAN NOT NULL DEFAULT false,
    "endDone" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferSchedule_pkey" PRIMARY KEY ("shop","type","handle")
);

-- CreateIndex
CREATE INDEX "OfferSchedule_startsAt_idx" ON "OfferSchedule"("startsAt");

-- CreateIndex
CREATE INDEX "OfferSchedule_endsAt_idx" ON "OfferSchedule"("endsAt");
