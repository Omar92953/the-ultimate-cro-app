# Working with several Claude accounts

Omar runs the app and the website from **three Claude Code accounts** at the same time. They share
one GitHub repo, so they must never step on each other. These rules make that safe.

## The accounts

| Account | Where it runs | Can do | Main job |
|---|---|---|---|
| **Mac** | Claude Code desktop on Omar's Mac, folder `~/Workspace/the-ultimate-cro-app` | everything: Shopify CLI (`shopify app deploy`, `shopify app execute`), `npm run test:functions`, the browser on Testing2 | app releases, Shopify deploys, testing on Testing2, keeping the Mac in sync |
| **Cloud A** | claude.ai/code, connected to the GitHub repo | code, checks, PRs. **Cannot** reach Shopify (no deploy, no `shopify app execute`, no function tests) | app features and fixes |
| **Cloud B** | claude.ai/code, connected to the GitHub repo | same as Cloud A | the website (`site/`) |

Omar can move jobs between accounts; update this table when he does.

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
merges, and only the Mac account can deploy:
- Cloud accounts: open the PR, mark it **"Needs Shopify deploy"** in the description, and stop there.
- Mac account: check out the PR, run `npm run test:functions`, deploy
  (`NODE_OPTIONS=--dns-result-order=ipv4first shopify app deploy --allow-updates --message "…"`),
  then merge it. Only one deploy at a time, always from an up to date branch.

The website is deployed by Cloudflare Pages on its own when `main` changes; the app admin is deployed
by Render on its own when `main` changes.

## Keeping the Mac in sync with GitHub

Run on the Mac (or ask the Mac account to):

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
