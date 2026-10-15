#!/usr/bin/env bash
# Brings the Mac's copy of the repo up to date with GitHub and reports anything that differs.
# Safe: it never deletes branches, discards changes or overwrites local work.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch --all --prune --quiet
current=$(git branch --show-current)

if [ -n "$(git status --porcelain)" ]; then
  echo "! Uncommitted changes on '$current' (not touched):"
  git status --short
fi

# Update main without leaving the current branch.
if [ "$current" = "main" ]; then
  git pull --ff-only --quiet && echo "✓ main is up to date with GitHub"
elif git merge-base --is-ancestor main origin/main; then
  git fetch --quiet origin main:main && echo "✓ main is up to date with GitHub (you're on '$current')"
else
  echo "! main has local commits that aren't on GitHub: push them in a PR"
fi

echo
echo "Local branches:"
for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
  if ! git rev-parse -q --verify "origin/$b" >/dev/null; then
    if git merge-base --is-ancestor "$b" origin/main; then
      echo "  $b: already merged into main (safe to delete: git branch -D $b)"
    else
      echo "  $b: NOT on GitHub (push it or open a PR)"
    fi
  else
    ahead=$(git rev-list --count "origin/$b..$b"); behind=$(git rev-list --count "$b..origin/$b")
    [ "$ahead" != 0 ] && echo "  $b: $ahead commit(s) not on GitHub (push them)"
    [ "$behind" != 0 ] && echo "  $b: $behind commit(s) behind GitHub (git checkout $b && git pull)"
  fi
done

echo
echo "Open pull requests (who is working on what):"
gh pr list 2>/dev/null || echo "  (install and log in to the GitHub CLI to see them: gh auth login)"
