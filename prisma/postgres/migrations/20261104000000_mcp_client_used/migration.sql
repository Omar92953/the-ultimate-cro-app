-- When an assistant last used its registration, and registrations unused for 90 days are removed (audit 1.4).
ALTER TABLE "McpClient" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
