-- The website's "Email me at launch" list (crotoolbox.com). Deleted after the launch email.
CREATE TABLE "LaunchSignup" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "page" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaunchSignup_email_key" ON "LaunchSignup"("email");

-- CreateIndex
CREATE INDEX "LaunchSignup_createdAt_idx" ON "LaunchSignup"("createdAt");

-- Supabase: no access through the REST API (see 20261113000000_enable_rls).
ALTER TABLE "LaunchSignup" ENABLE ROW LEVEL SECURITY;
