# Security incident response policy

CRO Toolbox, run by Omar Moaz. Adopted 2026-10-19. Applies to the app (Render server, Supabase database, Shopify
app configuration), its backups (private GitHub repository `cro-toolbox-backups`) and the website.

## What counts as an incident

Any event that may have exposed, changed or destroyed personal data the app holds (shopper emails, return requests,
reviewer emails, tracking numbers, store access tokens), or given someone unauthorised access to the systems above.
Examples: a leaked secret or token, an unknown login to Render, Supabase, GitHub or the Partner Dashboard, a bug that
shows one store's data to another, a lost device with access.

## Who

Omar is responsible for every step. Contact: support@crotoolbox.com.

## Steps

1. **Contain (as soon as it's noticed):** revoke or rotate the affected secrets (Shopify API secret, `DATABASE_URL`
   password, Render and GitHub tokens, `TRACKING_*` keys, backup password), sign out other sessions, and take the
   affected feature or the whole app offline on Render if data is still leaking.
2. **Assess (within 24 hours):** find what happened, which stores and which data were affected, and since when,
   using Render logs, Supabase logs and the git history. Write it down in a private note with times.
3. **Notify (within 72 hours of becoming aware):** tell Shopify (Partner support, and as the Partner Program
   Agreement and API terms require) and every affected merchant by email: what happened, which data, what was done,
   and what they should do. Merchants decide whether their customers or authorities must be told; we help them.
4. **Recover:** fix the cause, restore data from the newest clean encrypted backup if needed, and redeploy.
5. **Review (within 2 weeks):** record the cause and the fix in this folder and change the process so it can't
   happen the same way again.

## Prevention that's already in place

- HTTPS everywhere; Shopify webhook and request signatures verified; each store's data read only with its own token.
- Database encrypted at rest (Supabase); nightly encrypted backups kept 14 days in a private repository
  (`docs/security/backups.md`).
- Personal data kept only as long as the retention periods in `app/lib/retention.ts`, deleted daily
  (`app/lib/retention.server.ts`) and on uninstall or redaction requests (`webhooks.compliance.tsx`).
- Secrets only in Render and GitHub secret settings, never in the repository (it is public).
- Only Omar has access to Render, Supabase, GitHub and the Partner Dashboard.
