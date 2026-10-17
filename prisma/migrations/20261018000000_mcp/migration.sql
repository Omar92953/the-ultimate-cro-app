-- CreateTable
CREATE TABLE "McpClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "McpRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT '',
    "challenge" TEXT NOT NULL,
    "shop" TEXT NOT NULL DEFAULT '',
    "codeHash" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT 'read',
    "allowPublish" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "McpGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'read',
    "allowPublish" BOOLEAN NOT NULL DEFAULT false,
    "tokenHash" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL DEFAULT '',
    "expiresAt" DATETIME,
    "refreshExpires" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME
);

-- CreateTable
CREATE TABLE "McpAudit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL,
    "build" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "McpRequest_codeHash_idx" ON "McpRequest"("codeHash");
CREATE INDEX "McpRequest_shop_idx" ON "McpRequest"("shop");
CREATE UNIQUE INDEX "McpGrant_tokenHash_key" ON "McpGrant"("tokenHash");
CREATE INDEX "McpGrant_shop_idx" ON "McpGrant"("shop");
CREATE INDEX "McpGrant_refreshHash_idx" ON "McpGrant"("refreshHash");
CREATE INDEX "McpAudit_shop_createdAt_idx" ON "McpAudit"("shop", "createdAt");
CREATE INDEX "McpAudit_grantId_createdAt_idx" ON "McpAudit"("grantId", "createdAt");
