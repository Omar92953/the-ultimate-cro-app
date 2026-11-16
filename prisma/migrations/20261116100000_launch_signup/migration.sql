-- The website's "Email me at launch" list (crotoolbox.com). Deleted after the launch email.
CREATE TABLE "LaunchSignup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "page" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "LaunchSignup_email_key" ON "LaunchSignup"("email");
CREATE INDEX "LaunchSignup_createdAt_idx" ON "LaunchSignup"("createdAt");
