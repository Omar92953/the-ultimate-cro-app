# Working with several Claude accounts

Omar runs the app and the website from **three Claude Code accounts** at the same time. They share
one GitHub repo, so they must never step on each other. These rules make that safe.

## The accounts

All three accounts are **equal**: any of them can work on anything, the app or the website. There is
no main account and no fixed roles. Pick the next free task from `docs/WORKBOARD.md` that no open PR
has claimed.

What a session can do depends only on **where it runs**, not on which account it is:

| Where the session runs | Can do |
|---|---|
| **On Omar's Mac** (Claude Code desktop or terminal, folder `~/Workspace/the-ultimate-cro-app`) | everything: code, checks, PRs, Shopify CLI (`shopify app deploy`, `shopify app execute`), `npm run test:functions`, the browser on Testing2 |
| **In the cloud** (claude.ai/code, connected to the GitHub repo) | code, checks, PRs, merges. **Cannot** reach Shopify: no Shopify deploy, no `shopify app execute`, no function tests |

So the only hand off is a Shopify deploy (see below): a cloud session that changes `theme/`,
`extensions/` or `shopify.app.toml` leaves the deploy to the next session running on the Mac.

## The board: open pull requests

The live list of who is doing what is **GitHub's open pull requests**:

```bash
gh pr list
```

Rules:
1. **Start every session with** `git fetch --prune && git checkout main && git pull`, then
   `gh pr list` and `docs/WORKBOARD.md`.
2. **Claim work before writing code**: create your branch, push it and open a **draft PR** at once
   (`gh pr create --draft`), titled with its area: `App: …`, `Website: …`, `Docs: …`. Everyone sees it.
3. **Don't touch files that another open PR changes** (`gh pr diff <n> --name-only`). If you must,
   say so in your PR and wait until the other one is merged.
4. **Small PRs, merged quickly.** A branch that lives for days collects conflicts.
5. **Before merging**: bring your branch up to date with `main` (`git merge origin/main`), run the
   checks again, then merge. If you get a conflict, the PR merged **later** resolves it.
6. After merging, delete the branch (`gh pr merge --merge --delete-branch`).

## Areas

| Area | Files | Checks before merging |
|---|---|---|
| App (admin) | `app/`, `prisma/`, `test/app` | `npx tsc --noEmit`, `npm run lint`, `npm run test:app`, `npm run build`, `npm run graphql-codegen` when GraphQL changed |
| Storefront and checkout | `theme/`, `extensions/`, `shopify.app.toml` | the app checks plus `npm run build:theme`, `npm run test:storefront`, `npm run test:functions` (Mac) |
| Website | `site/` | `npm --prefix site run build` |
| Docs | `docs/`, `CLAUDE.md`, `README.md` | none |

**Shared files** (change with care, and mention it in the PR title): `app/lib/plans.ts` (prices and
limits, also read by the website), `app/lib/catalog.ts` (features, also read by the website),
`app/lib/bundle-recipes.ts`, `shopify.app.toml`, `package.json`, `CLAUDE.md`, `docs/PROJECT-GUIDE.md`.

## Shopify deploys (Mac only)

A PR that changes `theme/`, `extensions/` or `shopify.app.toml` needs a Shopify deploy **before** it
merges, and only a session running on the Mac can deploy:
- In the cloud: open the PR, add **"Needs Shopify deploy"** to its title, and leave it open.
- On the Mac (any account): `gh pr list --search "Needs Shopify deploy"`, check out the PR, run `npm run test:functions`, deploy
  (`NODE_OPTIONS=--dns-result-order=ipv4first shopify app deploy --allow-updates --message "…"`),
  then merge it. Only one deploy at a time, always from an up to date branch.

The website is deployed by Cloudflare Pages on its own when `main` changes; the app admin is deployed
by Render on its own when `main` changes.

## Keeping the Mac in sync with GitHub

Run on the Mac (any account can):

```bash
cd ~/Workspace/the-ultimate-cro-app && bash scripts/sync.sh
```

It fetches GitHub, updates `main`, and reports anything that differs: uncommitted changes, local
commits not on GitHub, and branches already merged. It never deletes or overwrites your work.

Files that live **only on the Mac on purpose** (in `.gitignore`): `.env` (secrets), `_reference/`
(read only copies of Omar's themes), `docs/carry-over-gaps.md`, `docs/step1-inventory-and-architecture.md`,
`docs/theme-removal.md` (private notes), `prisma/dev.sqlite` and build output. Cloud accounts don't
have them and don't need them.

## Handing over

When a session stops mid-task, leave the state in the PR description (what's done, what's left, how
to test) and tick or add items in `docs/WORKBOARD.md` in the same PR. The next account continues
from there. Never rely on chat history: another account can't see it.
