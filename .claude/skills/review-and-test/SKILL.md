---
name: review-and-test
description: >
  Review-and-verify workflow for AllerLeih: review the current change for security & project
  correctness, and verify it end-to-end in a real browser — then report. Runs four specialised
  reviewer roles in parallel (security & data protection, code quality, accessibility,
  conventions) plus allerleih-tester for the test drive, with a browser pass via whichever browser
  MCP the session has when the tests can't answer the question, and produces one consolidated report.
  READ-ONLY: it changes no code, runs no fix-loop, opens no PR. Use when you have a change on a
  feature branch (or uncommitted) and want it reviewed and browser-tested without shipping it.
---

# review-and-test

You are the **orchestrator**. You do **not** review or test yourself — you spawn the two
dedicated sub-agents (Agent tool, `run_in_background: false`), collect their results, and hand the
user one consolidated report. This skill is **read-only**: it never edits source or tests, never
runs a fix-loop, never commits or opens a PR. If findings/failures come back, you report them and
let the user decide what to fix (they can then run `/issue-to-pr` or fix directly).

**Repos** — frontend and PocketBase backend are **sibling directories in the same workspace**:
- Frontend (this repo, SvelteKit) — git repo.
- Backend (`Allerleih-Backend` / `allerleih-backend`, PocketBase hooks + migrations) — git repo.
- An e2e worktree may sit alongside; a local PocketBase data dir / helper-scripts dir are not git repos.

## Stage 0 — Scope

1. **Default scope = the current change vs. `main`.** In each repo determine what changed:
   `git -C <repo> diff --name-only main...HEAD` plus `git -C <repo> status --porcelain` for
   uncommitted work. If the user named a specific branch/files/feature at invocation, use that
   instead.
2. Decide which repo(s) the change touches (frontend, backend, or both). If both repos are clean
   (no diff vs. main, nothing uncommitted), say so and stop — there's nothing to review or test.
3. State the scope in one German sentence (which repo(s), roughly which flow) before spawning
   agents, so it's clear what's being covered.

## Stage 1 & 2 — Review and Test (run concurrently)

Review and browser-test are independent — spawn **all sub-agents in the same message** so they
run in parallel. All must be told to obey the relevant repo's `CLAUDE.md` guardrails and consult
its skills, and all are read-only w.r.t. source.

The four reviewer roles are read-only **by permission** — their `tools:` grant excludes `Edit` and
`Write`. `allerleih-tester` is not: it needs browser-MCP tools whose names differ per setup, so an
allowlist would silently break its browser step. Enforce its read-only contract by post-condition
instead: record `git -C <repo> status --porcelain` for every affected repo **before** spawning it,
compare **after** it returns, and treat any change to tracked files as a **failed test run** — say
so in the report rather than accepting a green that was edited into place.

### Review — four role agents
The review is split into four specialised roles; each has its own beat and shares the contract in
`.claude/review-contract.md` (in the frontend repo's root) (scope, severity, output format,
boundaries). Spawn them against the current diff of **each affected repo**
(`git -C <repo> diff main...HEAD` + working tree):

| Agent | Beat |
|---|---|
| `sveltekit-pb-reviewer` | PB filter injection, trust/group leakage, `items_public`/`users_public`/`items_searchable`, auth, PII/GDPR, realtime authorisation |
| `code-quality-reviewer` | file length, complexity, duplication, abstraction altitude, anti-patterns |
| `a11y-reviewer` | semantics, focus, ARIA, keyboard, contrast, screen readers |
| `conventions-reviewer` | runes rules, `texts.ts`, `displayName()`, `subscribeRealtime()`, test conventions, design system |

Each role returns a findings list (**file:line + concrete fix**, severity), empty if clean.

**Name the available MCP servers in each role's prompt** — MCP tools load on demand, so a role that
isn't told Serena exists falls back to grep; the roles hold its read-only symbol tools and the
contract says where those beat grep.

**Cost:** fetch the diff **once yourself** and pass it to the agents in the prompt — otherwise four
agents re-run the same `git diff`. **Only start roles whose gate applies:** `sveltekit-pb-reviewer`
for server/routes/hooks/migrations/auth/personal data, `code-quality-reviewer` from ~80 changed
lines or a new file, `a11y-reviewer` only for markup changes in `.svelte`, `conventions-reviewer`
for frontend `src/` or `pb_hooks/`. For **≤ 40 changed lines over ≤ 3 files** review it yourself
instead of starting agents. Justify skipped roles in the report. Use the built-in
`/security-review` only as a second lens for genuinely security-critical diffs — not routinely.

If two roles report the same spot: list it **once** in the report, with the higher severity.

### Test — sub-agent `allerleih-tester`
Spawn it to verify the change end-to-end, scoped to the diff's impact set. It:
1. Runs the relevant **unit/integration** tests (frontend `npx vitest run <files>`; backend
   `npm test`) — scoped, not a blanket full-suite run unless the change is broad.
2. Runs the **affected Playwright e2e specs** (`npm run test:e2e -- <spec>`).
3. Drives the changed flow **interactively in a real browser** — but **only when the browser can
   answer something the specs cannot**: a visual/interactive change with no covering spec, a spec
   that failed and needs diagnosing, suspected console/network errors, or an a11y/perf question. If
   step 2's specs cover the flow and passed, **skip it and record it as skipped** — never let a
   skipped step read as a passed one. Use whichever browser MCP the session has (Chrome DevTools or
   Playwright — the user's choice); watch console errors and 4xx/5xx from the changed endpoints, and
   snapshot only when needed to pick the next target or prove the outcome.

Stack bring-up (per the tester's own instructions / `drive-app` skill):
`scripts/dev-stack.sh --seed e2e` → PB `127.0.0.1:8091`, web `127.0.0.1:5173`, superuser
`admin@local.test` / `localdev12345`. **Background-task reap gotcha:** a PB `serve` started as a
Claude background task dies after ~1–2 min — if the tester hits this, ask the user to run the
stack via `! scripts/dev-stack.sh --seed e2e` so it survives, then re-drive promptly.

## Stage 3 — Consolidated report

Once all agents return, output **one** German report:

- **Scope** — which repo(s) and flow you covered (and, if the tester narrowed/widened scope, why);
  which reviewer roles ran, and which were skipped for lack of relevant changes.
- **Review** — findings grouped by severity (not by role), each as `file:line` + the concrete fix,
  with the reporting role in brackets. Dedupe: the same spot only once, with the higher severity.
  "Keine Findings" if clean. Note if `/security-review` was also run.
- **Test** — the impact set the tester derived; each thing it ran (vitest / backend / e2e /
  browser smoke) with PASS/FAIL; every failure with the exact error / console message / failing
  request + screenshot.
- **Fazit** — one-line verdict: is the change safe & working, or what blocks it.

Then **stop.** Do not fix anything. If there are findings/failures, remind the user they can run
`/review-all` (the same roles, but including a fix pass with a change log — without a browser test)
or `/issue-to-pr` (fix-loop → tests → PR) — this skill's job ends at the report.

## Notes

- Run the sub-agents with `run_in_background: false`; launch them all in one message for concurrency.
- Never stage, commit, or push anything. Never edit source or tests.
- If the scope is ambiguous (which branch? which feature?), ask the user once rather than guessing.
