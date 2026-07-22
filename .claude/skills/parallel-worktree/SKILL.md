---
name: parallel-worktree
description: >
  Set up (or tear down) an isolated git worktree pair — frontend + backend, own branch, own
  PocketBase data dir, own ports — so an issue can be worked on locally without touching the
  main checkout or colliding with another issue being worked on in parallel. Use when asked to
  "bearbeite Issue X in einem separaten Worktree", "arbeite parallel an Issue X/Y", or generally
  to work on more than one issue at the same time on this machine. This is a local-machine
  convenience for whoever runs Claude Code from a single checked-out clone (one branch at a
  time) — it is NOT needed for cloud/remote Claude Code setups, where each session already gets
  its own isolated environment.
---

# parallel-worktree

Local VSCode + Claude Code can only have one branch checked out per clone, so working two
issues at once needs two checkouts. `git worktree` gives you that without cloning again (shares
the `.git` history, only working files are duplicated). The part that's easy to forget: the
PocketBase **backend** also needs its own checkout + data dir, and the dev stack needs its own
ports — otherwise two parallel issues silently share one database and fight over one port.

**Skip this entirely** if only one issue is being worked on at a time, or if this is a
cloud-hosted/remote Claude Code session — those already run isolated per session.

## 1. Naming

Given issue number `<n>` (or a short slug if there's no issue number), use:
- Branch: `feat/issue-<n>` (or `fix/issue-<n>` for a bugfix) — same branch name in both repos if
  the issue spans both.
- Frontend worktree dir: sibling `../share-mvp-issue-<n>`.
- Backend worktree dir: sibling `../allerleih-backend-issue-<n>`.

## 2. Create the worktrees

```bash
# from inside the main frontend checkout
git worktree add ../share-mvp-issue-<n> -b feat/issue-<n>

# from inside the main backend checkout (skip if the issue is frontend-only)
git worktree add ../allerleih-backend-issue-<n> -b feat/issue-<n>
```

The backend worktree needs its own `pocketbase` binary (it's not tracked in git) and gets a
fresh `pb_data` on first `serve` — copy the binary over:

```bash
cp ../allerleih-backend/pocketbase ../allerleih-backend-issue-<n>/pocketbase
```

## 3. Pick unused ports

`scripts/dev-stack.sh` defaults to `PB_PORT=8091`, `WEB_PORT=5173` — those belong to the main
checkout. Pick a free pair for this worktree (check first, don't just guess):

```bash
for p in 8101 8111 8121 8131; do lsof -i ":$p" >/dev/null 2>&1 || { echo "$p free"; break; }; done
```

Write the chosen values plus the backend dir into an env file **inside the frontend worktree**
(gitignored, never commit it):

```bash
cat > ../share-mvp-issue-<n>/.env.worktree <<ENVEOF
PB_BACKEND_DIR=$(cd ../allerleih-backend-issue-<n> && pwd)
PB_PORT=8101
WEB_PORT=5183
ENVEOF
```

## 4. Work the issue

Open a new VSCode window on `../share-mvp-issue-<n>` (separate window = separate Claude Code
session, no branch conflict with other running issues). Bring the stack up with:

```bash
source .env.worktree && scripts/dev-stack.sh --seed e2e
```

Everything else (the `issue-to-pr` pipeline, `drive-app`, `write-tests`, …) works unchanged
inside the worktree — it's a normal checkout as far as those skills are concerned.

## 5. Clean up after merge

```bash
git worktree remove ../share-mvp-issue-<n>
git worktree remove ../allerleih-backend-issue-<n>
git branch -d feat/issue-<n>          # in both repos, after the PR(s) merged
```

`git worktree list` (run in either repo) shows what's currently checked out if things get
confusing.
