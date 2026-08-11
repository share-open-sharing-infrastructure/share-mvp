---
name: review-all
description: >
  Multi-role review of the current AllerLeih change: four specialised reviewers (security & data
  protection, code quality, accessibility, conventions) run in parallel against the diff, then the
  findings are consolidated, deduped and fixed directly — with a change log that records what/where/
  why for each fix. Use when a change should be reviewed from all angles and the findings fixed in
  one go, without opening a PR, and without a browser test (use /review-and-test for that).
  For a GitHub PR — or any review that should also be verified in a browser and shipped — use the
  repo's /review-and-test, or the maintainer's local /review-ship where that is set up. Do not fall
  back to the built-in /review: it is a generic prompt with no AllerLeih knowledge.
---

# review-all

You are the **orchestrator**. You don't review yourself — you spawn the role agents, consolidate
their reports and **fix afterwards**. The agents are read-only; writing happens exclusively here,
sequentially, so parallel runs don't overwrite each other.

This skill **does not commit or push** and opens no PR. It ends with a clean working directory full
of fixes plus a change log — the rest is `/create-pr`.

**Repos:** frontend (this repo, SvelteKit) and the PocketBase backend are sibling directories in
the same workspace; an e2e worktree may sit alongside. The default scope is the current change
against `main` in each affected repo.

## Stage 0 — Scope

1. Default = current change against `main`. Per repo: `git -C <repo> diff --name-only main...HEAD`
   plus `git -C <repo> status --porcelain`. If the user names a branch/files, that applies instead.
2. If the repos are clean, say so and **stop** — there's nothing to review.
3. State the scope in one German sentence before you start agents.

## Stage 1 — Select and start roles

Starting an agent costs regardless of whether it finds anything. **Only start roles that can
actually find something on this diff.**

### Small diff ⇒ no agents at all

If the diff is **≤ 40 changed lines over ≤ 3 files**, review it **yourself** — read the contract,
check the diff against the four checklists, done. Four agents for a two-liner is pure waste. Say in
the report that you took the direct route.

### Otherwise: roles by gate

Only start a role if its gate applies:

| Agent | Starts only if the diff … |
|---|---|
| `sveltekit-pb-reviewer` | touches server code, routes, hooks, migrations, PB queries, auth or personal-data fields |
| `code-quality-reviewer` | ≥ 80 changed lines **or** a new file **or** contains a touched file over the length threshold |
| `a11y-reviewer` | contains `.svelte` files with a markup change (pure script blocks don't count) |
| `conventions-reviewer` | touches frontend `src/` or backend `pb_hooks/` |

If no gate applies (e.g. only docs, config, tests), say so and **stop**.

**Spawn the applicable roles in a single message** (`run_in_background: false`) so they run
concurrently.

### Prompt to each role — pass the diff in

The most expensive mistake is several agents re-running the same `git diff` and reading through the
repo themselves. So pass **in the prompt**:

- the **ready-made diff text** (`git -C <repo> diff main...HEAD`) — fetched once by you, not by
  each agent again,
- the list of changed files with line counts (`wc -l`),
- the note that the review contract lives in `.claude/review-contract.md` (in this repo's root),
- the pointer to the affected repo's `CLAUDE.md`,
- **which MCP servers this session has** — name them. Sub-agents don't discover tooling: MCP tools
  load on demand, so a role that isn't told Serena exists will grep instead. The roles are granted
  Serena's read-only symbol tools; the contract says where they beat grep.

If the diff is very large (> ~1500 lines), pass the file list + the instruction to read
selectively instead of the full text — then the diff in the prompt is more expensive than reading.

Use the built-in `/security-review` as a **second** lens only for genuinely security-critical diffs
(auth, visibility rules, new public routes) — not routinely, else it just duplicates
`sveltekit-pb-reviewer`.

## Stage 2 — Consolidate

Before you touch anything:

1. **Deduplicate.** If two roles report the same spot, keep the wording from the responsible role
   and the **higher** severity.
2. **Resolve contradictions.** If one suggestion collides with another (typically: "extract a
   helper" vs. "an abstraction with one caller"), decide with a rationale — and write the decision
   into the change log.
3. **Group by file**, not by role — so one edit results per file instead of several.
4. **Sanity-check.** Briefly verify every finding against the real code before implementing it.
   Agents err; a fix based on a wrong finding is worse than no fix. Discarded findings go into the
   change log with a rationale, not silently away.

## Stage 3 — Fix

- **Blocking and Should-fix get fixed.** Without asking — that's the standing approval.
- **Nice-to-have** is **not** auto-fixed: list it and ask the user at the end.
- **Not autonomously fixable** (needs a design decision, the fix blows the scope, the domain logic
  is unclear): don't touch it, put it in the change log under "offen" with what's missing to decide.
- Use the `allerleih-coder` agent for a fix that spans several files or means real rewriting;
  trivial fixes you do directly.
- Fix **sequentially** and keep the diff minimal: only fix the finding, no opportunistic reworks.
  Anything else you notice becomes a finding, not an ad-hoc edit.

After the fixes, verify in the affected repo that nothing broke: `npm run lint`, `npm run check`,
the relevant `npx vitest run <files>` or backend `npm test`. **Gotcha:** if a local dev stack is
running in parallel (PocketBase on port 8091), backend tests fail broadly with "superuser auth
failed" — then stop the dev stack and run again. Mark known pre-existing failures (e.g. `$env` sync
variables on `check`/`build`) clearly as *not caused by the change*, don't fix them away.

## Stage 4 — Report with change log

One German report:

- **Scope** — repos, flow, which roles ran (and which didn't, and why).
- **Änderungsprotokoll** — the core. One line per fix, grouped by file:

  ```
  <file>:<line> — [severity, role] <what was changed>
    Warum: <the rationale from the finding, one sentence>
  ```

- **Offen** — unfixed findings: Nice-to-have (with the question whether you should still do them)
  and not-autonomously-fixable (with the missing decision).
- **Verworfen** — findings that didn't survive the sanity check, one sentence each on why.
- **Verifikation** — what ran, with PASS/FAIL; pre-existing failures listed separately.
- **Fazit** — one or two sentences: is the change clean now, what remains.

## Notes

- Start all needed agents in **one** message; don't write until **all** are back.
- Never stage, commit or push.
- If a Blocking finding stays unfixed, say so explicitly in the verdict — it must not get lost in
  the list.
- If the scope is unclear (which branch, which feature), ask once instead of guessing.
