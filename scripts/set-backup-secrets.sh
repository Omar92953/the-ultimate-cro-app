#!/usr/bin/env bash
# Sets the 2 secrets of the private backup repo (docs/security/backups.md) without showing them.
# Copy the database URL first, or paste it when asked (Render → cro-toolbox → Environment → DIRECT_URL → copy icon).
set -euo pipefail
REPO=Omar92953/cro-toolbox-backups
url="$(pbpaste)"
case "$url" in postgres://*|postgresql://*) ;; *)
  echo "Paste the DIRECT_URL value from Render here (Cmd+V; nothing shows while you paste), then press Enter:"
  read -rs url; echo
  case "$url" in postgres://*|postgresql://*) ;; *) echo "That isn't a database URL (it should start with postgresql://). Nothing was changed."; exit 1;; esac;;
esac
printf %s "$url" | gh secret set DATABASE_URL -R "$REPO"
unset url
P="$(openssl rand -base64 32)"
printf %s "$P" | gh secret set BACKUP_PASSPHRASE -R "$REPO"
printf %s "$P" | pbcopy
unset P
echo "Done. The backup password is on your clipboard: paste it into your password manager now."
