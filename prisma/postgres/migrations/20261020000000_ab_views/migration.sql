-- CreateTable
CREATE TABLE "AbView" (
    "shop" TEXT NOT NULL,
    "test" TEXT NOT NULL,
    "grp" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AbView_pkey" PRIMARY KEY ("shop","test","grp","day")
);
