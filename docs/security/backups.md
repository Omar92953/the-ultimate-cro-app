# Database backups

The live database (Supabase, Free plan) is encrypted at rest by Supabase. On top of that, a GitHub Actions job
copies it every night, encrypts the copy with AES-256 and keeps the last 14 nights. Cost: $0.

- Job: `docs/security/backup-workflow.yml`, installed as `.github/workflows/backup.yml` in the **private**
  repository `Omar92953/cro-toolbox-backups` (this app repository is public, so backups never go here).
- Secrets in that private repository: `DATABASE_URL` (the same Supabase Session pooler URL Render uses) and
  `BACKUP_PASSPHRASE` (long random password; keep it in a password manager, it's the only way to open a backup).
- Check it works: private repo → Actions → "Nightly database backup" → Run workflow, then see the green run and
  the `.dump.gpg` file under Artifacts.

## Restore

1. Download the newest artifact (private repo → Actions → a green run → Artifacts) and unzip it.
2. Decrypt: `gpg --decrypt cro-toolbox-YYYY-MM-DD.dump.gpg > backup.dump` (asks for the backup password).
3. Restore into a database (a new Supabase project, or the live one after an incident):
   `pg_restore --no-owner --no-privileges --clean --if-exists -d "<database url>" backup.dump`
4. Point Render's `DATABASE_URL` and `DIRECT_URL` at it if it's a new database, and redeploy.
