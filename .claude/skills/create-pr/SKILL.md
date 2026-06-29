---
name: create-pr
description: Open a pull request to main for the AllerLeih repo. Runs the lint/check/test/build preflight, drafts a title and body from the branch diff, and creates the PR with gh. Use when the user asks to open/create a PR, raise a pull request, or "ship" the current branch.
---

# create-pr

Open a clean, CI-ready pull request from the current branch to `main`.

## 1. Preconditions

- Confirm the working tree's changes are committed. If there are uncommitted changes, show
  `git status` and ask whether to commit them first (don't commit silently).
- Get the current branch: `git branch --show-current`.
  - **If it is `main`:** stop. Offer to create a feature branch (suggest a name derived from
    the change, e.g. `fix/trusted-item-image`) and move the commits there. Do not push to `main`.
- Never stage or commit `.env`, secrets, or coverage output.

## 2. Preflight (must pass before opening the PR)

Run the same gates CI enforces and report results plainly. Stop and surface failures rather
than opening a broken PR:

```bash
npm run lint
npm run check
npx vitest run
npm run build
```

If `npm run lint` fails on autofixable issues, offer `npm run lint:fix` + `npm run format`.
If a step fails, fix it or ask the user how to proceed — do not continue to PR creation.

## 3. Draft the PR

- Summarize the branch vs base: `git log --oneline main..HEAD` and `git diff --stat main...HEAD`.
- Write a **title** (concise, imperative) and a **body** with:
  - **What** changed and **why** (the problem it solves / spec it implements).
  - **Test notes:** what you ran (the preflight above) and any manual verification required by the reviewer.
  - Linked issue if the branch name encodes one (e.g. `431-...` → `Closes #431`).
- Keep it in the repo's style; the UI/strings are German but PR text is English.

## 4. Create it

```bash
git push -u origin HEAD        # if the branch isn't pushed yet
gh pr create --base main --title "<title>" --body "<body>"
```

End the PR body with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 5. After creating

- Print the PR URL.
- Note that `.github/workflows/vitest.yaml` will run `npm run build` + `npx vitest run --coverage`
  on the PR and post a coverage comment. Merging to `main` triggers the Uberspace deploy
  (`.github/workflows/deploy-to-uberspace.yaml`).
